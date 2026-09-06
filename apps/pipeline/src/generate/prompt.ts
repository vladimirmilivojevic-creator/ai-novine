import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { configDir, type Angle } from '@ai-novine/core';
import { normalizeWhitespace } from '../ingest/normalize.js';

/**
 * Sastavljanje poziva modelu.
 *
 * Podela je namerna: **sistem-prompt je nepromenljiv** (urednička pravila iz
 * `config/editorial-prompt.md`) i zato se kešira, a **korisnička poruka nosi samo
 * materijal** za jednu temu. Posle prvog poziva se keširani deo naplaćuje deset
 * puta jeftinije, a to je najveći deo ulaza.
 *
 * Haiku 4.5 kešira tek prefiks od 4096 tokena i naviše — ispod toga keširanje
 * tiho ne radi. Zato je urednički prompt namerno detaljan.
 */

const ANGLE_LABELS: Record<Angle, string> = {
  provladin: 'izvor blizak vlasti',
  kriticki: 'izvor kritičan prema vlasti',
  mejnstrim: 'mejnstrim izvor',
  agencija: 'novinska agencija',
};

/** Koliko znakova jednog izveštaja ide modelu. Uvod nosi temu; rep je kontekst. */
export const SOURCE_TEXT_LIMIT = 1600;
/** Najviše izveštaja po temi — preko ovoga se ulaz plaća, a ništa novo se ne saznaje. */
export const MAX_SOURCES_IN_PROMPT = 8;

export interface SourceMaterial {
  angle: Angle;
  title: string;
  summary: string | null;
  content: string | null;
  publishedAt: string | null;
}

export interface ExistingArticle {
  title: string;
  lead: string;
  body: string;
  /** Koliko je verzija članak već imao — ide modelu kao kontekst. */
  revision: number;
}

export interface TopicMaterial {
  topicTitle: string;
  keywords: string[];
  entities: string[];
  sources: SourceMaterial[];
  /**
   * Kada je popunjeno, ovo nije pisanje novog članka nego **dopuna** već
   * objavljenog. Izveštaji u `sources` su tada samo oni koji su stigli posle
   * poslednje verzije.
   */
  existingArticle?: ExistingArticle;
}

let cachedSystemPrompt: string | undefined;

/** Urednička pravila iz `config/editorial-prompt.md`. */
export function loadSystemPrompt(): string {
  cachedSystemPrompt ??= readFileSync(join(configDir, 'editorial-prompt.md'), 'utf8').trim();
  return cachedSystemPrompt;
}

/**
 * Materijal za jednu temu, u obliku u kom ga model dobija.
 *
 * Izveštaji se označavaju **uglom, ne imenom medija**. Model mora da zna ugao da
 * bi mogao da napiše prikaz „obe strane"; ime medija mu ne treba ni za šta, a
 * ako ga zna, ume da ga upiše u tekst — što je zabranjeno (brief, sekcija 5).
 */
export function buildUserMessage(material: TopicMaterial): string {
  const parts: string[] = [];
  const existing = material.existingArticle;

  parts.push(existing ? '# Dopuna već objavljenog članka' : '# Materijal za jedan članak');
  parts.push('');
  parts.push(`Tema: ${material.topicTitle}`);
  if (material.keywords.length > 0) {
    parts.push(`Ključne reči iz izveštaja: ${material.keywords.slice(0, 10).join(', ')}`);
  }
  if (material.entities.length > 0) {
    parts.push(`Imena i nazivi koji se pominju: ${material.entities.slice(0, 10).join(', ')}`);
  }
  parts.push('');

  if (existing) {
    parts.push(`## Članak koji se dopunjuje (verzija ${existing.revision})`);
    parts.push('');
    parts.push(`Naslov: ${existing.title}`);
    parts.push('');
    parts.push(`Uvod: ${existing.lead}`);
    parts.push('');
    parts.push(existing.body);
    parts.push('');
    parts.push(
      `Sledi ${material.sources.length} NOVIH izveštaja koji su stigli posle te verzije. ` +
        'Ugradi ono što je stvarno novo, po pravilima za dopunu. Vrati ceo članak, ne samo izmene.',
    );
  } else {
    parts.push(
      `Sledi ${material.sources.length} nezavisnih izveštaja o istom događaju. Označeni su uglom ` +
        'iz kog izveštavaju. Napiši jedan članak po uredničkim pravilima.',
    );
  }
  parts.push('');

  const sources = material.sources.slice(0, MAX_SOURCES_IN_PROMPT);

  for (const [index, source] of sources.entries()) {
    const heading = material.existingArticle ? 'Novi izveštaj' : 'Izveštaj';
    parts.push(`## ${heading} ${index + 1} — ${ANGLE_LABELS[source.angle]}`);
    if (source.publishedAt) parts.push(`Objavljeno: ${source.publishedAt}`);
    parts.push('');
    parts.push(`Naslov: ${normalizeWhitespace(source.title)}`);

    const text = source.content ?? source.summary ?? '';
    if (text) {
      parts.push('');
      parts.push(normalizeWhitespace(text).slice(0, SOURCE_TEXT_LIMIT));
    }
    parts.push('');
  }

  return parts.join('\n').trim();
}

/** Koliko različitih uglova ima u materijalu — ulazi u odluku o „obe strane". */
export function anglesInMaterial(material: TopicMaterial): Angle[] {
  return [...new Set(material.sources.map((source) => source.angle))];
}
