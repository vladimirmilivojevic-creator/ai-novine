import { afterEach, describe, expect, it } from 'vitest';
import {
  SERBIA_TIME_ZONE,
  serbianWallClockToIso,
  timeZoneOffsetMs,
  zonedWallClockToUtc,
} from './timezone.js';

const originalTimeZone = process.env['TZ'];

afterEach(() => {
  if (originalTimeZone === undefined) delete process.env['TZ'];
  else process.env['TZ'] = originalTimeZone;
});

describe('timeZoneOffsetMs', () => {
  it('Beograd je leti dva sata ispred UTC-a', () => {
    const july = Date.UTC(2026, 6, 15, 12, 0);
    expect(timeZoneOffsetMs(july, SERBIA_TIME_ZONE)).toBe(2 * 3600_000);
  });

  it('Beograd je zimi jedan sat ispred UTC-a', () => {
    const january = Date.UTC(2026, 0, 15, 12, 0);
    expect(timeZoneOffsetMs(january, SERBIA_TIME_ZONE)).toBe(3600_000);
  });

  it('UTC nema odstupanje', () => {
    expect(timeZoneOffsetMs(Date.UTC(2026, 6, 15, 12, 0), 'UTC')).toBe(0);
  });
});

describe('serbianWallClockToIso', () => {
  it('letnje vreme: 09:07 u Beogradu je 07:07 UTC', () => {
    expect(serbianWallClockToIso({ year: 2026, month: 9, day: 6, hour: 9, minute: 7 })).toBe(
      '2026-09-06T07:07:00.000Z',
    );
  });

  it('zimsko vreme: 09:07 u Beogradu je 08:07 UTC', () => {
    expect(serbianWallClockToIso({ year: 2026, month: 1, day: 15, hour: 9, minute: 7 })).toBe(
      '2026-01-15T08:07:00.000Z',
    );
  });

  it('dan prelaska na zimsko vreme se ne pomera unazad', () => {
    // 25.10.2026. u 03:00 Beograd je već CET (+1).
    expect(serbianWallClockToIso({ year: 2026, month: 10, day: 25, hour: 3, minute: 0 })).toBe(
      '2026-10-25T02:00:00.000Z',
    );
  });

  it('odbija datum koji ne postoji', () => {
    expect(
      serbianWallClockToIso({ year: 2026, month: 2, day: 31, hour: 12, minute: 0 }),
    ).toBeNull();
    expect(
      serbianWallClockToIso({ year: 2026, month: 13, day: 1, hour: 12, minute: 0 }),
    ).toBeNull();
  });

  /**
   * Ovo je test zbog koga je greška i nastala: rezultat ne sme da zavisi od
   * zone mašine na kojoj kod radi. Razvojni računar je Europe/Belgrade, GitHub
   * Actions runner je UTC.
   */
  it('daje isti rezultat bez obzira na vremensku zonu mašine', () => {
    const results = ['UTC', 'Europe/Belgrade', 'America/New_York', 'Asia/Tokyo'].map((zone) => {
      process.env['TZ'] = zone;
      return serbianWallClockToIso({ year: 2026, month: 9, day: 6, hour: 9, minute: 7 });
    });

    expect(new Set(results).size).toBe(1);
    expect(results[0]).toBe('2026-09-06T07:07:00.000Z');
  });
});

describe('zonedWallClockToUtc', () => {
  it('radi i za druge zone, ne samo za srpsku', () => {
    const tokyo = zonedWallClockToUtc(
      { year: 2026, month: 9, day: 6, hour: 9, minute: 0 },
      'Asia/Tokyo',
    );
    expect(new Date(tokyo!).toISOString()).toBe('2026-09-06T00:00:00.000Z');
  });
});
