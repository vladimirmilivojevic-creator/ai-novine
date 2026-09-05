import { describe, expect, it } from 'vitest';
import { looksLikeFeed, newestItemDate, parseFeed } from './feed.js';

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test portal</title>
    <item>
      <title>Prva vest</title>
      <link>https://primer.rs/prva</link>
      <pubDate>Sat, 05 Sep 2026 10:00:00 +0200</pubDate>
      <description>Kratak opis</description>
    </item>
    <item>
      <title>Druga vest</title>
      <link>https://primer.rs/druga</link>
      <pubDate>Sat, 05 Sep 2026 12:30:00 +0200</pubDate>
    </item>
  </channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom portal</title>
  <entry>
    <title>Atom vest</title>
    <link rel="edit" href="https://primer.rs/edit/1"/>
    <link rel="alternate" href="https://primer.rs/atom-vest"/>
    <published>2026-09-05T08:00:00Z</published>
    <summary>Sazetak</summary>
  </entry>
</feed>`;

const RDF = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/">
  <channel><title>RDF portal</title></channel>
  <item>
    <title>RDF vest</title>
    <link>https://primer.rs/rdf-vest</link>
    <dc:date>2026-09-04T22:15:00Z</dc:date>
  </item>
</rdf:RDF>`;

describe('looksLikeFeed', () => {
  it('odbija HTML stranu koju sajtovi vracaju na /feed', () => {
    expect(looksLikeFeed('<!DOCTYPE html><html><body>404</body></html>', 'text/html')).toBe(false);
  });

  it('prihvata RSS i Atom bez obzira na content-type', () => {
    expect(looksLikeFeed(RSS, null)).toBe(true);
    expect(looksLikeFeed(ATOM, 'application/octet-stream')).toBe(true);
  });
});

describe('parseFeed', () => {
  it('cita RSS 2.0 kanal', () => {
    const feed = parseFeed(RSS);
    expect(feed?.kind).toBe('rss');
    expect(feed?.title).toBe('Test portal');
    expect(feed?.items).toHaveLength(2);
    expect(feed?.items[0]?.link).toBe('https://primer.rs/prva');
    expect(feed?.items[0]?.summary).toBe('Kratak opis');
  });

  it('cita Atom i bira alternate link, ne prvi po redu', () => {
    const feed = parseFeed(ATOM);
    expect(feed?.kind).toBe('atom');
    expect(feed?.items[0]?.link).toBe('https://primer.rs/atom-vest');
    expect(feed?.items[0]?.publishedAt).toBe('2026-09-05T08:00:00Z');
  });

  it('cita RDF (RSS 1.0)', () => {
    const feed = parseFeed(RDF);
    expect(feed?.kind).toBe('rdf');
    expect(feed?.items[0]?.title).toBe('RDF vest');
  });

  it('vraca null za sadrzaj koji nije feed', () => {
    expect(parseFeed('<html><body>nista</body></html>')).toBeNull();
  });

  it('ne puca na neispravnom XML-u', () => {
    expect(() => parseFeed('<rss><channel><item>')).not.toThrow();
  });
});

describe('newestItemDate', () => {
  it('vraca najsvezi datum u feedu, bez obzira na redosled stavki', () => {
    const feed = parseFeed(RSS);
    expect(feed).not.toBeNull();
    expect(newestItemDate(feed!)?.toISOString()).toBe('2026-09-05T10:30:00.000Z');
  });

  it('vraca null kad nijedna stavka nema upotrebljiv datum', () => {
    const feed = parseFeed(`<rss><channel><item><title>Bez datuma</title></item></channel></rss>`);
    expect(feed).not.toBeNull();
    expect(newestItemDate(feed!)).toBeNull();
  });
});
