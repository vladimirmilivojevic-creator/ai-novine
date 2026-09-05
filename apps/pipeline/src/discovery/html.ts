/**
 * Citanje HTML-a bez pravog DOM parsera. Za Fazu 1 nam trebaju samo `<link>`
 * elementi u zaglavlju i spisak linkova sa pocetne strane, a to su dva uzorka
 * koja se pouzdano pokrivaju regularnim izrazom. Pravi parser (`linkedom`)
 * ulazi u igru u Fazi 2, kad se iz clanka vadi tekst.
 */

const LINK_TAG = /<link\b[^>]*>/gi;
const ANCHOR_HREF = /<a\b[^>]*\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;

function readAttribute(tag: string, name: string): string | null {
  const attribute = new RegExp(String.raw`\b${name}\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))`, 'i');
  const match = attribute.exec(tag);
  if (!match) return null;
  return (match[2] ?? match[3] ?? match[4] ?? '').trim() || null;
}

/** URL-ovi iz `<link rel="alternate" type="application/rss+xml">` i atom varijante. */
export function findFeedLinks(html: string, baseUrl: string): string[] {
  const found = new Set<string>();

  for (const [tag] of html.matchAll(LINK_TAG)) {
    const rel = readAttribute(tag, 'rel')?.toLowerCase() ?? '';
    const type = readAttribute(tag, 'type')?.toLowerCase() ?? '';
    const href = readAttribute(tag, 'href');
    if (!href) continue;

    const isFeedType = type.includes('rss') || type.includes('atom') || type.includes('rdf');
    if (!isFeedType || !rel.includes('alternate')) continue;

    const absolute = toAbsolute(href, baseUrl);
    if (absolute) found.add(absolute);
  }

  return [...found];
}

export interface SegmentStat {
  segment: string;
  count: number;
  sample: string;
}

/**
 * Grupise linkove sa pocetne strane po prvom segmentu putanje. Segment koji se
 * ponavlja na desetinama linkova je gotovo uvek rubrika sajta — to je polazna
 * tacka za scraping fallback kod izvora bez RSS-a.
 */
export function summarizeInternalLinks(html: string, baseUrl: string, limit = 6): SegmentStat[] {
  const base = new URL(baseUrl);
  const counts = new Map<string, { count: number; sample: string }>();

  for (const match of html.matchAll(ANCHOR_HREF)) {
    const href = (match[2] ?? match[3] ?? match[4] ?? '').trim();
    if (!href || href.startsWith('#')) continue;

    const absolute = toAbsolute(href, baseUrl);
    if (!absolute) continue;

    const url = new URL(absolute);
    if (url.host !== base.host) continue;

    const segments = url.pathname.split('/').filter(Boolean);
    const first = segments[0];
    if (!first || segments.length < 2) continue;
    if (IGNORED_SEGMENTS.has(first.toLowerCase())) continue;

    const entry = counts.get(first);
    if (entry) entry.count += 1;
    else counts.set(first, { count: 1, sample: absolute });
  }

  return [...counts.entries()]
    .map(([segment, entry]) => ({ segment, count: entry.count, sample: entry.sample }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

const IGNORED_SEGMENTS = new Set([
  'tag',
  'tags',
  'author',
  'autor',
  'autori',
  'wp-content',
  'wp-json',
  'wp-admin',
  'static',
  'assets',
  'images',
  'img',
  'media',
  'user',
  'korisnik',
  'search',
  'pretraga',
  'login',
  'prijava',
  'newsletter',
  'kontakt',
  'impressum',
  'impresum',
]);

function toAbsolute(href: string, baseUrl: string): string | null {
  try {
    const url = new URL(href, baseUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}
