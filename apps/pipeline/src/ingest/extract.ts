import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import { countWords, normalizeWhitespace, stripHtml } from './normalize.js';

/** Odakle je tekst na kraju izvucen. */
export type ExtractionMethod = 'readability' | 'jsonld' | 'container' | 'none';

export interface ExtractedArticle {
  title: string | null;
  text: string;
  excerpt: string | null;
  author: string | null;
  imageUrl: string | null;
  language: string | null;
  publishedAt: string | null;
  canonicalUrl: string | null;
  method: ExtractionMethod;
}

/** Ispod ovoga tekst nije clanak nego ostatak strane. */
export const MIN_ARTICLE_WORDS = 60;

/**
 * Vadi tekst clanka iz HTML-a, u tri pokusaja.
 *
 * Readability je prvi i najbolji, ali ume da promasi: na stranama gde je clanak
 * kratak a blok „povezane vesti" bogat, on izabere povezane vesti. Zato posle
 * njega idu jos dva pokusaja — `articleBody` iz JSON-LD podataka, pa tekst iz
 * poznatih kontejnera clanka. Uzima se prvi koji da dovoljno reci.
 *
 * Meta podaci se citaju PRE svega, jer Readability menja dokument u mestu.
 */
export function extractArticle(html: string, url: string): ExtractedArticle {
  const { document } = parseHTML(withBaseHref(html, url));

  // `og:title` je gotovo uvek cist naslov clanka, dok `<title>` nosi i rubriku i
  // ime portala, a Readability zna da uzme naslov susednog bloka.
  const ogTitle = metaContent(document, ['og:title', 'twitter:title']);

  const meta: Omit<ExtractedArticle, 'text' | 'method'> = {
    title: ogTitle ?? textOf(document, 'title'),
    excerpt: metaContent(document, ['og:description', 'description', 'twitter:description']),
    author: metaContent(document, ['article:author', 'author', 'og:article:author']),
    imageUrl: absolute(metaContent(document, ['og:image', 'twitter:image']), url),
    language: document.documentElement?.getAttribute('lang')?.slice(0, 5) ?? null,
    publishedAt: metaContent(document, [
      'article:published_time',
      'og:article:published_time',
      'datePublished',
      'pubdate',
    ]),
    canonicalUrl: absolute(
      document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
      url,
    ),
  };

  const jsonLd = readArticleBody(document);
  const container = readContainerText(document);

  let parsed: {
    title?: string | null;
    textContent?: string | null;
    byline?: string | null;
  } | null;
  try {
    // Readability ocekuje pravi DOM; linkedom je dovoljno blizak za ovu namenu.
    // Tip se premoscuje jer projekat ne ukljucuje browser tipove (`lib: DOM`).
    type ReadabilityDocument = ConstructorParameters<typeof Readability>[0];
    parsed = new Readability(document as unknown as ReadabilityDocument, {
      charThreshold: 250,
    }).parse();
  } catch {
    parsed = null;
  }

  const readabilityText = cleanBodyText(parsed?.textContent ?? '');
  const [text, method] = chooseText([
    [readabilityText, 'readability'],
    [cleanBodyText(jsonLd), 'jsonld'],
    [cleanBodyText(container), 'container'],
  ]);

  return {
    ...meta,
    title: cleanTitle(ogTitle ?? parsed?.title ?? meta.title),
    author: meta.author ?? (parsed?.byline ? normalizeWhitespace(parsed.byline) : null),
    text,
    method,
  };
}

/** Prvi kandidat sa dovoljno reci; ako nijedan nije dovoljan, najduzi od njih. */
function chooseText(candidates: [string, ExtractionMethod][]): [string, ExtractionMethod] {
  for (const [text, method] of candidates) {
    if (countWords(text) >= MIN_ARTICLE_WORDS) return [text, method];
  }

  const longest = candidates.reduce<[string, ExtractionMethod]>(
    (best, candidate) => (candidate[0].length > best[0].length ? candidate : best),
    ['', 'none'],
  );
  return longest[0] ? longest : ['', 'none'];
}

/**
 * `articleBody` iz JSON-LD podataka. Portali ga stavljaju zbog Google-a, i kad
 * postoji, to je najcistiji tekst clanka koji strana uopste nudi.
 */
function readArticleBody(document: MinimalDocument): string {
  const ARTICLE_TYPES = /(News|Blog|Report|Live)?Article|VideoObject/i;

  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(script.textContent ?? '');
    } catch {
      continue;
    }

    for (const node of flattenJsonLd(parsed)) {
      const types = [node['@type']]
        .flat()
        .filter((type): type is string => typeof type === 'string');
      if (!types.some((type) => ARTICLE_TYPES.test(type))) continue;

      const body = node['articleBody'];
      if (typeof body === 'string' && body.trim()) return normalizeWhitespace(stripHtml(body));
    }
  }
  return '';
}

function flattenJsonLd(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (typeof value !== 'object' || value === null) return [];

  const node = value as Record<string, unknown>;
  const graph = node['@graph'];
  return graph ? [node, ...flattenJsonLd(graph)] : [node];
}

/**
 * Tekst iz kontejnera koji srpski portali (uglavnom WordPress) koriste za telo
 * clanka. Uzimaju se samo pasusi i podnaslovi, pa u tekst ne upadaju potpisi
 * ispod slika i pozivi na pracenje drustvenih mreza.
 */
export function readContainerText(document: MinimalDocument): string {
  const CONTAINERS = [
    '[itemprop="articleBody"]',
    'div.post-content',
    'div.entry-content',
    'div.article-body',
    'div.article__body',
    'div.single-content',
    'div.news-text',
    'div.text-content',
    'article .content',
  ];

  for (const selector of CONTAINERS) {
    const element = document.querySelector(selector);
    if (!element) continue;

    const parts: string[] = [];
    for (const node of element.querySelectorAll('p, h2, h3, li')) {
      if (node.closest('figure, figcaption, aside, nav, footer, .related, .banner')) continue;
      const text = normalizeWhitespace(node.textContent ?? '');
      if (text.length > 1) parts.push(text);
    }

    const joined = parts.join(' ');
    if (countWords(joined) >= MIN_ARTICLE_WORDS) return joined;
  }
  return '';
}

/**
 * Readability razresava relativne linkove preko `baseURI` dokumenta, koji
 * linkedom postavlja iz `<base>` oznake. Bez nje slike i linkovi ostanu
 * relativni.
 */
function withBaseHref(html: string, url: string): string {
  if (/<base\s/i.test(html)) return html;
  const tag = `<base href="${url.replace(/"/g, '&quot;')}">`;

  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (match) => `${match}${tag}`);
  return `${tag}${html}`;
}

export type MinimalDocument = ReturnType<typeof parseHTML>['document'];

function metaContent(document: MinimalDocument, names: string[]): string | null {
  for (const name of names) {
    const escaped = name.replace(/"/g, '\\"');
    const element =
      document.querySelector(`meta[property="${escaped}"]`) ??
      document.querySelector(`meta[name="${escaped}"]`) ??
      document.querySelector(`meta[itemprop="${escaped}"]`);

    const content = element?.getAttribute('content');
    if (content?.trim()) return stripHtml(content);
  }
  return null;
}

function textOf(document: MinimalDocument, selector: string): string | null {
  const value = document.querySelector(selector)?.textContent;
  return value?.trim() ? normalizeWhitespace(value) : null;
}

function absolute(value: string | null, base: string): string | null {
  if (!value) return null;
  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
}

/**
 * Skida repove tipa " - Politika - Dnevni list Danas" koje portali dodaju u
 * `<title>`. Skida ih vise, jednog po jednog, ali nikad toliko da od naslova
 * ostane pola recenice.
 */
function cleanTitle(title: string | null): string | null {
  if (!title) return null;

  let cleaned = normalizeWhitespace(title);
  for (let step = 0; step < 3; step += 1) {
    const shorter = cleaned.replace(/\s+[|—–-]\s+[^|—–-]{2,40}$/u, '');
    if (shorter === cleaned || shorter.length < 20) break;
    cleaned = shorter;
  }
  return cleaned || normalizeWhitespace(title);
}

/**
 * Ciscenje repova koji nisu deo clanka: putanja kroz rubrike na vrhu strane
 * („Pocetna » Vesti » Politika »") i brojac komentara. Oba bi inace usla u
 * tekst koji se u Fazi 5 salje modelu.
 */
export function cleanBodyText(raw: string): string {
  let text = normalizeWhitespace(raw);

  const breadcrumb = text.slice(0, 250).lastIndexOf('»');
  if (breadcrumb !== -1) text = text.slice(breadcrumb + 1).trimStart();

  text = text.replace(/^\d+\s+komentar(a|i)?\b[\s:.-]*/iu, '');
  return text.trim();
}
