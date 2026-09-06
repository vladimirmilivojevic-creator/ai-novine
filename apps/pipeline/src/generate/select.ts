import { checkQualityGates, type QualityGateThresholds } from '../cluster/trending.js';

/**
 * Koja tema dobija članak, i kojim modelom.
 *
 * Brief (sekcija 5) izričito kaže: nema fiksnog broja članaka po ciklusu. Sistem
 * procenjuje da li tema „zaslužuje" članak — a mera su kapije kvaliteta i
 * trending skor, ne kvota.
 */

export interface ClusterCandidate {
  clusterId: string;
  titleSample: string | null;
  trendingScore: number;
  distinctSources: number;
  distinctAngles: number;
  size: number;
}

export interface SelectionLimits {
  /** Najviše članaka u jednom ciklusu. */
  maxPerRun: number;
  /** Tvrda gornja granica objava dnevno (brief, sekcija 9). */
  maxPerDay: number;
  /** Najviše članaka dnevno koje piše skuplji, jači model. */
  maxFlagshipPerDay: number;
  /** Koliko je članaka danas već napisano. */
  writtenToday: number;
  /** Koliko je danas već napisano jačim modelom. */
  flagshipWrittenToday: number;
}

export interface Selection {
  candidate: ClusterCandidate;
  /** `flagship` je jači model — dobijaju ga samo najjače teme dana. */
  tier: 'default' | 'flagship';
}

export interface SelectionOutcome {
  selected: Selection[];
  /** Teme koje su odbijene, sa razlogom — ide u dnevnik i izveštaj. */
  rejected: { candidate: ClusterCandidate; reasons: string[] }[];
}

export function selectClustersForGeneration(
  candidates: ClusterCandidate[],
  gates: QualityGateThresholds,
  limits: SelectionLimits,
): SelectionOutcome {
  const outcome: SelectionOutcome = { selected: [], rejected: [] };

  const remainingToday = Math.max(0, limits.maxPerDay - limits.writtenToday);
  const room = Math.min(limits.maxPerRun, remainingToday);

  let flagshipLeft = Math.max(0, limits.maxFlagshipPerDay - limits.flagshipWrittenToday);

  // Najjača tema prva: ako je mesta za samo par članaka, neka to budu oni o
  // kojima se najviše priča.
  const ordered = [...candidates].sort((a, b) => b.trendingScore - a.trendingScore);

  for (const candidate of ordered) {
    const gateResult = checkQualityGates(
      {
        distinctSources: candidate.distinctSources,
        distinctAngles: candidate.distinctAngles,
        size: candidate.size,
      },
      gates,
    );

    if (!gateResult.passes) {
      outcome.rejected.push({ candidate, reasons: gateResult.reasons });
      continue;
    }

    if (outcome.selected.length >= room) {
      // Koja granica je stvarno zaustavila pisanje — dnevna ili granica ciklusa.
      const dailyIsBinding = remainingToday <= limits.maxPerRun;
      outcome.rejected.push({
        candidate,
        reasons: dailyIsBinding
          ? [
              `dnevna granica od ${limits.maxPerDay} članaka je dostignuta ` +
                `(danas napisano ${limits.writtenToday})`,
            ]
          : [`ciklus je popunjen (${limits.maxPerRun} članaka)`],
      });
      continue;
    }

    const tier = flagshipLeft > 0 ? 'flagship' : 'default';
    if (tier === 'flagship') flagshipLeft -= 1;

    outcome.selected.push({ candidate, tier });
  }

  return outcome;
}

/**
 * Slug iz naslova: latinica bez kvačica, mala slova, crtice.
 * Datum na kraju sprečava sudar dva članka istog naslova u različitim danima.
 */
export function slugify(title: string, date = new Date()): string {
  const base = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'dj')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/g, '');

  const stamp = date.toISOString().slice(0, 10);
  return base ? `${base}-${stamp}` : `clanak-${stamp}`;
}
