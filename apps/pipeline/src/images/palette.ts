import { CATEGORIES, type Category } from '@ai-novine/core';

/**
 * Vizuelni identitet naslovnih slika (Faza 8).
 *
 * Brief, sekcija 8: nema AI generisanih fotografija. Svaka slika je nacrtana
 * kodom — geometrija, tipografija i boja rubrike. To znači nula dinara po
 * slici, nula pravnog rizika oko lika imenovane osobe, i istu sliku svaki put
 * za isti članak.
 *
 * Šest rubrika × tri varijacije = 18 šablona. Rubrika bira boju, varijacija
 * bira raspored geometrije. Zaglavlje, naslov i vodeni žig su svuda isti, pa
 * se sve slike prepoznaju kao isti list.
 */

/** Boje su birane da bele slova na njima imaju kontrast preko 7:1 (WCAG AAA). */
export interface CategoryPalette {
  /** Ime rubrike ispisano na slici. */
  label: string;
  /** Naglasak — traka ispod naslova, oznaka rubrike, geometrija. */
  accent: string;
  /** Tamnija podloga; svaka rubrika ima svoj ton, ne isto crno. */
  ink: string;
}

export const PALETTE: Record<Category, CategoryPalette> = {
  politika: { label: 'POLITIKA', accent: '#E2574C', ink: '#14100F' },
  ekonomija: { label: 'EKONOMIJA', accent: '#3FA37B', ink: '#0D1412' },
  drustvo: { label: 'DRUŠTVO', accent: '#D99A3C', ink: '#151109' },
  sport: { label: 'SPORT', accent: '#4C8FD9', ink: '#0C1016' },
  region: { label: 'REGION', accent: '#A97BD4', ink: '#120E17' },
  svet: { label: 'SVET', accent: '#3FA8B5', ink: '#0A1416' },
};

/** Tri rasporeda geometrije. Redosled je deo identiteta i ne menja se. */
export const VARIANTS = ['traka', 'mreza', 'blok'] as const;
export type Variant = (typeof VARIANTS)[number];

export const TEMPLATE_COUNT = CATEGORIES.length * VARIANTS.length;

/**
 * Isti članak uvek dobija istu sliku, i pre nego što se ijedna slika sačuva.
 *
 * FNV-1a preko identifikatora članka: kratko, bez zavisnosti, i isto na svakoj
 * mašini. Nasumičan izbor bi značio da članak posle ponovnog generisanja slike
 * izgleda drugačije, pa bi ga čitalac koji ga je već video teže prepoznao.
 */
export function variantForId(id: string): Variant {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return VARIANTS[hash % VARIANTS.length] as Variant;
}

/** Boja rubrike; nepoznata rubrika dobija „društvo", ne pada. */
export function paletteFor(category: string): CategoryPalette {
  return PALETTE[category as Category] ?? PALETTE.drustvo;
}
