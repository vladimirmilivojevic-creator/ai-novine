import {
  createLogger,
  fetchText,
  FetchFailure,
  loadRobots,
  looksLikeFeed,
  looksLikeSitemap,
  parseFeed,
  parseSitemap,
  type RobotsInfo,
  type SitemapEntry,
  type Source,
} from '@ai-novine/core';
import {
  existingContentHashes,
  existingUrlHashes,
  getFetchStates,
  insertRawItems,
  saveFetchState,
  type FetchStateRow,
  type NewRawItem,
} from '@ai-novine/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseHTML } from 'linkedom';
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
  /** Odakle su stigli kandidati u ovom ciklusu. */
  channel: 'feed' | 'sitemap' | 'scrape' | 'nista';
  checked: number;
  unchanged: number;
  candidates: number;
  newUrls: number;
  extracted: number;
  inserted: number;
  duplicates: number;
  errors: string[];
}

interface Candidate {
  url: string;
  hash: string;
  title: string;
  summary: string | null;
  publishedAt: string | null;
}

export async function ingestSource(
  client: SupabaseClient,
  source: Source,
  options: IngestOptions,
): Promise<SourceIngestResult> {
  const result: SourceIngestResult = {
    sourceId: source.id,
    channel: 'nista',
    checked: 0,
    unchanged: 0,
    candidates: 0,
    newUrls: 0,
    extracted: 0,
    inserted: 0,
    duplicates: 0,
    errors: [],
  };

  if (source.feeds.length === 0 && source.newsSitemaps.length === 0 && !source.scrape) {
    result.errors.push('Izvor nema nijedan kanal u config/sources.json.');
    return result;
  }

  const robots = await loadRobots(source.homepage);
  const fetchStates = await getFetchStates(client, [...source.feeds, ...source.newsSitemaps]);
  const candidates = new Map<string, Candidate>();

  // Redosled kanala ide od najurednijeg ka najkrhkijem: RSS, pa sitemap, pa
  // citanje linkova sa rubrika. Sledeci se koristi samo ako prethodni nije dao
  // nista — tako pad jednog kanala ne gasi izvor, a ne udvostrucuje se saobracaj.
  await collectFromFeeds(client, source, fetchStates, candidates, result);
  if (candidates.size > 0) result.channel = 'feed';

  if (candidates.size === 0 && source.newsSitemaps.length > 0) {
    await collectFromSitemaps(client, source, robots, fetchStates, candidates, result);
    if (candidates.size > 0) result.channel = 'sitemap';
  }

  if (candidates.size === 0 && source.scrape) {
    await collectFromListings(client, source, robots, fetchStates, candidates, result);
    if (candidates.size > 0) result.channel = 'scrape';
  }

  result.candidates = candidates.size;
  if (candidates.size === 0) return result;

  // ── Sta je vec u bazi ──────────────────────────────────────────────────────
  const all = [...candidates.values()];
  const known = await existingUrlHashes(
    client,
    all.map((candidate) => candidate.hash),
  );

  const fresh = all
    .filter((candidate) => !known.has(candidate.hash))
    .sort((a, b) => timeOf(b.publishedAt) - timeOf(a.publishedAt))
    .slice(0, options.maxItemsPerSource);

  result.newUrls = fresh.length;
  if (fresh.length === 0) return result;

  // ── Tekst clanka ───────────────────────────────────────────────────────────
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

  // ── Upis ───────────────────────────────────────────────────────────────────
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
    kanal: result.channel,
    proverenih: result.checked,
    nepromenjenih: result.unchanged,
    kandidata: result.candidates,
    novihUrl: result.newUrls,
    duplikata: result.duplicates,
    gresaka: result.errors.length,
  });

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// RSS
// ─────────────────────────────────────────────────────────────────────────────

async function collectFromFeeds(
  client: SupabaseClient,
  source: Source,
  states: Map<string, FetchStateRow>,
  candidates: Map<string, Candidate>,
  result: SourceIngestResult,
): Promise<void> {
  for (const feedUrl of source.feeds) {
    result.checked += 1;

    const response = await conditionalGet(client, source, feedUrl, states, result, {
      accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.5',
    });
    if (!response) continue;

    if (!looksLikeFeed(response.body, response.contentType)) {
      result.errors.push(`${feedUrl}: odgovor nije feed`);
      continue;
    }

    const feed = parseFeed(response.body);
    if (!feed) {
      result.errors.push(`${feedUrl}: XML se ne parsira kao RSS/Atom`);
      continue;
    }

    for (const item of feed.items) {
      if (!item.link || !item.title) continue;
      addCandidate(candidates, source, feedUrl, {
        link: item.link,
        title: item.title,
        summary: item.summary,
        publishedAt: item.publishedAt,
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// News sitemap — rezervni kanal za izvore bez RSS-a
// ─────────────────────────────────────────────────────────────────────────────

async function collectFromSitemaps(
  client: SupabaseClient,
  source: Source,
  robots: RobotsInfo,
  states: Map<string, FetchStateRow>,
  candidates: Map<string, Candidate>,
  result: SourceIngestResult,
): Promise<void> {
  for (const sitemapUrl of source.newsSitemaps) {
    result.checked += 1;

    const response = await conditionalGet(client, source, sitemapUrl, states, result, {
      accept: 'application/xml, text/xml;q=0.9',
    });
    if (!response) continue;

    if (!looksLikeSitemap(response.body)) {
      result.errors.push(`${sitemapUrl}: odgovor nije sitemap`);
      continue;
    }

    const sitemap = parseSitemap(response.body);
    if (!sitemap) {
      result.errors.push(`${sitemapUrl}: XML se ne parsira kao sitemap`);
      continue;
    }

    // Indeks ne nosi clanke nego pokazuje na sitemap-ove koji ih nose.
    const entries =
      sitemap.kind === 'urlset'
        ? sitemap.entries
        : await followSitemapIndex(sitemap.entries, robots, result);

    for (const entry of entries) {
      addCandidate(candidates, source, sitemapUrl, {
        link: entry.url,
        title: entry.title ?? '',
        summary: null,
        publishedAt: entry.publishedAt,
      });
    }
  }
}

async function followSitemapIndex(
  entries: SitemapEntry[],
  robots: RobotsInfo,
  result: SourceIngestResult,
): Promise<SitemapEntry[]> {
  const children = entries
    .map((entry) => entry.url)
    .filter((url) => /news|vesti|latest|stories/i.test(url))
    .slice(0, 2);

  const collected: SitemapEntry[] = [];

  for (const child of children) {
    if (!robots.isAllowed(child)) continue;
    try {
      const response = await fetchText(child, { accept: 'application/xml' });
      if (!response.ok) continue;

      const parsed = parseSitemap(response.body);
      if (parsed?.kind === 'urlset') collected.push(...parsed.entries);
    } catch (error) {
      const message = error instanceof FetchFailure ? error.message : String(error);
      result.errors.push(`${child}: ${message}`);
    }
  }
  return collected;
}

// ─────────────────────────────────────────────────────────────────────────────
// Citanje linkova sa rubrika — poslednji izlaz, za izvore bez RSS-a i sitemap-a
// ─────────────────────────────────────────────────────────────────────────────

async function collectFromListings(
  client: SupabaseClient,
  source: Source,
  robots: RobotsInfo,
  states: Map<string, FetchStateRow>,
  candidates: Map<string, Candidate>,
  result: SourceIngestResult,
): Promise<void> {
  const scrape = source.scrape;
  if (!scrape) return;

  let pattern: RegExp;
  try {
    pattern = new RegExp(scrape.linkPattern);
  } catch {
    result.errors.push(`linkPattern nije ispravan regularni izraz: ${scrape.linkPattern}`);
    return;
  }

  for (const listingUrl of scrape.listingUrls) {
    if (candidates.size >= scrape.maxLinksPerRun) break;
    result.checked += 1;

    if (!robots.isAllowed(listingUrl)) {
      result.errors.push(`${listingUrl}: robots.txt zabranjuje`);
      continue;
    }

    const response = await conditionalGet(client, source, listingUrl, states, result, {
      accept: 'text/html',
    });
    if (!response) continue;

    const { document } = parseHTML(response.body);
    for (const anchor of document.querySelectorAll(scrape.itemLinkSelector)) {
      if (candidates.size >= scrape.maxLinksPerRun) break;

      const href = anchor.getAttribute('href');
      if (!href) continue;

      const canonical = canonicalizeUrl(href, listingUrl);
      if (!canonical) continue;
      if (!pattern.test(new URL(canonical).pathname)) continue;

      addCandidate(candidates, source, listingUrl, {
        link: canonical,
        title: anchor.textContent ?? '',
        summary: null,
        publishedAt: null,
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Zajednicko
// ─────────────────────────────────────────────────────────────────────────────

/** Dohvatanje uz ETag / Last-Modified. `null` znaci „nema novog sadrzaja". */
async function conditionalGet(
  client: SupabaseClient,
  source: Source,
  url: string,
  states: Map<string, FetchStateRow>,
  result: SourceIngestResult,
  options: { accept: string },
): Promise<{ body: string; contentType: string | null } | null> {
  const state = states.get(url);
  const headers: Record<string, string> = {};
  if (state?.etag) headers['if-none-match'] = state.etag;
  if (state?.last_modified) headers['if-modified-since'] = state.last_modified;

  let response;
  try {
    response = await fetchText(url, { accept: options.accept, headers });
  } catch (error) {
    const message = error instanceof FetchFailure ? error.message : String(error);
    result.errors.push(`${url}: ${message}`);
    return null;
  }

  if (response.status === 304) {
    result.unchanged += 1;
    await saveFetchState(client, {
      url,
      sourceId: source.id,
      etag: state?.etag ?? null,
      lastModified: state?.last_modified ?? null,
      status: 304,
      changed: false,
    });
    return null;
  }

  if (!response.ok) {
    result.errors.push(`${url}: HTTP ${response.status}`);
    return null;
  }

  await saveFetchState(client, {
    url,
    sourceId: source.id,
    etag: response.etag,
    lastModified: response.lastModified,
    status: response.status,
    changed: true,
  });

  return { body: response.body, contentType: response.contentType };
}

function addCandidate(
  candidates: Map<string, Candidate>,
  source: Source,
  baseUrl: string,
  raw: { link: string; title: string; summary: string | null; publishedAt: string | null },
): void {
  const canonical = canonicalizeUrl(raw.link, baseUrl);
  if (!canonical) return;

  // Link mora da pripada izvoru — ili domenu iz konfiguracije, ili domenu sa
  // koga je kanal stvarno posluzen. Drugo je vazno kod izvora koji preusmerava
  // na drugi domen (srbijadanas.com salje na sd.rs), gde bi poredjenje samo sa
  // konfiguracijom odbacilo sve clanke tog izvora.
  if (!sameSite(canonical, source.homepage) && !sameSite(canonical, baseUrl)) return;

  candidates.set(canonical, {
    url: canonical,
    hash: urlHash(canonical),
    title: stripHtml(raw.title),
    summary: raw.summary ? stripHtml(raw.summary) : null,
    publishedAt: toIsoDate(raw.publishedAt),
  });
}

async function buildRow(
  source: Source,
  candidate: Candidate,
  options: IngestOptions,
  robots: RobotsInfo,
  result: SourceIngestResult,
): Promise<NewRawItem | null> {
  let title = candidate.title;
  let summary = candidate.summary;
  let text = '';
  let author: string | null = null;
  let imageUrl: string | null = null;
  let language: string | null = null;
  let canonicalUrl: string | null = null;
  let extraction: NewRawItem['extraction'] = 'feed';
  let published = candidate.publishedAt;

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

  // Bez teksta ostaje ono sto je kanal dao — naslov i kratak opis. Ali red bez
  // teksta i sa kratkim naslovom nije vest nego ostatak strane („Vise", „Foto"),
  // i takav se ne upisuje.
  if (!text) text = summary ?? '';
  if (!title) return null;
  if (!text && title.length < 15) return null;

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
    return rootDomain(new URL(url).hostname) === rootDomain(new URL(homepage).hostname);
  } catch {
    return false;
  }
}

function rootDomain(hostname: string): string {
  return hostname
    .replace(/^www\./, '')
    .split('.')
    .slice(-2)
    .join('.');
}

function timeOf(iso: string | null): number {
  return iso ? new Date(iso).getTime() : 0;
}
