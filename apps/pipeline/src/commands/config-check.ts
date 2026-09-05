import { createLogger, loadEditorialConfig, loadSourcesConfig, repoRoot } from '@ai-novine/core';

const log = createLogger('config');

/**
 * Ucitava obe konfiguracije kroz zod seme i ispisuje kratak pregled. Ovo je
 * provera koju vredi pokrenuti posle svake rucne izmene u `config/`.
 */
export function runConfigCheck(): void {
  let failed = false;

  try {
    const sources = loadSourcesConfig();
    const enabled = sources.sources.filter((source) => source.enabled);
    const byAngle = new Map<string, number>();
    for (const source of enabled) {
      byAngle.set(source.angle, (byAngle.get(source.angle) ?? 0) + 1);
    }
    const withFeeds = enabled.filter((source) => source.feeds.length > 0).length;

    log.info('sources.json je ispravan.', {
      koren: repoRoot,
      ukupnoIzvora: sources.sources.length,
      ukljucenih: enabled.length,
      poUglu: Object.fromEntries(byAngle),
      saPoznatimRssFeedom: withFeeds,
    });

    const duplicates = findDuplicates(sources.sources.map((source) => source.id));
    if (duplicates.length > 0) {
      log.error('Ponovljeni id izvora u sources.json.', { duplikati: duplicates });
      failed = true;
    }
  } catch (error) {
    log.error((error as Error).message);
    failed = true;
  }

  try {
    const editorial = loadEditorialConfig();
    log.info('editorial.json je ispravan.', {
      kategorija: Object.keys(editorial.categories).length,
      maxClanakaDnevno: editorial.limits.maxArticlesPerDay,
      podrazumevaniModel: editorial.models.default,
      glavniModel: editorial.models.flagship,
    });
  } catch (error) {
    log.error((error as Error).message);
    failed = true;
  }

  if (failed) process.exit(1);
  log.info('Konfiguracija je u redu.');
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}
