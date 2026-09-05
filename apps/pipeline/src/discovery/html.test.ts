import { describe, expect, it } from 'vitest';
import { findFeedLinks, summarizeInternalLinks } from './html.js';

describe('findFeedLinks', () => {
  it('nalazi RSS i Atom autodiscovery linkove i pretvara ih u apsolutne', () => {
    const html = `<html><head>
      <link rel="alternate" type="application/rss+xml" title="Vesti" href="/feed/">
      <link rel="alternate" type="application/atom+xml" href="https://drugi.rs/atom.xml">
      <link rel="stylesheet" href="/style.css">
      <link rel="alternate" type="application/json" href="/wp-json/">
    </head></html>`;

    expect(findFeedLinks(html, 'https://primer.rs')).toEqual([
      'https://primer.rs/feed/',
      'https://drugi.rs/atom.xml',
    ]);
  });

  it('podnosi jednostruke navodnike i razmake u atributima', () => {
    const html = `<link rel = 'alternate'  type = 'application/rss+xml'  href = '/rss' >`;
    expect(findFeedLinks(html, 'https://primer.rs')).toEqual(['https://primer.rs/rss']);
  });

  it('ne vraca nista kad autodiscovery linka nema', () => {
    expect(findFeedLinks('<html><head></head></html>', 'https://primer.rs')).toEqual([]);
  });
});

describe('summarizeInternalLinks', () => {
  const html = `<html><body>
    <a href="/politika/vesti/1">Jedan</a>
    <a href="/politika/vesti/2">Dva</a>
    <a href="/politika/vesti/3">Tri</a>
    <a href="/sport/fudbal/1">Fudbal</a>
    <a href="https://drugi.rs/politika/nesto">Drugi sajt</a>
    <a href="/tag/izbori/1">Tag</a>
    <a href="/kontakt">Kontakt bez druge putanje</a>
    <a href="#vrh">Sidro</a>
  </body></html>`;

  it('grupise linkove po prvom segmentu putanje i broji ih', () => {
    const segments = summarizeInternalLinks(html, 'https://primer.rs');
    expect(segments[0]).toMatchObject({ segment: 'politika', count: 3 });
    expect(segments[1]).toMatchObject({ segment: 'sport', count: 1 });
  });

  it('preskace strane domene, sidra, tagove i putanje bez druge komponente', () => {
    const segments = summarizeInternalLinks(html, 'https://primer.rs');
    const names = segments.map((segment) => segment.segment);
    expect(names).not.toContain('tag');
    expect(names).not.toContain('kontakt');
    expect(segments.every((segment) => segment.sample.startsWith('https://primer.rs'))).toBe(true);
  });

  it('postuje zadatu granicu broja rubrika', () => {
    const many = Array.from({ length: 10 }, (_, index) => `<a href="/r${index}/clanak">x</a>`).join(
      '',
    );
    expect(summarizeInternalLinks(many, 'https://primer.rs', 3)).toHaveLength(3);
  });
});
