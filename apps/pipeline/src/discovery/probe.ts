import {
  createLogger,
  fetchText,
  FetchFailure,
  loadRobots,
  looksLikeFeed,
  newestItemDate,
  parseFeed,
  type FeedKind,
  type RobotsInfo,
  type Source,
} from '@ai-novine/core';
import { findFeedLinks, summarizeInternalLinks, type SegmentStat } from './html.js';

const log = createLogger('discover');

/** Putanje iz brief-a, plus nekoliko varijanti koje sajtovi cesto koriste. */
export const CANDIDATE_PATHS = [
  '/feed',
  '/feed/',
  '/rss',
  '/rss/',
  '/rss.xml',
  '/feed/rss2',
  '/atom.xml',
  '/index.xml',
  '/?feed=rss2',
] as const;

const SITEMAP_PATHS = [
  '/sitemap.xml',
  '/sitemap_index.xml',
  '/sitemap-news.xml',
  '/news-sitemap.xml',
] as const;

export type Verdict = 'rss' | 'sitemap' | 'scrape' | 'blocked' | 'error';
export type FeedOrigin = 'putanja' | 'html' | 'robots';

export interface FeedCandidate {
  requestedUrl: string;
  finalUrl: string;
  kind: FeedKind;
  title: string | null;
  itemCount: number;
  newestItemAt: string | null;
  discoveredVia: FeedOrigin;
}

export interface SitemapCandidate {
  url: string;
  isNewsSitemap: boolean;
  isIndex: boolean;
  entryCount: number;
}

export interface ProbeAttempt {
  url: string;
  outcome: string;
}

export interface SourceReport {
  id: string;
  name: string;
  angle: string;
  homepage: string;
  enabled: boolean;
  robots: {
    state: string;
    crawlDelaySeconds: number | null;
    declaredSitemaps: string[];
  };
  homepageStatus: number | null;
  feeds: FeedCandidate[];
  sitemaps: SitemapCandidate[];
  topSegments: SegmentStat[];
  attempts: ProbeAttempt[];
  notes: string[];
  verdict: Verdict;
  elapsedMs: number;
}

export async function probeSource(source: Source): Promise<SourceReport> {
  const startedAt = Date.now();
  const report: SourceReport = {
    id: source.id,
    name: source.name,
    angle: source.angle,
    homepage: source.homepage,
    enabled: source.enabled,
    robots: { state: 'nepoznato', crawlDelaySeconds: null, declaredSitemaps: [] },
    homepageStatus: null,
    feeds: [],
    sitemaps: [],
    topSegments: [],
    attempts: [],
    notes: [],
    verdict: 'error',
    elapsedMs: 0,
  };

  const robots = await loadRobots(source.homepage);
  report.robots.declaredSitemaps = robots.sitemaps;

  switch (robots.state.kind) {
    case 'ok':
      report.robots.state = 'dostupan';
      report.robots.crawlDelaySeconds = robots.state.crawlDelaySeconds;
      break;
    case 'missing':
      report.robots.state = 'ne postoji (sve dozvoljeno)';
      break;
    case 'blocked':
      report.robots.state = `blokiran (HTTP ${robots.state.status})`;
      report.notes.push(
        `Sajt odbija i sam robots.txt sa HTTP ${robots.state.status} — aktivno blokira botove. ` +
          'Ne dohvatamo dalje; zaobilazenje te zastite bilo bi krsenje uslova koriscenja.',
      );
      report.verdict = 'blocked';
      report.elapsedMs = Date.now() - startedAt;
      return report;
    case 'error':
      report.robots.state = `greska (${robots.state.message})`;
      report.notes.push('robots.txt nije dohvatljiv, pa se sajt ne dohvata dalje.');
      report.verdict = 'error';
      report.elapsedMs = Date.now() - startedAt;
      return report;
  }

  const seen = new Set<string>();

  // 1. Pocetna strana: HTML autodiscovery i mapa rubrika za scraping fallback.
  const homepage = await tryFetch(report, source.homepage, robots, 'text/html');
  if (homepage) {
    report.homepageStatus = homepage.status;
    if (homepage.ok) {
      report.topSegments = summarizeInternalLinks(homepage.body, homepage.url);
      for (const feedUrl of findFeedLinks(homepage.body, homepage.url)) {
        await checkFeed(report, feedUrl, robots, 'html', seen);
      }
    } else {
      report.notes.push(`Pocetna strana vraca HTTP ${homepage.status}.`);
    }
  }

  // 2. Standardne putanje.
  for (const path of CANDIDATE_PATHS) {
    if (report.feeds.length >= 3) break;
    await checkFeed(report, new URL(path, source.homepage).toString(), robots, 'putanja', seen);
  }

  // 3. Sitemap-ovi koje sam robots.txt prijavljuje.
  for (const sitemapUrl of robots.sitemaps.slice(0, 3)) {
    await checkSitemap(report, sitemapUrl, robots);
  }

  // 4. Standardne sitemap putanje — vrede tek ako RSS ne postoji.
  if (report.feeds.length === 0) {
    for (const path of SITEMAP_PATHS) {
      if (report.sitemaps.some((entry) => entry.isNewsSitemap)) break;
      await checkSitemap(report, new URL(path, source.homepage).toString(), robots);
    }
  }

  report.verdict = decideVerdict(report);
  report.elapsedMs = Date.now() - startedAt;
  log.info(`${source.name}: ${report.verdict}`, {
    feedova: report.feeds.length,
    sitemapova: report.sitemaps.length,
    ms: report.elapsedMs,
  });
  return report;
}

function decideVerdict(report: SourceReport): Verdict {
  if (report.feeds.some((feed) => feed.itemCount > 0)) return 'rss';
  // Prazan news sitemap ne vredi nista — ima ih koji stoje na sajtu bez ijednog unosa.
  if (report.sitemaps.some((entry) => entry.isNewsSitemap && entry.entryCount > 0)) {
    return 'sitemap';
  }
  if (report.homepageStatus === 403 || report.homepageStatus === 429) return 'blocked';
  if (report.homepageStatus !== null && report.homepageStatus < 400) return 'scrape';
  return 'error';
}

async function tryFetch(report: SourceReport, url: string, robots: RobotsInfo, accept: string) {
  if (!robots.isAllowed(url)) {
    report.attempts.push({ url, outcome: 'preskoceno — robots.txt zabranjuje' });
    return null;
  }

  try {
    return await fetchText(url, { accept });
  } catch (error) {
    const message = error instanceof FetchFailure ? error.message : String(error);
    report.attempts.push({ url, outcome: `greska — ${message}` });
    return null;
  }
}

async function checkFeed(
  report: SourceReport,
  url: string,
  robots: RobotsInfo,
  via: FeedOrigin,
  seen: Set<string>,
): Promise<void> {
  const key = normalize(url);
  if (seen.has(key)) return;

  // Provera robots.txt ide PRE upisa u `seen`. Inace bi zabranjeni
  // `https://primer.rs/feed/` zauzeo mesto i dozvoljenom `https://primer.rs/feed`,
  // jer se u `seen` cuva putanja bez zavrsne kose crte.
  if (!robots.isAllowed(url)) {
    report.attempts.push({ url, outcome: 'preskoceno — robots.txt zabranjuje' });
    return;
  }
  seen.add(key);

  const response = await tryFetch(report, url, robots, 'application/rss+xml, application/xml');
  if (!response) return;

  if (!response.ok) {
    report.attempts.push({ url, outcome: `HTTP ${response.status}` });
    return;
  }

  const finalKey = normalize(response.url);
  if (finalKey !== key) {
    if (seen.has(finalKey)) return;
    seen.add(finalKey);
  }

  if (!looksLikeFeed(response.body, response.contentType)) {
    report.attempts.push({
      url,
      outcome: 'HTTP 200 ali sadrzaj nije feed (verovatno obicna HTML strana)',
    });
    return;
  }

  const feed = parseFeed(response.body);
  if (!feed) {
    report.attempts.push({ url, outcome: 'HTTP 200, XML se ne parsira kao RSS/Atom' });
    return;
  }

  const newest = newestItemDate(feed);
  report.feeds.push({
    requestedUrl: url,
    finalUrl: response.url,
    kind: feed.kind,
    title: feed.title,
    itemCount: feed.items.length,
    newestItemAt: newest ? newest.toISOString() : null,
    discoveredVia: via,
  });
  report.attempts.push({ url, outcome: `feed (${feed.kind}, ${feed.items.length} stavki)` });
}

async function checkSitemap(
  report: SourceReport,
  url: string,
  robots: RobotsInfo,
  depth = 0,
): Promise<void> {
  if (report.sitemaps.some((entry) => normalize(entry.url) === normalize(url))) return;

  const response = await tryFetch(report, url, robots, 'application/xml');
  if (!response) return;

  if (!response.ok) {
    report.attempts.push({ url, outcome: `HTTP ${response.status}` });
    return;
  }

  const body = response.body;
  if (!body.trimStart().startsWith('<')) {
    report.attempts.push({ url, outcome: 'nije XML' });
    return;
  }

  // Poneki sajt na /sitemap.xml servira RSS — proveri i tu mogucnost.
  if (looksLikeFeed(body, response.contentType)) {
    const feed = parseFeed(body);
    if (feed && feed.items.length > 0) {
      const newest = newestItemDate(feed);
      report.feeds.push({
        requestedUrl: url,
        finalUrl: response.url,
        kind: feed.kind,
        title: feed.title,
        itemCount: feed.items.length,
        newestItemAt: newest ? newest.toISOString() : null,
        discoveredVia: 'robots',
      });
      report.attempts.push({ url, outcome: `feed (${feed.kind}, ${feed.items.length} stavki)` });
      return;
    }
  }

  const isNews =
    /<news:news[\s>]/i.test(body) ||
    /xmlns:news\s*=/i.test(body) ||
    /news[-_./]?sitemap|sitemap[-_./]?news/i.test(url);
  const isIndex = /<sitemapindex[\s>]/i.test(body);
  const entryCount = (body.match(/<(url|sitemap)>/gi) ?? []).length;

  report.sitemaps.push({ url: response.url, isNewsSitemap: isNews, isIndex, entryCount });
  report.attempts.push({
    url,
    outcome: `sitemap (${isIndex ? 'indeks' : 'urlset'}${isNews ? ', news' : ''}, ${entryCount} unosa)`,
  });

  // Sitemap indeks sam po sebi ne nosi vesti — news sitemap je jedno dete nize.
  if (isIndex && depth === 0 && !isNews) {
    const children = [...body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)]
      .map((match) => match[1])
      .filter((child): child is string => Boolean(child))
      .filter((child) => /news|stories|latest|vesti|clanci|post/i.test(child))
      .slice(0, 2);

    for (const child of children) {
      await checkSitemap(report, child, robots, depth + 1);
    }
  }
}

function normalize(url: string): string {
  return url.replace(/\/+$/, '').toLowerCase();
}
