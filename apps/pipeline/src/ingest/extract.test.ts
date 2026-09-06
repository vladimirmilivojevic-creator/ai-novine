import { describe, expect, it } from 'vitest';
import { extractArticle } from './extract.js';

const ARTICLE_HTML = `<!DOCTYPE html>
<html lang="sr">
<head>
  <title>Vlada usvojila budžet za narednu godinu - Primer portal</title>
  <link rel="canonical" href="/vesti/budzet-2027">
  <meta property="og:title" content="Vlada usvojila budžet za narednu godinu">
  <meta property="og:description" content="Sednica je trajala četiri sata.">
  <meta property="og:image" content="/slike/sednica.jpg">
  <meta property="article:published_time" content="2026-09-05T09:30:00+02:00">
  <meta name="author" content="Redakcija">
</head>
<body>
  <nav><a href="/politika">Politika</a><a href="/sport">Sport</a></nav>
  <article>
    <h1>Vlada usvojila budžet za narednu godinu</h1>
    <p>Vlada je na današnjoj sednici usvojila predlog budžeta za narednu godinu, nakon rasprave
    koja je trajala četiri sata. Predlog sada ide u skupštinsku proceduru, gde se očekuje da
    bude razmatran tokom naredne dve nedelje.</p>
    <p>Prema predlogu, najveći deo sredstava usmeren je na infrastrukturu i zdravstvo. Ministar
    finansija je rekao da su projekcije prihoda konzervativne i da ostavljaju prostor za
    nepredviđene troškove tokom godine.</p>
    <p>Opozicioni poslanici najavili su amandmane, tvrdeći da predlog ne odgovara na pitanje
    zaduženja. Rasprava u skupštini zakazana je za sledeći utorak, a glasanje se očekuje do
    kraja meseca.</p>
  </article>
  <footer>Sva prava zadržana.</footer>
</body>
</html>`;

describe('extractArticle', () => {
  const result = extractArticle(ARTICLE_HTML, 'https://primer.rs/vesti/budzet-2027?utm_source=fb');

  it('izvlaci tekst clanka', () => {
    expect(result.method).toBe('readability');
    expect(result.text).toContain('usvojila predlog budžeta');
    expect(result.text).toContain('Rasprava u skupštini');
  });

  it('ne uvlaci navigaciju i podnozje u tekst', () => {
    expect(result.text).not.toContain('Sva prava zadržana');
    expect(result.text).not.toMatch(/^Politika\s*Sport/);
  });

  it('cita naslov bez repa sa imenom portala', () => {
    expect(result.title).toBe('Vlada usvojila budžet za narednu godinu');
  });

  it('razresava relativne adrese slike i canonical linka', () => {
    expect(result.imageUrl).toBe('https://primer.rs/slike/sednica.jpg');
    expect(result.canonicalUrl).toBe('https://primer.rs/vesti/budzet-2027');
  });

  it('cita jezik, autora, opis i vreme objave', () => {
    expect(result.language).toBe('sr');
    expect(result.author).toBe('Redakcija');
    expect(result.excerpt).toBe('Sednica je trajala četiri sata.');
    expect(result.publishedAt).toBe('2026-09-05T09:30:00+02:00');
  });

  it('cuva srpske dijakritike', () => {
    expect(result.text).toContain('četiri sata');
    expect(result.text).toContain('zaduženja');
  });
});

describe('extractArticle na stranici bez clanka', () => {
  it('vraca method "none" umesto da izmislja tekst', () => {
    const result = extractArticle(
      '<html><body><nav><a href="/a">A</a></nav></body></html>',
      'https://primer.rs/',
    );
    expect(result.method).toBe('none');
    expect(result.text).toBe('');
  });

  it('ne puca na neispravnom HTML-u', () => {
    expect(() =>
      extractArticle('<html><body><p>bez zatvaranja', 'https://primer.rs/'),
    ).not.toThrow();
  });
});
