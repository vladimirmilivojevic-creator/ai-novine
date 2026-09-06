import { XMLParser } from 'fast-xml-parser';

/**
 * News sitemap je uredan XML sa svezim clancima, vremenom objave i naslovom —
 * za portale bez RSS-a bolji izvor od bilo kakvog scraping-a HTML-a.
 * Format: https://www.google.com/schemas/sitemap-news/0.9
 */

export interface SitemapEntry {
  url: string;
  lastModified: string | null;
  /** Naslov iz `<news:title>`, kad ga sitemap nudi. */
  title: string | null;
  publishedAt: string | null;
}

export interface ParsedSitemap {
  /** `index` pokazuje na druge sitemap-ove, `urlset` na same stranice. */
  kind: 'index' | 'urlset';
  entries: SitemapEntry[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  parseTagValue: false,
  processEntities: true,
  removeNSPrefix: false,
});

export function looksLikeSitemap(body: string): boolean {
  return /<(urlset|sitemapindex)[\s>]/i.test(body.slice(0, 4000));
}

export function parseSitemap(xml: string): ParsedSitemap | null {
  let document: Record<string, unknown>;
  try {
    document = parser.parse(xml) as Record<string, unknown>;
  } catch {
    return null;
  }

  const index = asRecord(document['sitemapindex']);
  if (index) {
    return {
      kind: 'index',
      entries: toArray(index['sitemap']).map(readEntry).filter(hasUrl),
    };
  }

  const urlset = asRecord(document['urlset']);
  if (urlset) {
    return {
      kind: 'urlset',
      entries: toArray(urlset['url']).map(readEntry).filter(hasUrl),
    };
  }

  return null;
}

function readEntry(raw: unknown): SitemapEntry {
  const node = asRecord(raw) ?? {};
  const news = asRecord(node['news:news'] ?? node['news']);

  return {
    url: asText(node['loc']) ?? '',
    lastModified: asText(node['lastmod']),
    title: news ? asText(news['news:title'] ?? news['title']) : null,
    publishedAt: news
      ? (asText(news['news:publication_date'] ?? news['publication_date']) ??
        asText(node['lastmod']))
      : asText(node['lastmod']),
  };
}

function hasUrl(entry: SitemapEntry): boolean {
  return entry.url.length > 0;
}

function toArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return String(value);
  const record = asRecord(value);
  if (record && typeof record['#text'] === 'string') return record['#text'].trim() || null;
  return null;
}
