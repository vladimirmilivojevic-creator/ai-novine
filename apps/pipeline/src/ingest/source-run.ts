import {
  createLogger,
  fetchText,
  FetchFailure,
  loadRobots,
  looksLikeFeed,
  parseFeed,
  type FeedItem,
  type Source,
} from '@ai-novine/core';
import {
  existingContentHashes,
  existingUrlHashes,
  getFetchStates,
  insertRawItems,
  saveFetchState,
  type NewRawItem,
} from '@ai-novine/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { extractArticle, MIN_ARTICLE_WORDS } from './extract.js';
import {
  canonicalizeUrl,
  contentHash,
  countWords,
  stripHtml,
  toIsoDate,
  urlHash,
} from './normalize.js';

const log = createLogger('ingest');

export interface IngestOptions {
  /** Gornja granica novih clanaka po izvoru u jednom ciklusu. */
  maxItemsPerSource: number;
  /** Da li se otvara i sama stranica clanka radi punog teksta. */
  fullText: boolean;
}

export interface SourceIngestResult {
  sourceId: string;
  feedsChecked: number;
  feedsUnchanged: number;
  feedItems: number;
  newUrls: number;
  extracted: number;
  inserted: number;
  duplicates: number;
  errors: string[];
}

interface Candidate {
  item: FeedItem;
  url: string;
  hash: string;
}

export async function ingestSource(
  client: SupabaseClient,
  source: Source,
  options: IngestOptions,
): Promise<SourceIngestResult> {
  const result: SourceIngestResult = {
    sourceId: source.id,
    feedsChecked: 0,
    feedsUnchanged: 0,
    feedItems: 0,
    newUrls: 0,
    extracted: 0,
    inserted: 0,
    duplicates: 0,
    errors: [],
  };

  if (source.feeds.length === 0) {
    result.errors.push('Izvor nema nijedan feed u config/sources.json.');
    return result;
  }

  const robots = await loadRobots(source.homepage);
  const fetchStates = await getFetchStates(client, source.feeds);

  // ── 1. Feed-ovi ────────────────────────────────────────────────────────────
  const candidates = new Map<string, Candidate>();

  for (const feedUrl of source.feeds) {
    result.feedsChecked += 1;
    const state = fetchStates.get(feedUrl);

    const conditional: Record<string, string> = {};
    if (state?.etag) conditional['if-none-match'] = state.etag;
    if (state?.last_modified) conditional['if-modified-since'] = state.last_modified;

    let response;
    try {
      response = await fetchText(feedUrl, {
        accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.5',
        headers: conditional,
      });
    } catch (error) {
      const message = error instanceof FetchFailure ? error.message : String(error);
      result.errors.push(`${feedUrl}: ${message}`);
      continue;
    }

    if (response.status === 304) {
      result.feedsUnchanged += 1;
      await saveFetchState(client, {
        url: feedUrl,
        sourceId: source.id,
        etag: state?.etag ?? null,
        lastModified: state?.last_modified ?? null,
        status: 304,
        changed: false,
      });
      continue;
    }

    if (!response.ok) {
      result.errors.push(`${feedUrl}: HTTP ${response.status}`);
      continue;
    }

    if (!looksLikeFeed(response.body, response.contentType)) {
      result.errors.push(`${feedUrl}: odgovor nije feed`);
      continue;
    }

    const feed = parseFeed(response.body);
    if (!feed) {
      result.errors.push(`${feedUrl}: XML se ne parsira kao RSS/Atom`);
      continue;
    }

    await saveFetchState(client, {
      url: feedUrl,
      sourceId: source.id,
      etag: response.etag,
      lastModified: response.lastModified,
      status: response.status,
      changed: true,
    });

    for (const item of feed.items) {
      result.feedItems += 1;
      if (!item.link || !item.title) continue;

      const canonical = canonicalizeUrl(item.link, feedUrl);
      if (!canonical) continue;
      if (!sameSite(canonical, source.homepage)) continue;

      candidates.set(canonical, { item, url: canonical, hash: urlHash(canonical) });
    }
  }

  if (candidates.size === 0) return result;

  // ── 2. Sta je vec u bazi ───────────────────────────────────────────────────
  const all = [...candidates.values()];
  const known = await existingUrlHashes(
    client,
    all.map((candidate) => candidate.hash),
  );

  const fresh = all
    .filter((candidate) => !known.has(candidate.hash))
    .sort((a, b) => publishedTime(b.item) - publishedTime(a.item))
    .slice(0, options.maxItemsPerSource);

  result.newUrls = fresh.length;
  if (fresh.length === 0) return result;

  // ── 3. Tekst clanka ────────────────────────────────────────────────────────
  const rows: NewRawItem[] = [];
  const seenContent = new Set<string>();

  for (const candidate of fresh) {
    const row = await buildRow(source, candidate, options, robots, result);
    if (!row) continue;

    // Duplikat unutar iste serije (isti tekst na dva URL-a u istom ciklusu).
    if (seenContent.has(row.content_hash)) {
      result.duplicates += 1;
      continue;
    }
    seenContent.add(row.content_hash);
    rows.push(row);
  }

  // ── 4. Upis ────────────────────────────────────────────────────────────────
  if (rows.length > 0) {
    const knownContent = await existingContentHashes(
      client,
      source.id,
      rows.map((row) => row.content_hash),
    );
    const toInsert = rows.filter((row) => !knownContent.has(row.content_hash));
    result.duplicates += rows.length - toInsert.length;

    const inserted = await insertRawItems(client, toInsert);
    result.inserted = inserted.inserted;
    result.duplicates += inserted.duplicates;
  }

  log.info(`${source.name}: ${result.inserted} novih`, {
    feedova: result.feedsChecked,
    nepromenjenih: result.feedsUnchanged,
    kandidata: candidates.size,
    novihUrl: result.newUrls,
    duplikata: result.duplicates,
    gresaka: result.errors.length,
  });

  return result;
}

async function buildRow(
  source: Source,
  candidate: Candidate,
  options: IngestOptions,
  robots: Awaited<ReturnType<typeof loadRobots>>,
  result: SourceIngestResult,
): Promise<NewRawItem | null> {
  const feedTitle = stripHtml(candidate.item.title);
  const feedSummary = candidate.item.summary ? stripHtml(candidate.item.summary) : null;
  const publishedAt = toIsoDate(candidate.item.publishedAt);

  let title = feedTitle;
  let text = '';
  let summary = feedSummary;
  let author: string | null = null;
  let imageUrl: string | null = null;
  let language: string | null = null;
  let canonicalUrl: string | null = null;
  let extraction: NewRawItem['extraction'] = 'feed';
  let published = publishedAt;

  if (options.fullText) {
    if (!robots.isAllowed(candidate.url)) {
      result.errors.push(`${candidate.url}: robots.txt zabranjuje dohvatanje`);
    } else {
      try {
        const page = await fetchText(candidate.url, { accept: 'text/html' });
        if (page.ok) {
          const article = extractArticle(page.body, page.url);
          if (article.method !== 'none' && countWords(article.text) >= MIN_ARTICLE_WORDS) {
            text = article.text;
            extraction = article.method;
            result.extracted += 1;
            title = article.title ?? title;
            summary = article.excerpt ?? summary;
            author = article.author;
            imageUrl = article.imageUrl;
            language = article.language;
            canonicalUrl = article.canonicalUrl;
            published = toIsoDate(article.publishedAt) ?? published;
          }
        } else {
          result.errors.push(`${candidate.url}: HTTP ${page.status}`);
        }
      } catch (error) {
        const message = error instanceof FetchFailure ? error.message : String(error);
        result.errors.push(`${candidate.url}: ${message}`);
      }
    }
  }

  // Bez teksta ostaje ono sto je feed dao — naslov i kratak opis.
  if (!text) text = summary ?? '';
  if (!title) return null;

  return {
    source_id: source.id,
    url: candidate.url,
    canonical_url: canonicalUrl,
    url_hash: candidate.hash,
    content_hash: contentHash(title, text),
    title,
    summary,
    content: text || null,
    word_count: countWords(text),
    author,
    image_url: imageUrl,
    language,
    published_at: published,
    extraction: text ? extraction : 'none',
  };
}

/** Odbacuje linkove koji vode van domena izvora (reklame, partnerski sadrzaj). */
function sameSite(url: string, homepage: string): boolean {
  try {
    const target = new URL(url).hostname.replace(/^www\./, '');
    const home = new URL(homepage).hostname.replace(/^www\./, '');
    const targetRoot = target.split('.').slice(-2).join('.');
    const homeRoot = home.split('.').slice(-2).join('.');
    return targetRoot === homeRoot;
  } catch {
    return false;
  }
}

function publishedTime(item: FeedItem): number {
  const iso = toIsoDate(item.publishedAt);
  return iso ? new Date(iso).getTime() : 0;
}
