import { normalizeForMatching } from '@ai-novine/core';
import {
  articleSchema,
  CATEGORY_VALUES,
  MIN_PARAGRAPH_CHARS,
  type GeneratedArticle,
} from './schema.js';

/**
 * Popravka odgovora modela pre provere šemom.
 *
 * Strukturisani izlaz nije tvrda garancija na svim modelima — Haiku 4.5 povremeno
 * vrati kategoriju van spiska ili prazan niz umesto `null`. Odgovor je inače
 * upotrebljiv, pa nema smisla baciti ceo članak zbog jedne reči. Popravlja se
 * samo ono što je nedvosmisleno; sve ostalo ide na ponovni pokušaj.
 */

/** Nazivi koji se pojave umesto zvaničnih kategorija. */
const CATEGORY_SYNONYMS: Record<string, (typeof CATEGORY_VALUES)[number]> = {
  hronika: 'drustvo',
  crna_hronika: 'drustvo',
  'crna hronika': 'drustvo',
  drustvo_hronika: 'drustvo',
  zdravstvo: 'drustvo',
  obrazovanje: 'drustvo',
  saobracaj: 'drustvo',
  vreme: 'drustvo',
  kultura: 'drustvo',
  zabava: 'drustvo',
  showbiz: 'drustvo',
  magazin: 'drustvo',
  tehnologija: 'drustvo',
  nauka: 'drustvo',
  biznis: 'ekonomija',
  privreda: 'ekonomija',
  finansije: 'ekonomija',
  balkan: 'region',
  srbija: 'politika',
  spoljna_politika: 'politika',
  svijet: 'svet',
  medjunarodno: 'svet',
};

export interface RepairResult {
  article: GeneratedArticle | null;
  /** Šta je popravljeno — ide u dnevnik, da se vidi koliko model promašuje. */
  repairs: string[];
  /** Problemi koje nije bilo moguće popraviti. */
  problems: string[];
}

export function repairAndValidate(raw: unknown): RepairResult {
  const repairs: string[] = [];

  if (typeof raw !== 'object' || raw === null) {
    return { article: null, repairs, problems: ['odgovor nije objekat'] };
  }

  const value = { ...(raw as Record<string, unknown>) };

  // Kategorija: mala slova, bez kvačica, pa poznati sinonimi.
  const category = value['category'];
  if (typeof category === 'string') {
    const normalized = normalizeForMatching(category).trim().replace(/\s+/g, ' ');
    if (!(CATEGORY_VALUES as readonly string[]).includes(normalized)) {
      const mapped =
        CATEGORY_SYNONYMS[normalized] ?? CATEGORY_SYNONYMS[normalized.split(/[\s,/]/)[0] ?? ''];
      if (mapped) {
        repairs.push(`kategorija „${category}" prevedena u „${mapped}"`);
        value['category'] = mapped;
      }
    } else if (normalized !== category) {
      repairs.push(`kategorija „${category}" svedena na „${normalized}"`);
      value['category'] = normalized;
    }
  }

  // Prekratak pasus se spaja sa susednim umesto da obori ceo članak. Model
  // ponekad odvoji jednu rečenicu u svoj pasus — to je stvar preloma, ne
  // sadržaja, i nema razloga da zbog toga plaćeni odgovor ode u smeće.
  const body = value['body'];
  if (Array.isArray(body) && body.every((part) => typeof part === 'string')) {
    const merged = mergeShortParagraphs(body as string[]);
    if (merged.length !== body.length) {
      repairs.push(`spojeno ${body.length - merged.length} prekratkih pasusa`);
      value['body'] = merged;
    }
  }

  // Prazan tekst umesto null-a kod polja koja smeju da izostanu.
  if (value['sensitivityReason'] === '') {
    value['sensitivityReason'] = null;
    repairs.push('prazno obrazloženje osetljivosti pretvoreno u null');
  }

  // Prazan objekat umesto null-a kod prikaza „obe strane".
  const bothSides = value['bothSides'];
  if (bothSides !== null && typeof bothSides === 'object' && Object.keys(bothSides).length === 0) {
    value['bothSides'] = null;
    repairs.push('prazan prikaz „obe strane" pretvoren u null');
  }

  // Polja koja model ume da izostavi kad nema šta da javi.
  for (const field of ['keywords', 'notes'] as const) {
    if (value[field] === undefined || value[field] === null) {
      value[field] = [];
      repairs.push(`polje ${field} je izostalo, upisan prazan niz`);
    }
  }
  if (value['sensitivityReason'] === undefined) value['sensitivityReason'] = null;
  if (value['bothSides'] === undefined) value['bothSides'] = null;

  const result = articleSchema.safeParse(value);
  if (result.success) return { article: result.data, repairs, problems: [] };

  return {
    article: null,
    repairs,
    problems: result.error.issues.map(
      (issue) => `${issue.path.join('.') || 'koren'}: ${issue.message}`,
    ),
  };
}

/**
 * Spaja pasuse kraće od donje granice sa susednim. Prvi pasus se spaja sa
 * sledećim, svi ostali sa prethodnim — tako redosled misli ostaje isti.
 */
export function mergeShortParagraphs(paragraphs: string[]): string[] {
  const result: string[] = [];

  for (const paragraph of paragraphs) {
    const text = paragraph.trim();
    if (!text) continue;

    const previous = result[result.length - 1];
    if (text.length < MIN_PARAGRAPH_CHARS && previous !== undefined) {
      result[result.length - 1] = `${previous} ${text}`;
      continue;
    }
    result.push(text);
  }

  // Ako je prvi pasus ostao prekratak, on se spaja sa sledećim.
  const first = result[0];
  const second = result[1];
  if (first !== undefined && second !== undefined && first.length < MIN_PARAGRAPH_CHARS) {
    result.splice(0, 2, `${first} ${second}`);
  }

  return result;
}
