import { describe, expect, it } from 'vitest';
import { centroidToJson, clusterItems, type ItemInput } from './cluster.js';
import {
  buildIdf,
  combinedSimilarity,
  cosineSimilarity,
  entityOverlap,
  toUnitVector,
  vectorizeDocument,
} from './vectorize.js';
import { checkQualityGates, trendingScore } from './trending.js';

const BASE = new Date('2026-09-06T10:00:00Z').getTime();

function item(over: Partial<ItemInput> & Pick<ItemInput, 'id' | 'title'>): ItemInput {
  return {
    sourceId: 'n1',
    angle: 'kriticki',
    content: null,
    publishedAt: BASE,
    ...over,
  };
}

describe('vektorizacija', () => {
  it('ista vest pisana ćirilicom i latinicom daje skoro isti vektor', () => {
    const cyrillic = vectorizeDocument({
      id: 'a',
      title: 'Влада усвојила буџет за наредну годину',
      content: 'Седница Владе Србије трајала је четири сата у Београду.',
    });
    const latin = vectorizeDocument({
      id: 'b',
      title: 'Vlada usvojila budžet za narednu godinu',
      content: 'Sednica Vlade Srbije trajala je četiri sata u Beogradu.',
    });

    const idf = buildIdf([cyrillic, latin]);
    const similarity = cosineSimilarity(
      toUnitVector(cyrillic.terms, idf),
      toUnitVector(latin.terms, idf),
    );
    expect(similarity).toBeGreaterThan(0.95);
  });

  it('dve nepovezane vesti imaju nisku sličnost', () => {
    const a = vectorizeDocument({
      id: 'a',
      title: 'Vlada usvojila budžet za narednu godinu',
      content: 'Ministar finansija predstavio je projekcije prihoda.',
    });
    const b = vectorizeDocument({
      id: 'b',
      title: 'Crvena zvezda pobedila u derbiju',
      content: 'Utakmica na Marakani odigrana je pred punim tribinama.',
    });

    const idf = buildIdf([a, b]);
    const similarity = cosineSimilarity(toUnitVector(a.terms, idf), toUnitVector(b.terms, idf));
    expect(similarity).toBeLessThan(0.15);
  });
});

describe('entityOverlap i combinedSimilarity', () => {
  it('meri udeo zajedničkih imena', () => {
    expect(entityOverlap(['Aleksandar Vučić', 'Niš'], ['Aleksandar Vučić'])).toBe(1);
    expect(entityOverlap(['Niš'], ['Novi Sad'])).toBe(0);
    expect(entityOverlap([], ['Niš'])).toBe(0);
  });

  it('imena podižu sličnost, ali ne mogu sama da spoje dve teme', () => {
    expect(combinedSimilarity(0.5, 1)).toBeCloseTo(0.6, 5);
    expect(combinedSimilarity(0.05, 1)).toBeLessThan(0.25);
  });
});

describe('clusterItems', () => {
  it('spaja tri izveštaja o istom događaju u jednu temu', () => {
    const outcome = clusterItems(
      [
        item({
          id: '1',
          sourceId: 'n1',
          angle: 'kriticki',
          title: 'Vlada usvojila budžet za narednu godinu',
          content: 'Sednica Vlade Srbije o budžetu trajala je četiri sata.',
        }),
        item({
          id: '2',
          sourceId: 'kurir',
          angle: 'provladin',
          title: 'Usvojen budžet Srbije za narednu godinu',
          content: 'Vlada Srbije usvojila je predlog budžeta na današnjoj sednici.',
        }),
        item({
          id: '3',
          sourceId: 'blic',
          angle: 'mejnstrim',
          title: 'Влада Србије усвојила предлог буџета',
          content: 'Седница о буџету за наредну годину трајала је четири сата.',
        }),
      ],
      [],
      { threshold: 0.35 },
    );

    const withMembers = outcome.clusters.filter((cluster) => cluster.members.length > 0);
    expect(withMembers).toHaveLength(1);
    expect(withMembers[0]?.members).toHaveLength(3);
    expect(withMembers[0]?.sourceIds.size).toBe(3);
    expect(withMembers[0]?.angles.size).toBe(3);
  });

  it('ne spaja vesti o različitim temama', () => {
    const outcome = clusterItems(
      [
        item({ id: '1', title: 'Vlada usvojila budžet za narednu godinu' }),
        item({ id: '2', title: 'Crvena zvezda pobedila u večitom derbiju' }),
        item({ id: '3', title: 'Nevreme oborilo stabla na Košutnjaku' }),
      ],
      [],
      { threshold: 0.35 },
    );

    expect(outcome.created).toBe(3);
  });

  it('pridružuje novu vest postojećoj temi iz ranijeg ciklusa', () => {
    const first = clusterItems(
      [
        item({
          id: '1',
          title: 'Vlada usvojila budžet za narednu godinu',
          content: 'Sednica Vlade Srbije o budžetu.',
        }),
      ],
      [],
      { threshold: 0.35 },
    );
    const created = first.clusters[0];
    expect(created).toBeDefined();

    const second = clusterItems(
      [
        item({
          id: '2',
          sourceId: 'danas',
          title: 'Budžet Srbije usvojen na sednici Vlade',
          content: 'Predlog budžeta za narednu godinu ide u skupštinsku proceduru.',
        }),
      ],
      [
        {
          id: 'stara-tema',
          centroid: centroidToJson(created!.vector),
          entities: created!.entities,
          sourceIds: [...created!.sourceIds],
          angles: [...created!.angles],
          itemTimes: created!.itemTimes,
          size: created!.members.length,
        },
      ],
      { threshold: 0.35 },
    );

    expect(second.joinedExisting).toBe(1);
    expect(second.created).toBe(0);
    expect(second.clusters[0]?.id).toBe('stara-tema');
  });

  it('ključne reči teme su čitljive, ne koreni', () => {
    const outcome = clusterItems(
      [
        item({
          id: '1',
          title: 'Vlada usvojila budžet za narednu godinu',
          content: 'Ministar finansija predstavio je budžet.',
        }),
      ],
      [],
      { threshold: 0.35 },
    );

    const keywords = outcome.clusters[0]?.keywords ?? [];
    expect(keywords.length).toBeGreaterThan(0);
    expect(keywords.some((word) => /budž|Vlada|ministar/i.test(word))).toBe(true);
  });
});

describe('trendingScore', () => {
  it('tema iz više izvora i više uglova nosi veći skor', () => {
    const uzak = trendingScore(
      { distinctSources: 3, distinctAngles: 1, itemTimes: [BASE, BASE, BASE] },
      BASE,
    );
    const širok = trendingScore(
      { distinctSources: 3, distinctAngles: 3, itemTimes: [BASE, BASE, BASE] },
      BASE,
    );
    expect(širok.score).toBeGreaterThan(uzak.score);
  });

  it('tema koja je stala pre pola dana pada u odnosu na svežu', () => {
    const sveza = trendingScore({ distinctSources: 4, distinctAngles: 2, itemTimes: [BASE] }, BASE);
    const stala = trendingScore(
      { distinctSources: 4, distinctAngles: 2, itemTimes: [BASE - 12 * 3600_000] },
      BASE,
    );
    expect(stala.score).toBeLessThan(sveza.score / 2);
  });

  it('prazna tema ima skor nula', () => {
    expect(
      trendingScore({ distinctSources: 0, distinctAngles: 0, itemTimes: [] }, BASE).score,
    ).toBe(0);
  });
});

describe('checkQualityGates', () => {
  const thresholds = { minDistinctSources: 3, minDistinctAngles: 2, minTotalItems: 3 };

  it('propušta temu iz tri izvora i dva ugla', () => {
    const result = checkQualityGates(
      { distinctSources: 3, distinctAngles: 2, size: 4 },
      thresholds,
    );
    expect(result.passes).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('odbija tri izveštaja iz istog ugla i kaže zašto', () => {
    const result = checkQualityGates(
      { distinctSources: 3, distinctAngles: 1, size: 3 },
      thresholds,
    );
    expect(result.passes).toBe(false);
    expect(result.reasons.join(' ')).toContain('ugao');
  });

  it('odbija temu koju javlja jedan izvor', () => {
    const result = checkQualityGates(
      { distinctSources: 1, distinctAngles: 1, size: 1 },
      thresholds,
    );
    expect(result.passes).toBe(false);
    expect(result.reasons).toHaveLength(3);
  });
});
