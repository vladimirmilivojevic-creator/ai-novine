import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import { repoRoot } from '@ai-novine/core';
import { COVER_HEIGHT, COVER_WIDTH, coverElement, type CoverInput } from './layout.js';

/**
 * Crtanje slike: stablo elemenata → SVG (satori) → PNG (resvg).
 *
 * Oba koraka rade lokalno, bez mreže i bez naloga kod ijednog servisa. Jedna
 * slika je oko 40 ms, pa deset članaka dnevno ne troši ni sekundu vremena
 * GitHub Actions minuta.
 */

const FONT_DIR = join(repoRoot, 'assets', 'fonts');

interface LoadedFont {
  name: string;
  data: Buffer;
  weight: 400 | 700;
  style: 'normal';
}

let fontsPromise: Promise<LoadedFont[]> | null = null;

/**
 * Font se pakuje u repo, ne skida se pri svakom pokretanju.
 *
 * Razlog je srpska latinica: č, ć, ž, š i đ moraju da postoje u fontu, inače
 * satori ta slova preskoči i naslov izađe sa rupama. Inter ih ima, licenca je
 * SIL Open Font License, pa sme da stoji u javnom repozitorijumu.
 */
export async function loadFonts(): Promise<LoadedFont[]> {
  fontsPromise ??= Promise.all([
    readFile(join(FONT_DIR, 'Inter-Regular.ttf')),
    readFile(join(FONT_DIR, 'Inter-Bold.ttf')),
  ]).then(([regular, bold]): LoadedFont[] => [
    { name: 'Inter', data: regular, weight: 400, style: 'normal' },
    { name: 'Inter', data: bold, weight: 700, style: 'normal' },
  ]);

  return fontsPromise;
}

export async function renderCoverSvg(input: CoverInput): Promise<string> {
  const fonts = await loadFonts();
  return satori(coverElement(input) as never, {
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    fonts,
  });
}

export async function renderCoverPng(input: CoverInput): Promise<Buffer> {
  const svg = await renderCoverSvg(input);
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: COVER_WIDTH },
    font: { loadSystemFonts: false, fontDirs: [FONT_DIR], defaultFontFamily: 'Inter' },
  });
  return Buffer.from(resvg.render().asPng());
}

/** Prvi bajtovi PNG zaglavlja — koristi se u proverama da je slika ispravna. */
export const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
