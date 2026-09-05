import { XMLParser } from 'fast-xml-parser';

export type FeedKind = 'rss' | 'atom' | 'rdf';

export interface FeedItem {
  title: string;
  link: string | null;
  publishedAt: string | null;
  summary: string | null;
}

export interface ParsedFeed {
  kind: FeedKind;
  title: string | null;
  items: FeedItem[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  parseTagValue: false,
  processEntities: true,
});

/** Gruba provera pre parsiranja — mnogi sajtovi na `/feed` vrate obicnu HTML stranu. */
export function looksLikeFeed(body: string, contentType: string | null): boolean {
  const head = body.slice(0, 1000).trimStart().toLowerCase();
  if (head.startsWith('<!doctype html') || head.startsWith('<html')) return false;

  const hasFeedRoot = /<(rss|feed|rdf:rdf)[\s>]/i.test(body.slice(0, 4000));
  if (hasFeedRoot) return true;

  const type = contentType?.toLowerCase() ?? '';
  return type.includes('xml') && body.trimStart().startsWith('<');
}

/** Vraca `null` ako sadrzaj nije feed koji umemo da procitamo. */
export function parseFeed(xml: string): ParsedFeed | null {
  let document: Record<string, unknown>;
  try {
    document = parser.parse(xml) as Record<string, unknown>;
  } catch {
    return null;
  }

  const rss = asRecord(document['rss']);
  if (rss) {
    const channel = asRecord(rss['channel']);
    if (channel) {
      return {
        kind: 'rss',
        title: asText(channel['title']),
        items: toArray(channel['item']).map(readRssItem),
      };
    }
  }

  const rdf = asRecord(document['rdf:RDF'] ?? document['RDF']);
  if (rdf) {
    return {
      kind: 'rdf',
      title: asText(asRecord(rdf['channel'])?.['title']),
      items: toArray(rdf['item']).map(readRssItem),
    };
  }

  const atom = asRecord(document['feed']);
  if (atom) {
    return {
      kind: 'atom',
      title: asText(atom['title']),
      items: toArray(atom['entry']).map(readAtomEntry),
    };
  }

  return null;
}

/** Najsvezija stavka u feedu — pokazuje da li se feed uopste jos puni. */
export function newestItemDate(feed: ParsedFeed): Date | null {
  let newest: Date | null = null;
  for (const item of feed.items) {
    if (!item.publishedAt) continue;
    const date = new Date(item.publishedAt);
    if (Number.isNaN(date.getTime())) continue;
    if (!newest || date > newest) newest = date;
  }
  return newest;
}

function readRssItem(raw: unknown): FeedItem {
  const item = asRecord(raw) ?? {};
  return {
    title: asText(item['title']) ?? '',
    link: asText(item['link']) ?? asText(asRecord(item['guid'])?.['#text']) ?? null,
    publishedAt: asText(item['pubDate']) ?? asText(item['dc:date']) ?? null,
    summary: asText(item['description']) ?? null,
  };
}

function readAtomEntry(raw: unknown): FeedItem {
  const entry = asRecord(raw) ?? {};
  return {
    title: asText(entry['title']) ?? '',
    link: readAtomLink(entry['link']),
    publishedAt: asText(entry['published']) ?? asText(entry['updated']) ?? null,
    summary: asText(entry['summary']) ?? asText(entry['content']) ?? null,
  };
}

function readAtomLink(raw: unknown): string | null {
  const links = toArray(raw)
    .map((value) => asRecord(value))
    .filter((value): value is Record<string, unknown> => value !== null);

  const alternate = links.find((link) => (link['@_rel'] ?? 'alternate') === 'alternate');
  const chosen = alternate ?? links[0];
  return chosen ? (asText(chosen['@_href']) ?? null) : (asText(raw) ?? null);
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
