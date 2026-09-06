import { describe, expect, it } from 'vitest';
import { looksLikeSitemap, parseSitemap } from './sitemap.js';

const NEWS_SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  <url>
    <loc>https://primer.rs/vesti/prva</loc>
    <lastmod>2026-09-05T10:00:00+02:00</lastmod>
    <news:news>
      <news:publication><news:name>Primer</news:name><news:language>sr</news:language></news:publication>
      <news:publication_date>2026-09-05T09:45:00+02:00</news:publication_date>
      <news:title>Vlada usvojila budžet</news:title>
    </news:news>
  </url>
  <url>
    <loc>https://primer.rs/vesti/druga</loc>
    <lastmod>2026-09-05T08:00:00+02:00</lastmod>
  </url>
</urlset>`;

const INDEX = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://primer.rs/sitemap/news.xml</loc><lastmod>2026-09-05</lastmod></sitemap>
  <sitemap><loc>https://primer.rs/sitemap/arhiva-2019.xml</loc></sitemap>
</sitemapindex>`;

describe('looksLikeSitemap', () => {
  it('prepoznaje urlset i sitemapindex', () => {
    expect(looksLikeSitemap(NEWS_SITEMAP)).toBe(true);
    expect(looksLikeSitemap(INDEX)).toBe(true);
  });

  it('odbija HTML stranu', () => {
    expect(looksLikeSitemap('<!DOCTYPE html><html><body>404</body></html>')).toBe(false);
  });
});

describe('parseSitemap', () => {
  it('cita news sitemap sa naslovom i vremenom objave', () => {
    const parsed = parseSitemap(NEWS_SITEMAP);
    expect(parsed?.kind).toBe('urlset');
    expect(parsed?.entries).toHaveLength(2);
    expect(parsed?.entries[0]).toEqual({
      url: 'https://primer.rs/vesti/prva',
      lastModified: '2026-09-05T10:00:00+02:00',
      title: 'Vlada usvojila budžet',
      publishedAt: '2026-09-05T09:45:00+02:00',
    });
  });

  it('bez news oznaka pada na lastmod kao vreme objave', () => {
    const entry = parseSitemap(NEWS_SITEMAP)?.entries[1];
    expect(entry?.title).toBeNull();
    expect(entry?.publishedAt).toBe('2026-09-05T08:00:00+02:00');
  });

  it('prepoznaje indeks i vraca putanje ka drugim sitemap-ovima', () => {
    const parsed = parseSitemap(INDEX);
    expect(parsed?.kind).toBe('index');
    expect(parsed?.entries.map((entry) => entry.url)).toEqual([
      'https://primer.rs/sitemap/news.xml',
      'https://primer.rs/sitemap/arhiva-2019.xml',
    ]);
  });

  it('vraca null za sadrzaj koji nije sitemap i ne puca na losem XML-u', () => {
    expect(parseSitemap('<rss><channel></channel></rss>')).toBeNull();
    expect(() => parseSitemap('<urlset><url><loc>')).not.toThrow();
  });

  it('preskace unose bez adrese', () => {
    const parsed = parseSitemap(
      '<urlset><url><lastmod>2026-09-05</lastmod></url><url><loc>https://primer.rs/a</loc></url></urlset>',
    );
    expect(parsed?.entries).toHaveLength(1);
  });
});
