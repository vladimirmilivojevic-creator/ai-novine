/**
 * Pretvaranje vremena sa srpskih stranica u tačan trenutak.
 *
 * Portal koji ispiše „06.09.2026, 09:07" misli na beogradsko vreme. Ako se taj
 * zapis sastavi sa `new Date(godina, mesec, dan, sat, minut)`, JavaScript ga
 * razume kao vreme u zoni MAŠINE na kojoj kod radi — a to je Europe/Belgrade na
 * razvojnom računaru, ali UTC na GitHub Actions i Vercel serverima. Isti članak
 * bi tako dobio dva različita vremena objave, sa razlikom od sat ili dva.
 *
 * Zato se zona navodi izričito i računa preko `Intl`, koji zna i za letnje
 * računanje vremena (CET zimi, CEST leti).
 */

export const SERBIA_TIME_ZONE = 'Europe/Belgrade';

export interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second?: number;
}

/**
 * Koliko zona odstupa od UTC-a u datom trenutku, u milisekundama.
 * Za Beograd: +1h zimi, +2h leti.
 */
export function timeZoneOffsetMs(instant: number, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts: Record<string, number> = {};
  for (const part of formatter.formatToParts(new Date(instant))) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }

  const asIfUtc = Date.UTC(
    parts['year'] ?? 1970,
    (parts['month'] ?? 1) - 1,
    parts['day'] ?? 1,
    parts['hour'] ?? 0,
    parts['minute'] ?? 0,
    parts['second'] ?? 0,
  );
  return asIfUtc - instant;
}

/**
 * Zidno vreme u zadatoj zoni → trenutak u UTC-u. Vraća `null` za datum koji ne
 * postoji (31. februar i slično).
 *
 * Računa se u dva koraka jer odstupanje zone zavisi od samog trenutka: prvi
 * korak daje procenu, drugi je ispravlja ako procena padne sa druge strane
 * prelaska na letnje računanje vremena.
 */
export function zonedWallClockToUtc(wall: WallClock, timeZone: string): number | null {
  const naive = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second ?? 0,
  );

  // Provera postojanja datuma radi se nad UTC vrednostima, pa ne zavisi od zone.
  const check = new Date(naive);
  if (
    check.getUTCFullYear() !== wall.year ||
    check.getUTCMonth() !== wall.month - 1 ||
    check.getUTCDate() !== wall.day
  ) {
    return null;
  }

  const firstOffset = timeZoneOffsetMs(naive, timeZone);
  const firstGuess = naive - firstOffset;

  const secondOffset = timeZoneOffsetMs(firstGuess, timeZone);
  return secondOffset === firstOffset ? firstGuess : naive - secondOffset;
}

/** Zidno vreme u Srbiji → ISO zapis u UTC-u. */
export function serbianWallClockToIso(wall: WallClock): string | null {
  const utc = zonedWallClockToUtc(wall, SERBIA_TIME_ZONE);
  return utc === null ? null : new Date(utc).toISOString();
}

/** Meseci na srpskoj latinici; Intl za `sr` daje isto, ali zavisi od ICU podataka. */
const SERBIAN_MONTHS = [
  'januar',
  'februar',
  'mart',
  'april',
  'maj',
  'jun',
  'jul',
  'avgust',
  'septembar',
  'oktobar',
  'novembar',
  'decembar',
];

/**
 * Datum ispisan kako se pise u srpskom tekstu: „7. septembar 2026."
 *
 * Racuna se po beogradskom vremenu bez obzira gde proces radi — u GitHub
 * Actions runneru je sat na UTC, pa bi bez ovoga clanak objavljen u 01:30 po
 * beogradskom nosio jucerasnji datum.
 */
export function serbianDateLabel(instant: Date, timeZone: string = SERBIA_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(instant);

  const value = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');

  const month = SERBIAN_MONTHS[value('month') - 1] ?? '';
  return `${value('day')}. ${month} ${value('year')}.`;
}
