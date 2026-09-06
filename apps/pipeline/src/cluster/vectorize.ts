import { extractEntities, toLatin, tokenize } from '@ai-novine/core';

/**
 * Pretvaranje vesti u brojeve, bez ijednog AI poziva.
 *
 * Postupak je standardni TF-IDF nad korenima reči: reč koja se pojavljuje u
 * svakom tekstu (npr. „ministar") nosi malu težinu, a reč koja se pojavljuje u
 * malo tekstova (npr. „Kanjiža") nosi veliku. Dve vesti o istom događaju dele
 * baš te retke reči.
 */

/** Naslov nosi temu gušće od teksta, pa se broji višestruko. */
export const TITLE_WEIGHT = 3;
/** Koliko znakova teksta ulazi u poređenje. Uvod nosi temu; rep je kontekst. */
export const BODY_CHARS = 1500;

export interface DocumentInput {
  id: string;
  title: string;
  content: string | null;
}

export interface DocumentVector {
  id: string;
  /** koren reči → broj pojavljivanja */
  terms: Map<string, number>;
  /** Čitljiv oblik korena, za prikaz ključnih reči. */
  surface: Map<string, string>;
  entities: string[];
}

export function vectorizeDocument(input: DocumentInput): DocumentVector {
  const body = (input.content ?? '').slice(0, BODY_CHARS);
  const terms = new Map<string, number>();
  const surface = new Map<string, string>();

  const add = (text: string, weight: number): void => {
    const words = text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    for (const word of words) {
      const [token] = tokenize(word);
      if (!token) continue;
      terms.set(token, (terms.get(token) ?? 0) + weight);
      // Ključne reči se prikazuju latinicom bez obzira na to sa kog su izvora —
      // RTS piše ćirilicom, ostali latinicom, a izveštaj treba da bude jedan.
      if (!surface.has(token)) surface.set(token, toLatin(word));
    }
  };

  add(input.title, TITLE_WEIGHT);
  add(body, 1);

  return {
    id: input.id,
    terms,
    surface,
    entities: extractEntities(`${input.title}. ${body}`, 15),
  };
}

/** Koliko dokumenata sadrži svaki koren — osnova za IDF. */
export function documentFrequencies(vectors: DocumentVector[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const vector of vectors) {
    for (const term of vector.terms.keys()) df.set(term, (df.get(term) ?? 0) + 1);
  }
  return df;
}

export interface Idf {
  weight(term: string): number;
  documentCount: number;
}

export function buildIdf(vectors: DocumentVector[]): Idf {
  const df = documentFrequencies(vectors);
  const total = Math.max(1, vectors.length);

  return {
    documentCount: total,
    weight(term: string): number {
      // Zaglađeni IDF: nepoznat koren dobija težinu kao da se javio jednom.
      return Math.log((total + 1) / ((df.get(term) ?? 0) + 1)) + 1;
    },
  };
}

/** TF-IDF vektor, već normalizovan na dužinu 1 — kosinus je onda skalarni proizvod. */
export function toUnitVector(terms: Map<string, number>, idf: Idf): Map<string, number> {
  const weighted = new Map<string, number>();
  let sumOfSquares = 0;

  for (const [term, count] of terms) {
    // Logaritamski TF: deseto pominjanje iste reči ne vredi kao prvo.
    const weight = (1 + Math.log(count)) * idf.weight(term);
    weighted.set(term, weight);
    sumOfSquares += weight * weight;
  }

  const length = Math.sqrt(sumOfSquares);
  if (length === 0) return weighted;

  for (const [term, weight] of weighted) weighted.set(term, weight / length);
  return weighted;
}

/** Kosinusna sličnost dva već normalizovana vektora: 0 = ništa zajedničko, 1 = isto. */
export function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  // Prolazi se kroz manji vektor — rezultat je isti, posao je manji.
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];

  let sum = 0;
  for (const [term, weight] of small) {
    const other = large.get(term);
    if (other !== undefined) sum += weight * other;
  }
  return sum;
}

/**
 * Udeo zajedničkih imena i naziva. Dve vesti o istom događaju gotovo uvek dele
 * bar jedno ime, pa ovo podiže sličnost tamo gde je tekst pisan drugim rečima.
 */
export function entityOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;

  const setB = new Set(b.map((entity) => entity.toLowerCase()));
  let shared = 0;
  for (const entity of a) if (setB.has(entity.toLowerCase())) shared += 1;

  return shared / Math.min(a.length, b.length);
}

/**
 * Konačna sličnost dve vesti: tekst nosi većinu, imena dopunjavaju.
 * Odnos 0.8 : 0.2 je izabran tako da imena mogu da spasu par koji je pisan
 * različitim rečima, ali ne mogu sama da spoje dve nepovezane vesti.
 */
export function combinedSimilarity(
  textSimilarity: number,
  entitySimilarity: number,
  entityWeight = 0.2,
): number {
  return textSimilarity * (1 - entityWeight) + entitySimilarity * entityWeight;
}
