import { describe, expect, it } from 'vitest';
import { calculateCost, formatUsd, monthlyEstimate, usageFromResponse } from './cost.js';
import {
  anglesInMaterial,
  buildUserMessage,
  MAX_SOURCES_IN_PROMPT,
  SOURCE_TEXT_LIMIT,
  loadSystemPrompt,
  type TopicMaterial,
} from './prompt.js';
import { repairAndValidate } from './repair.js';
import { articleSchema } from './schema.js';
import { selectClustersForGeneration, slugify, type ClusterCandidate } from './select.js';

const GATES = { minDistinctSources: 3, minDistinctAngles: 2, minTotalItems: 3 };

function candidate(over: Partial<ClusterCandidate> & { clusterId: string }): ClusterCandidate {
  return {
    titleSample: 'Naslov teme',
    trendingScore: 10,
    distinctSources: 4,
    distinctAngles: 2,
    size: 5,
    ...over,
  };
}

function material(over: Partial<TopicMaterial> = {}): TopicMaterial {
  return {
    topicTitle: 'Vlada usvojila budžet',
    keywords: ['budžet', 'Vlada'],
    entities: ['Aleksandar Vučić'],
    sources: [
      {
        angle: 'kriticki',
        title: 'Vlada usvojila budžet',
        summary: null,
        content: 'Sednica je trajala četiri sata.',
        publishedAt: '2026-09-06T08:00:00.000Z',
      },
      {
        angle: 'provladin',
        title: 'Usvojen budžet Srbije',
        summary: 'Kratak opis',
        content: null,
        publishedAt: null,
      },
    ],
    ...over,
  };
}

describe('urednički sistem-prompt', () => {
  const prompt = loadSystemPrompt();

  it('sadrži pravila iz sekcije 5 brief-a', () => {
    expect(prompt).toContain('inicijale');
    expect(prompt).toContain('osumnjičen');
    expect(prompt).toContain('obe strane');
    expect(prompt).toMatch(/nikad ne sme|nigde/i);
  });

  it('zabranjuje pominjanje izvora u tekstu', () => {
    expect(prompt).toContain('ime portala');
  });

  it('dovoljno je dug da se keširanje uključi i na Haiku modelu', () => {
    // Haiku 4.5 kešira tek prefiks od 4096 tokena naviše. Znak nije token, ali
    // srpski tekst ima oko tri znaka po tokenu, pa je 14.000 znakova siguran prag.
    expect(prompt.length).toBeGreaterThan(14_000);
  });
});

describe('buildUserMessage', () => {
  it('označava izveštaje uglom, a ne imenom medija', () => {
    const message = buildUserMessage(material());
    expect(message).toContain('izvor kritičan prema vlasti');
    expect(message).toContain('izvor blizak vlasti');
    expect(message).not.toMatch(/\bN1\b|Kurir|Danas|Informer/);
  });

  it('koristi opis kad nema punog teksta', () => {
    expect(buildUserMessage(material())).toContain('Kratak opis');
  });

  it('seče predugačak izveštaj', () => {
    const long = material({
      sources: [
        {
          angle: 'mejnstrim',
          title: 'Naslov',
          summary: null,
          content: 'reč '.repeat(3000),
          publishedAt: null,
        },
      ],
    });
    const message = buildUserMessage(long);
    expect(message.length).toBeLessThan(SOURCE_TEXT_LIMIT + 1500);
  });

  it('ne šalje više izveštaja nego što je dozvoljeno', () => {
    const many = material({
      sources: Array.from({ length: 20 }, (_, index) => ({
        angle: 'mejnstrim' as const,
        title: `Izveštaj broj ${index}`,
        summary: null,
        content: 'Tekst.',
        publishedAt: null,
      })),
    });
    const message = buildUserMessage(many);
    expect(message).toContain(`Izveštaj ${MAX_SOURCES_IN_PROMPT} —`);
    expect(message).not.toContain(`## Izveštaj ${MAX_SOURCES_IN_PROMPT + 1} —`);
  });

  it('prepoznaje koliko je uglova u materijalu', () => {
    expect(anglesInMaterial(material())).toHaveLength(2);
  });
});

describe('articleSchema', () => {
  const valid = {
    title: 'Vlada usvojila budžet za narednu godinu',
    lead: 'Vlada je usvojila predlog budžeta.',
    body: 'Prvi pasus.\n\nDrugi pasus.',
    category: 'ekonomija',
    sensitive: false,
    sensitivityReason: null,
    sourcesDiverge: false,
    bothSides: null,
    keywords: ['budžet'],
    notes: [],
  };

  it('prihvata ispravan članak', () => {
    expect(articleSchema.safeParse(valid).success).toBe(true);
  });

  it('odbija nepostojeću kategoriju', () => {
    expect(articleSchema.safeParse({ ...valid, category: 'zabava' }).success).toBe(false);
  });

  it('traži oba panela kada postoji prikaz obe strane', () => {
    const result = articleSchema.safeParse({
      ...valid,
      sourcesDiverge: true,
      bothSides: { officialLabel: 'Zvanični ugao', officialText: 'Tekst.' },
    });
    expect(result.success).toBe(false);
  });
});

describe('selectClustersForGeneration', () => {
  it('odbija temu koja ne prolazi kapije i kaže zašto', () => {
    const outcome = selectClustersForGeneration(
      [candidate({ clusterId: 'a', distinctSources: 2, distinctAngles: 1, size: 2 })],
      GATES,
      {
        maxPerRun: 5,
        maxPerDay: 30,
        maxFlagshipPerDay: 2,
        writtenToday: 0,
        flagshipWrittenToday: 0,
      },
    );

    expect(outcome.selected).toHaveLength(0);
    expect(outcome.rejected[0]?.reasons.join(' ')).toContain('izvora');
  });

  it('daje jači model najjačim temama, po skoru', () => {
    const outcome = selectClustersForGeneration(
      [
        candidate({ clusterId: 'slaba', trendingScore: 5 }),
        candidate({ clusterId: 'jaka', trendingScore: 90 }),
        candidate({ clusterId: 'srednja', trendingScore: 40 }),
      ],
      GATES,
      {
        maxPerRun: 5,
        maxPerDay: 30,
        maxFlagshipPerDay: 1,
        writtenToday: 0,
        flagshipWrittenToday: 0,
      },
    );

    expect(outcome.selected[0]?.candidate.clusterId).toBe('jaka');
    expect(outcome.selected[0]?.tier).toBe('flagship');
    expect(outcome.selected[1]?.tier).toBe('default');
  });

  it('poštuje dnevnu granicu, ne samo granicu ciklusa', () => {
    const outcome = selectClustersForGeneration(
      [candidate({ clusterId: 'a' }), candidate({ clusterId: 'b' })],
      GATES,
      {
        maxPerRun: 6,
        maxPerDay: 30,
        maxFlagshipPerDay: 0,
        writtenToday: 29,
        flagshipWrittenToday: 0,
      },
    );

    expect(outcome.selected).toHaveLength(1);
    expect(outcome.rejected[0]?.reasons.join(' ')).toContain('dnevna granica');
  });

  it('ne piše ništa kada je dnevna granica potrošena', () => {
    const outcome = selectClustersForGeneration([candidate({ clusterId: 'a' })], GATES, {
      maxPerRun: 6,
      maxPerDay: 30,
      maxFlagshipPerDay: 4,
      writtenToday: 30,
      flagshipWrittenToday: 0,
    });

    expect(outcome.selected).toHaveLength(0);
  });
});

describe('slugify', () => {
  const date = new Date('2026-09-06T10:00:00Z');

  it('pravi latiničnu adresu bez kvačica', () => {
    expect(slugify('Vlada usvojila budžet за narednu godinu', date)).toBe(
      'vlada-usvojila-budzet-narednu-godinu-2026-09-06',
    );
  });

  it('prevodi đ u dj', () => {
    expect(slugify('Đorđe i Nađa', date)).toBe('djordje-i-nadja-2026-09-06');
  });

  it('ne ostavlja crticu pred datumom', () => {
    expect(slugify('Kraj!!!', date)).toBe('kraj-2026-09-06');
  });
});

describe('trošak', () => {
  it('računa cenu po cenovniku modela', () => {
    const cost = calculateCost('claude-haiku-4-5', {
      inputTokens: 1_000_000,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    });
    expect(cost.totalCost).toBeCloseTo(1, 6);
  });

  it('čitanje iz keša košta desetinu punog ulaza', () => {
    const cached = calculateCost('claude-haiku-4-5', {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 1_000_000,
    });
    expect(cached.totalCost).toBeCloseTo(0.1, 6);
  });

  it('Sonnet je dvostruko skuplji od Haiku modela na ulazu', () => {
    const usage = {
      inputTokens: 10_000,
      outputTokens: 1_000,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    };
    const haiku = calculateCost('claude-haiku-4-5', usage);
    const sonnet = calculateCost('claude-sonnet-5', usage);
    expect(sonnet.totalCost).toBeCloseTo(haiku.totalCost * 2, 6);
  });

  it('cita potrosnju iz odgovora, i kad polja nedostaju', () => {
    expect(usageFromResponse({ input_tokens: 5, output_tokens: 3 })).toEqual({
      inputTokens: 5,
      outputTokens: 3,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    });
  });

  it('procenjuje mesečni račun', () => {
    expect(monthlyEstimate(0.01, 25)).toBeCloseTo(7.5, 6);
    expect(formatUsd(0.0123456)).toBe('$0.012346');
  });
});

describe('repairAndValidate', () => {
  const base = {
    title: 'Vlada usvojila budžet za narednu godinu',
    lead: 'Vlada je usvojila predlog budžeta.',
    body: 'Prvi pasus.\n\nDrugi pasus.',
    category: 'ekonomija',
    sensitive: false,
    sensitivityReason: null,
    sourcesDiverge: false,
    bothSides: null,
    keywords: ['budžet'],
    notes: [],
  };

  it('prihvata ispravan odgovor bez ijedne popravke', () => {
    const result = repairAndValidate(base);
    expect(result.article).not.toBeNull();
    expect(result.repairs).toEqual([]);
  });

  it('prevodi rubriku portala u kategoriju sistema', () => {
    const result = repairAndValidate({ ...base, category: 'hronika' });
    expect(result.article?.category).toBe('drustvo');
    expect(result.repairs[0]).toContain('hronika');
  });

  it('podnosi velika slova i kvačice u kategoriji', () => {
    expect(repairAndValidate({ ...base, category: 'DRUŠTVO' }).article?.category).toBe('drustvo');
  });

  it('prazan objekat umesto null-a kod „obe strane"', () => {
    const result = repairAndValidate({ ...base, bothSides: {} });
    expect(result.article?.bothSides).toBeNull();
  });

  it('izostavljena polja keywords i notes dobijaju prazan niz', () => {
    const { keywords: _k, notes: _n, ...without } = base;
    const result = repairAndValidate(without);
    expect(result.article?.keywords).toEqual([]);
    expect(result.repairs).toHaveLength(2);
  });

  it('vraća problem koji ne ume da popravi, umesto da izmišlja vrednost', () => {
    const result = repairAndValidate({ ...base, category: 'nesto sasvim deseto' });
    expect(result.article).toBeNull();
    expect(result.problems.join(' ')).toContain('category');
  });

  it('odbija odgovor koji uopšte nije objekat', () => {
    expect(repairAndValidate('samo tekst').article).toBeNull();
    expect(repairAndValidate(null).problems).toHaveLength(1);
  });
});
