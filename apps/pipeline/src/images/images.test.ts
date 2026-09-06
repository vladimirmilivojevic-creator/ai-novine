import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '@ai-novine/core';
import { coverIsStale } from '@ai-novine/db';
import { coverElement, fitTitle, titleFontSize, WATERMARK } from './layout.js';
import { PALETTE, TEMPLATE_COUNT, VARIANTS, paletteFor, variantForId } from './palette.js';
import { PNG_MAGIC, renderCoverPng, renderCoverSvg } from './render.js';
import { coverPath, uploadCover } from './storage.js';

const SRPSKA_SLOVA = ['č', 'ć', 'ž', 'š', 'đ', 'Č', 'Ć', 'Ž', 'Š', 'Đ'];

describe('šabloni', () => {
  it('ima tačno 18 šablona — šest rubrika puta tri varijacije', () => {
    expect(TEMPLATE_COUNT).toBe(18);
    expect(CATEGORIES).toHaveLength(6);
    expect(VARIANTS).toHaveLength(3);
  });

  it('svaka rubrika ima svoju boju i naziv', () => {
    for (const category of CATEGORIES) {
      const palette = PALETTE[category];
      expect(palette.label.length).toBeGreaterThan(0);
      expect(palette.accent).toMatch(/^#[0-9A-F]{6}$/);
      expect(palette.ink).toMatch(/^#[0-9A-F]{6}$/);
    }

    const accents = new Set(CATEGORIES.map((category) => PALETTE[category].accent));
    expect(accents.size).toBe(CATEGORIES.length);
  });

  it('nepoznata rubrika ne obara crtanje', () => {
    expect(paletteFor('vremenska-prognoza')).toBe(PALETTE.drustvo);
  });
});

describe('variantForId', () => {
  it('isti članak uvek dobija isti šablon', () => {
    const id = 'b0f79dde-4c1e-4a0f-9a2b-8f1d0c3e5a77';
    expect(variantForId(id)).toBe(variantForId(id));
  });

  it('različiti članci koriste sve tri varijacije', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) seen.add(variantForId(`clanak-${i}`));
    expect(seen.size).toBe(VARIANTS.length);
  });

  it('raspodela je približno ravnomerna', () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 900; i += 1) {
      const variant = variantForId(`00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
      counts.set(variant, (counts.get(variant) ?? 0) + 1);
    }
    for (const count of counts.values()) expect(count).toBeGreaterThan(180);
  });
});

describe('naslov na slici', () => {
  it('kratak naslov ostaje nepromenjen', () => {
    expect(fitTitle('Dinar stabilan drugi mesec zaredom')).toBe(
      'Dinar stabilan drugi mesec zaredom',
    );
  });

  it('dugačak naslov se seče na granici reči, ne usred nje', () => {
    const dug = `${'Vlada Srbije donela je odluku o novim merama '.repeat(6)}kraj`;
    const skracen = fitTitle(dug);

    expect(skracen.length).toBeLessThanOrEqual(151);
    expect(skracen.endsWith('…')).toBe(true);
    expect(skracen.slice(0, -1)).toBe(skracen.slice(0, -1).trimEnd());
    expect(dug.startsWith(skracen.slice(0, -1))).toBe(true);
  });

  it('višestruki razmaci i prelomi reda se sažimaju', () => {
    expect(fitTitle('Naslov  sa\n\nprelomom')).toBe('Naslov sa prelomom');
  });

  it('duži naslov dobija manja slova', () => {
    const sizes = ['Kratak naslov', 'x'.repeat(70), 'x'.repeat(100), 'x'.repeat(200)].map(
      titleFontSize,
    );
    for (let i = 1; i < sizes.length; i += 1) {
      expect(sizes[i]).toBeLessThan(sizes[i - 1] as number);
    }
  });
});

describe('stablo slike', () => {
  const json = (category: string) =>
    JSON.stringify(coverElement({ title: 'Proba naslova', category, variant: 'traka' }));

  it('vodeni žig je na svakom šablonu', () => {
    for (const category of CATEGORIES) {
      for (const variant of VARIANTS) {
        const tree = JSON.stringify(coverElement({ title: 'Proba', category, variant }));
        expect(tree).toContain(WATERMARK);
      }
    }
  });

  it('žig kaže da je tekst pisala veštačka inteligencija', () => {
    expect(WATERMARK).toContain('veštačka inteligencija');
    expect(WATERMARK).toContain('AI Novine');
  });

  it('boja rubrike stvarno završi na slici', () => {
    expect(json('sport')).toContain(PALETTE.sport.accent);
    expect(json('svet')).toContain(PALETTE.svet.accent);
  });
});

describe('crtanje slike', () => {
  it('vraća ispravan PNG', async () => {
    const png = await renderCoverPng({
      title: 'Đilas i Vučić o izborima: šta je dogovoreno u četvrtak',
      category: 'politika',
      variant: 'traka',
      dateLabel: '7. septembar 2026.',
    });

    expect(png.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
    expect(png.length).toBeGreaterThan(10_000);
  });

  it('font ima sva srpska slova — nijedno ne ispada iz naslova', async () => {
    const prazno = await renderCoverSvg({ title: ' ', category: 'svet', variant: 'blok' });

    for (const slovo of SRPSKA_SLOVA) {
      const svg = await renderCoverSvg({ title: slovo, category: 'svet', variant: 'blok' });
      expect(svg).toContain('<path');
      // Slovo koje font nema satori preskoci, pa bi slika bila ista kao prazna.
      expect(svg).not.toBe(prazno);
    }
  });

  it('prazan naslov ne obara crtanje', async () => {
    const png = await renderCoverPng({ title: '', category: 'drustvo', variant: 'mreza' });
    expect(png.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
  });
});

describe('precrtavanje posle dopune', () => {
  const nacrtan = {
    cover_url: 'https://primer/covers/a.png',
    cover_at: '2026-09-07T10:00:00Z',
    last_update_at: null as string | null,
  };

  it('članak bez slike uvek ide na crtanje', () => {
    expect(coverIsStale({ ...nacrtan, cover_url: null })).toBe(true);
  });

  it('nedopunjen članak se ne precrtava', () => {
    expect(coverIsStale(nacrtan)).toBe(false);
  });

  it('dopuna posle crtanja traži novu sliku — naslov se mogao promeniti', () => {
    expect(coverIsStale({ ...nacrtan, last_update_at: '2026-09-07T12:00:00Z' })).toBe(true);
  });

  it('dopuna pre crtanja ne traži ništa', () => {
    expect(coverIsStale({ ...nacrtan, last_update_at: '2026-09-07T08:00:00Z' })).toBe(false);
  });

  it('stara slika bez zapisa o vremenu se precrta jednom', () => {
    expect(
      coverIsStale({ ...nacrtan, cover_at: null, last_update_at: '2026-09-07T12:00:00Z' }),
    ).toBe(true);
  });
});

describe('skladište', () => {
  it('ime fajla je slug članka', () => {
    expect(coverPath('vlada-usvojila-budzet-2027')).toBe('vlada-usvojila-budzet-2027.png');
  });

  it('vraća javnu adresu posle otpremanja', async () => {
    const client = fakeStorage({ uploadError: null });
    const url = await uploadCover(client, 'proba-clanak', Buffer.from('png'));
    expect(url).toBe('https://primer.supabase.co/storage/v1/object/public/covers/proba-clanak.png');
  });

  it('neuspelo otpremanje kaže koji fajl je pao', async () => {
    const client = fakeStorage({ uploadError: 'mreza nedostupna' });
    await expect(uploadCover(client, 'proba-clanak', Buffer.from('png'))).rejects.toThrow(
      /proba-clanak\.png.*mreza nedostupna/,
    );
  });
});

/** Najmanji mogući lažni klijent — samo ono što `uploadCover` dodiruje. */
function fakeStorage(options: { uploadError: string | null }): SupabaseClient {
  return {
    storage: {
      from: () => ({
        upload: async () => ({
          error: options.uploadError ? { message: options.uploadError } : null,
        }),
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://primer.supabase.co/storage/v1/object/public/covers/${path}` },
        }),
      }),
    },
  } as unknown as SupabaseClient;
}
