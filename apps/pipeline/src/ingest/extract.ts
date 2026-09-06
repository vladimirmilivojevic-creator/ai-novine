import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import { normalizeWhitespace, stripHtml } from './normalize.js';

export interface ExtractedArticle {
  title: string | null;
  text: string;
  excerpt: string | null;
  author: string | null;
  imageUrl: string | null;
  language: string | null;
  publishedAt: string | null;
  canonicalUrl: string | null;
  method: 'readability' | 'none';
}

/**
 * Vadi tekst clanka iz HTML-a. Meta podaci (`og:` i `article:` oznake) citaju
 * se PRE Readability-ja, jer on menja dokument u mestu.
 */
export function extractArticle(html: string, url: string): ExtractedArticle {
  const { document } = parseHTML(withBaseHref(html, url));

  const meta: Omit<ExtractedArticle, 'text' | 'method'> = {
    title: metaContent(document, ['og:title', 'twitter:title']) ?? textOf(document, 'title'),
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

  const text = normalizeWhitespace(parsed?.textContent ?? '');

  return {
    ...meta,
    title: cleanTitle(parsed?.title ?? meta.title),
    author: meta.author ?? (parsed?.byline ? normalizeWhitespace(parsed.byline) : null),
    text,
    method: text.length > 0 ? 'readability' : 'none',
  };
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

type MinimalDocument = ReturnType<typeof parseHTML>['document'];

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

/** Skida rep tipa " - Naziv portala" koji portali dodaju u `<title>`. */
function cleanTitle(title: string | null): string | null {
  if (!title) return null;
  const cleaned = normalizeWhitespace(title).replace(/\s+[|—–-]\s+[^|—–-]{2,40}$/u, '');
  return cleaned.length >= 15 ? cleaned : normalizeWhitespace(title);
}
