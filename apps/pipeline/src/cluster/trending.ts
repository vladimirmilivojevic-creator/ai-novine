/**
 * Trending skor — koliko se o temi stvarno priča.
 *
 * Brief (sekcija 4) traži besplatan i pouzdan signal: učestalost teme kroz 20+
 * izvora u istom vremenskom prozoru. To je jači signal za srpske vesti nego bilo
 * koji spoljni alat, i ne zavisi ni od jednog API-ja.
 *
 * Skor spaja četiri stvari:
 *  1. koliko RAZLIČITIH izvora javlja temu (tri izvora vrede više od tri teksta
 *     istog portala),
 *  2. koliko različitih uglova je pokriveno (isti ugao iz tri izvora je jedno
 *     saopštenje, ne vest),
 *  3. koliko je tekstova stiglo u poslednjih nekoliko sati (brzina rasta),
 *  4. koliko je vremena prošlo od poslednjeg teksta (tema koja je stala pada).
 */

export interface ClusterSignal {
  distinctSources: number;
  distinctAngles: number;
  /** Vremena objave svih tekstova u temi, u milisekundama. */
  itemTimes: number[];
}

export interface TrendingBreakdown {
  score: number;
  sources: number;
  angleFactor: number;
  velocityFactor: number;
  freshnessFactor: number;
}

/** Prozor u kome se meri brzina rasta. */
export const VELOCITY_WINDOW_HOURS = 6;
/** Posle ovoliko sati bez novog teksta skor padne na oko trećinu. */
export const FRESHNESS_HALF_LIFE_HOURS = 12;

export function trendingScore(signal: ClusterSignal, now = Date.now()): TrendingBreakdown {
  const sources = Math.max(0, signal.distinctSources);

  // Drugi ugao vredi mnogo (tema postaje spor), treći i četvrti sve manje.
  const angleFactor = 1 + 0.5 * Math.max(0, signal.distinctAngles - 1);

  const recent = signal.itemTimes.filter(
    (time) => now - time <= VELOCITY_WINDOW_HOURS * 3600_000,
  ).length;
  const velocityFactor = 1 + recent / 2;

  const newest = signal.itemTimes.length > 0 ? Math.max(...signal.itemTimes) : now;
  const hoursSince = Math.max(0, (now - newest) / 3600_000);
  const freshnessFactor = Math.exp(-hoursSince / FRESHNESS_HALF_LIFE_HOURS);

  const score = sources * angleFactor * velocityFactor * freshnessFactor;

  return {
    score: Math.round(score * 100) / 100,
    sources,
    angleFactor: round(angleFactor),
    velocityFactor: round(velocityFactor),
    freshnessFactor: round(freshnessFactor),
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface QualityGateInput {
  distinctSources: number;
  distinctAngles: number;
  size: number;
}

export interface QualityGateThresholds {
  minDistinctSources: number;
  minDistinctAngles: number;
  minTotalItems: number;
}

export interface QualityGateResult {
  passes: boolean;
  /** Razlozi odbijanja, na srpskom, za izveštaj i za dnevnik. */
  reasons: string[];
}

/**
 * Kapije kvaliteta iz sekcije 9 brief-a. Tema ide u generisanje samo ako je
 * javlja dovoljno nezavisnih izvora iz dovoljno različitih uglova. Ovo je
 * glavna odbrana od Google „Scaled Content Abuse" politike i ne sme se
 * olabaviti bez razgovora sa vlasnikom.
 */
export function checkQualityGates(
  input: QualityGateInput,
  thresholds: QualityGateThresholds,
): QualityGateResult {
  const reasons: string[] = [];

  if (input.distinctSources < thresholds.minDistinctSources) {
    reasons.push(
      `javlja je ${input.distinctSources} izvora, traži se najmanje ${thresholds.minDistinctSources}`,
    );
  }
  if (input.distinctAngles < thresholds.minDistinctAngles) {
    reasons.push(
      `pokriven je ${input.distinctAngles} ugao, traži se najmanje ${thresholds.minDistinctAngles} različita`,
    );
  }
  if (input.size < thresholds.minTotalItems) {
    reasons.push(`ima ${input.size} tekstova, traži se najmanje ${thresholds.minTotalItems}`);
  }

  return { passes: reasons.length === 0, reasons };
}
