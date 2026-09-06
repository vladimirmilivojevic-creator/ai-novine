import { afterEach, describe, expect, it } from 'vitest';
import {
  canonicalizeUrl,
  contentHash,
  countWords,
  parseSerbianDate,
  stripHtml,
  toIsoDate,
  urlHash,
} from './normalize.js';

describe('canonicalizeUrl', () => {
  it('skida parametre za pracenje posetilaca', () => {
    expect(
      canonicalizeUrl('https://primer.rs/vest?utm_source=fb&utm_medium=post&id=42&fbclid=abc'),
    ).toBe('https://primer.rs/vest?id=42');
  });

  it('svodi www, velika slova u domenu, fragment i zavrsnu kosu crtu na isti oblik', () => {
    const variants = [
      'https://WWW.Primer.rs/vest/',
      'https://primer.rs/vest#komentari',
      'https://www.primer.rs/vest',
    ].map((url) => canonicalizeUrl(url));

    expect(new Set(variants).size).toBe(1);
    expect(variants[0]).toBe('https://primer.rs/vest');
  });

  it('ne dira putanju koja je samo kosa crta', () => {
    expect(canonicalizeUrl('https://primer.rs/')).toBe('https://primer.rs/');
  });

  it('razresava relativan link u odnosu na feed', () => {
    expect(canonicalizeUrl('/vesti/1', 'https://primer.rs/feed/')).toBe(
      'https://primer.rs/vesti/1',
    );
  });

  it('odbija sve sto nije http ili https', () => {
    expect(canonicalizeUrl('javascript:alert(1)')).toBeNull();
    expect(canonicalizeUrl('mailto:neko@primer.rs')).toBeNull();
    expect(canonicalizeUrl('bez protokola i domena')).toBeNull();
  });

  it('isti parametri u razlicitom redosledu daju isti URL', () => {
    expect(canonicalizeUrl('https://primer.rs/v?b=2&a=1')).toBe(
      canonicalizeUrl('https://primer.rs/v?a=1&b=2'),
    );
  });
});

describe('urlHash', () => {
  it('daje isti hes za isti URL i razlicit za razlicite', () => {
    const first = urlHash('https://primer.rs/vest');
    expect(first).toBe(urlHash('https://primer.rs/vest'));
    expect(first).not.toBe(urlHash('https://primer.rs/druga-vest'));
    expect(first).toHaveLength(64);
  });
});

describe('contentHash', () => {
  it('ne razlikuje visak razmaka, interpunkciju i velicinu slova', () => {
    expect(contentHash('Naslov', 'Prvi   pasus.\n\nDrugi pasus!')).toBe(
      contentHash('naslov', 'Prvi pasus Drugi pasus'),
    );
  });

  it('razlikuje stvarno drugaciji tekst', () => {
    expect(contentHash('Naslov', 'Prvi pasus')).not.toBe(contentHash('Naslov', 'Drugi pasus'));
  });

  it('cuva srpske dijakritike kao znacajne', () => {
    expect(contentHash('Naslov', 'Nešto čudno')).not.toBe(contentHash('Naslov', 'Nesto cudno'));
  });
});

describe('stripHtml', () => {
  it('izbacuje oznake i dekodira osnovne entitete', () => {
    expect(stripHtml('<p>Vlada &amp; opozicija <b>danas</b></p>')).toBe('Vlada & opozicija danas');
  });

  it('izbacuje skripte zajedno sa njihovim sadrzajem', () => {
    expect(stripHtml('<script>var x = 1;</script><p>Tekst</p>')).toBe('Tekst');
  });
});

describe('countWords', () => {
  it('broji reci bez obzira na visak razmaka', () => {
    expect(countWords('  jedna   dve\ntri  ')).toBe(3);
    expect(countWords('   ')).toBe(0);
  });
});

describe('toIsoDate', () => {
  it('prihvata RFC 822 datum iz RSS-a', () => {
    expect(toIsoDate('Sat, 05 Sep 2026 10:00:00 +0200')).toBe('2026-09-05T08:00:00.000Z');
  });

  it('odbija datum iz buducnosti, jer je to greska u feedu', () => {
    const future = new Date(Date.now() + 72 * 3600_000).toISOString();
    expect(toIsoDate(future)).toBeNull();
  });

  it('odbija prazno i neupotrebljivo', () => {
    expect(toIsoDate(null)).toBeNull();
    expect(toIsoDate('juce oko podne')).toBeNull();
  });
});

describe('parseSerbianDate', () => {
  const now = new Date('2026-09-06T12:00:00Z').getTime();
  const originalTimeZone = process.env['TZ'];

  afterEach(() => {
    if (originalTimeZone === undefined) delete process.env['TZ'];
    else process.env['TZ'] = originalTimeZone;
  });

  it('cita datum i vreme razdvojene zarezom, kako ih RTS ispisuje', () => {
    // 09:07 u Beogradu je 07:07 UTC (letnje racunanje vremena).
    expect(parseSerbianDate('nedelja, 06.09.2026, 09:07 -> 13:48 Izvor', now)).toBe(
      '2026-09-06T07:07:00.000Z',
    );
  });

  it('daje isti trenutak bez obzira na vremensku zonu masine', () => {
    const results = ['UTC', 'Europe/Belgrade', 'America/New_York'].map((zone) => {
      process.env['TZ'] = zone;
      return parseSerbianDate('06.09.2026, 09:07', now);
    });

    expect(new Set(results).size).toBe(1);
    expect(results[0]).toBe('2026-09-06T07:07:00.000Z');
  });

  it('cita datum bez vremena i bez vodece nule', () => {
    expect(parseSerbianDate('Objavljeno 5.9.2026.', now)?.slice(0, 10)).toBe('2026-09-05');
  });

  it('preskace datume starije od trideset dana i one iz buducnosti', () => {
    expect(parseSerbianDate('01.01.2020.', now)).toBeNull();
    expect(parseSerbianDate('01.01.2030.', now)).toBeNull();
  });

  it('preskace nepostojeci datum i uzima sledeci ispravan', () => {
    expect(parseSerbianDate('32.13.2026. pa 04.09.2026.', now)?.slice(0, 10)).toBe('2026-09-04');
  });

  it('vraca null kad datuma nema', () => {
    expect(parseSerbianDate('Nema datuma u ovom tekstu', now)).toBeNull();
  });
});
