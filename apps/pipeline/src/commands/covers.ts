import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  CATEGORIES,
  createLogger,
  loadDotEnv,
  reportsDir,
  serbianDateLabel,
} from '@ai-novine/core';
import { articlesNeedingCover, createServiceClient, setArticleCover } from '@ai-novine/db';
import { PALETTE, VARIANTS, variantForId } from '../images/palette.js';
import { renderCoverPng } from '../images/render.js';
import { ensureCoverBucket, uploadCover } from '../images/storage.js';

const log = createLogger('covers');

/**
 * Naslovne slike (Faza 8).
 *
 * Dva režima:
 * - `--preview` crta svih 18 šablona u `reports/naslovnice/`, bez baze i bez
 *   mreže, da vlasnik može da pogleda vizuelni identitet pre nego što ijedna
 *   slika ode na sajt.
 * - bez zastavice: nalazi članke bez slike, crta ih i otprema u Storage.
 *
 * Crtanje ne košta ništa i ne zove nijedan model, pa se sme ponavljati koliko
 * god puta treba.
 */

const PREVIEW_TITLES: Record<string, string> = {
  politika: 'Đilas i Vučić o izborima: šta je zaista dogovoreno u četvrtak uveče',
  ekonomija: 'Dinar drugi mesec zaredom stabilan, cene hrane ipak rastu',
  drustvo: 'Škole u Srbiji dobijaju nova pravila o mobilnim telefonima',
  sport: 'Zvezda posle produžetaka izborila plasman u naredno kolo',
  region: 'Sastanak u Sarajevu bez zajedničkog saopštenja, razgovori se nastavljaju',
  svet: 'Pregovori u Ženevi ušli u treći dan bez vidljivog pomaka',
};

export async function runCovers(options: {
  preview?: boolean;
  limit?: number;
  dryRun?: boolean;
}): Promise<void> {
  if (options.preview) {
    await renderPreview();
    return;
  }

  await renderMissing({ limit: options.limit ?? 20, dryRun: options.dryRun ?? false });
}

/** Svih 18 šablona u `reports/naslovnice/`, po jedan PNG. */
async function renderPreview(): Promise<void> {
  const outDir = join(reportsDir, 'naslovnice');
  await mkdir(outDir, { recursive: true });

  const started = Date.now();
  const files: string[] = [];

  for (const category of CATEGORIES) {
    for (const variant of VARIANTS) {
      const png = await renderCoverPng({
        title: PREVIEW_TITLES[category] ?? 'Naslov članka',
        category,
        variant,
        dateLabel: serbianDateLabel(new Date()),
      });

      const name = `${category}-${variant}.png`;
      await writeFile(join(outDir, name), png);
      files.push(name);
    }
  }

  log.info('Šabloni nacrtani.', {
    šablona: files.length,
    rubrika: CATEGORIES.length,
    varijacija: VARIANTS.length,
    folder: outDir,
    sekundi: Number(((Date.now() - started) / 1000).toFixed(1)),
  });
}

/** Članci bez slike: nacrtaj, otpremi, upiši adresu. */
async function renderMissing(options: { limit: number; dryRun: boolean }): Promise<void> {
  loadDotEnv();

  const client = createServiceClient();
  const articles = await articlesNeedingCover(client, options.limit);

  if (articles.length === 0) {
    log.info('Svi članci već imaju sliku koja odgovara naslovu.');
    return;
  }

  if (!options.dryRun) await ensureCoverBucket(client);

  let done = 0;
  const errors: string[] = [];

  for (const article of articles) {
    const variant = variantForId(article.id);

    try {
      const png = await renderCoverPng({
        title: article.title,
        category: article.category,
        variant,
        dateLabel: serbianDateLabel(new Date(article.published_at ?? article.created_at)),
      });

      if (options.dryRun) {
        log.info('Slika nacrtana (proba, ne otprema se).', {
          clanak: article.slug,
          šablon: `${article.category}/${variant}`,
          kilobajta: Math.round(png.length / 1024),
        });
        done += 1;
        continue;
      }

      const url = await uploadCover(client, article.slug, png);
      await setArticleCover(client, article.id, {
        url,
        variant: `${article.category}/${variant}`,
      });

      log.info('Slika napravljena.', {
        clanak: article.slug,
        šablon: `${article.category}/${variant}`,
        kilobajta: Math.round(png.length / 1024),
      });
      done += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${article.slug}: ${message}`);
      log.warn('Slika nije napravljena.', { clanak: article.slug, greska: message });
    }
  }

  log.info('Naslovne slike završene.', {
    napravljeno: done,
    bezSlike: errors.length,
    rubrike: Object.keys(PALETTE).length,
  });

  // Neuspela slika ne obara ceo posao: clanak i dalje postoji, samo bez omota,
  // i sledece pokretanje ga ponovo uzima.
  if (errors.length > 0) log.warn('Neki članci su ostali bez slike.', { greske: errors });
}
