import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Nalazi koren repozitorijuma tako sto se penje uz stablo direktorijuma dok ne
 * nadje `config/sources.json`. Time pipeline radi isto bez obzira odakle je
 * pokrenut — iz korena, iz `apps/pipeline`, ili iz GitHub Actions runner-a.
 */
export function findRepoRoot(startFrom: string = dirname(fileURLToPath(import.meta.url))): string {
  const candidates = [startFrom, process.cwd()];

  for (const candidate of candidates) {
    let current = resolve(candidate);

    for (;;) {
      if (existsSync(join(current, 'config', 'sources.json'))) return current;
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }

  throw new Error(
    'Nije pronadjen koren repozitorijuma (trazi se folder koji sadrzi config/sources.json).',
  );
}

export const repoRoot = findRepoRoot();
export const configDir = join(repoRoot, 'config');
export const reportsDir = join(repoRoot, 'reports');
