import type { Angle } from '@ai-novine/core';
import {
  buildIdf,
  combinedSimilarity,
  cosineSimilarity,
  entityOverlap,
  toUnitVector,
  vectorizeDocument,
  type DocumentVector,
} from './vectorize.js';

/**
 * Inkrementalno klasterovanje: svaka nova vest se pridružuje postojećoj temi
 * ako joj je dovoljno slična, inače otvara novu. Bez AI poziva.
 */

export interface ItemInput {
  id: string;
  sourceId: string;
  angle: Angle;
  title: string;
  content: string | null;
  publishedAt: number;
}

export interface ExistingCluster {
  id: string;
  /** Sačuvani centroid: koren → težina. */
  centroid: Record<string, number>;
  entities: string[];
  sourceIds: string[];
  angles: Angle[];
  itemTimes: number[];
  size: number;
}

export interface ClusterState {
  id: string | null;
  /** `true` za teme nastale u ovom ciklusu. */
  isNew: boolean;
  members: ItemInput[];
  vector: Map<string, number>;
  entities: string[];
  sourceIds: Set<string>;
  angles: Set<Angle>;
  itemTimes: number[];
  /** Sličnosti kojima su članovi pridruženi — za dnevnik i proveru. */
  similarities: number[];
  /** Postavljeno kad je tema spojena u drugu; takva se ne upisuje. */
  absorbedInto?: ClusterState;
  keywords: string[];
  titleSample: string;
  existingSize: number;
}

export interface ClusterOptions {
  /** Iznad ove sličnosti vest ulazi u postojeću temu. */
  threshold: number;
  /**
   * Iznad ove sličnosti se dve teme spajaju u drugom prolazu.
   * Podrazumevano je prag dodavanja plus 0.2 — spajanje mora biti strože od
   * dodavanja, jer greška spaja ceo niz tekstova, a ne jedan.
   */
  mergeThreshold?: number;
}

export interface ClusterOutcome {
  clusters: ClusterState[];
  /** Broj vesti koje su ušle u već postojeću temu. */
  joinedExisting: number;
  /** Broj novih tema otvorenih u ovom ciklusu. */
  created: number;
  /** Broj tema spojenih u drugom prolazu. */
  merged: number;
  /** Teme iz baze koje su spojene u drugu — brišu se posle upisa. */
  absorbedIds: string[];
}

export function clusterItems(
  items: ItemInput[],
  existing: ExistingCluster[],
  options: ClusterOptions,
): ClusterOutcome {
  const vectors = new Map<string, DocumentVector>();
  for (const item of items) {
    vectors.set(
      item.id,
      vectorizeDocument({ id: item.id, title: item.title, content: item.content }),
    );
  }

  const idf = buildIdf([...vectors.values()]);
  const unit = new Map<string, Map<string, number>>();
  for (const [id, vector] of vectors) unit.set(id, toUnitVector(vector.terms, idf));

  // Postojeće teme ulaze kao polazna stanja; nove se dodaju u toku prolaza.
  const states: ClusterState[] = existing.map((cluster) => ({
    id: cluster.id,
    isNew: false,
    members: [],
    vector: normalizeStored(cluster.centroid),
    entities: [...cluster.entities],
    sourceIds: new Set(cluster.sourceIds),
    angles: new Set(cluster.angles),
    itemTimes: [...cluster.itemTimes],
    similarities: [],
    keywords: [],
    titleSample: '',
    existingSize: cluster.size,
  }));

  const outcome: ClusterOutcome = {
    clusters: states,
    joinedExisting: 0,
    created: 0,
    merged: 0,
    absorbedIds: [],
  };

  // Starije vesti prve — tema tako nastaje oko prvog izveštaja, a kasniji
  // tekstovi se dodaju na nju.
  const ordered = [...items].sort((a, b) => a.publishedAt - b.publishedAt);

  for (const item of ordered) {
    const vector = vectors.get(item.id);
    const unitVector = unit.get(item.id);
    if (!vector || !unitVector) continue;

    let best: { state: ClusterState; similarity: number } | null = null;

    for (const state of states) {
      if (state.vector.size === 0) continue;

      const text = cosineSimilarity(unitVector, state.vector);
      // Preskoči račun sa imenima kad tekst ni izbliza ne odgovara.
      if (text < options.threshold / 2) continue;

      const similarity = combinedSimilarity(text, entityOverlap(vector.entities, state.entities));
      if (!best || similarity > best.similarity) best = { state, similarity };
    }

    if (best && best.similarity >= options.threshold) {
      addToCluster(best.state, item, vector, unitVector, best.similarity);
      if (!best.state.isNew) outcome.joinedExisting += 1;
      continue;
    }

    const fresh: ClusterState = {
      id: null,
      isNew: true,
      members: [],
      vector: new Map(),
      entities: [],
      sourceIds: new Set(),
      angles: new Set(),
      itemTimes: [],
      similarities: [],
      keywords: [],
      titleSample: '',
      existingSize: 0,
    };
    addToCluster(fresh, item, vector, unitVector, 1);
    states.push(fresh);
    outcome.created += 1;
  }

  outcome.merged = mergeSimilarClusters(states, options.mergeThreshold ?? options.threshold + 0.2);
  outcome.clusters = states.filter((state) => !state.absorbedInto);

  for (const state of outcome.clusters) {
    state.keywords = topKeywords(state, vectors);
    if (!state.titleSample && state.members[0]) state.titleSample = state.members[0].title;
  }

  outcome.absorbedIds = states
    .filter((state) => state.absorbedInto && state.id)
    .map((state) => state.id as string);

  return outcome;
}

/**
 * Drugi prolaz: spajanje tema koje su ostale razdvojene.
 *
 * Ista prica ume da udje u dve teme kad su uglovi izvestavanja razliciti —
 * „helikopteri gase pozar" i „pozar ne preti kucama" su isti dogadjaj, ali
 * pojedinacni tekstovi nisu dovoljno slicni da se spoje pri dodavanju. Centroidi
 * tih tema, medjutim, jesu.
 *
 * Dve teme koje obe vec postoje u bazi se NE spajaju — to bi tražilo brisanje
 * i premestanje veza, a dobitak je mali. Spaja se nova sa novom, ili nova sa
 * postojecom.
 */
function mergeSimilarClusters(states: ClusterState[], threshold: number): number {
  const active = states.filter((state) => state.members.length > 0 && !state.absorbedInto);
  let merged = 0;

  for (let i = 0; i < active.length; i += 1) {
    const target = active[i];
    if (!target || target.absorbedInto) continue;

    for (let j = i + 1; j < active.length; j += 1) {
      const other = active[j];
      if (!other || other.absorbedInto) continue;
      if (target.id && other.id) continue;

      const text = cosineSimilarity(target.vector, other.vector);
      if (text < threshold / 2) continue;

      const similarity = combinedSimilarity(text, entityOverlap(target.entities, other.entities));
      if (similarity < threshold) continue;

      absorb(target, other);
      merged += 1;
    }
  }
  return merged;
}

function absorb(target: ClusterState, other: ClusterState): void {
  target.members.push(...other.members);
  target.itemTimes.push(...other.itemTimes);
  target.similarities.push(...other.similarities);
  for (const sourceId of other.sourceIds) target.sourceIds.add(sourceId);
  for (const angle of other.angles) target.angles.add(angle);
  for (const entity of other.entities) {
    if (!target.entities.includes(entity)) target.entities.push(entity);
  }
  target.entities = target.entities.slice(0, 20);

  // Centroid spojene teme je prosek dva centroida, tezinski po broju tekstova.
  const targetWeight = target.members.length - other.members.length;
  const otherWeight = other.members.length;
  const total = Math.max(1, targetWeight + otherWeight);

  for (const [term, weight] of other.vector) {
    const current = target.vector.get(term) ?? 0;
    target.vector.set(term, (current * targetWeight + weight * otherWeight) / total);
  }

  other.absorbedInto = target;
}

function addToCluster(
  state: ClusterState,
  item: ItemInput,
  vector: DocumentVector,
  unitVector: Map<string, number>,
  similarity: number,
): void {
  state.members.push(item);
  state.sourceIds.add(item.sourceId);
  state.angles.add(item.angle);
  state.itemTimes.push(item.publishedAt);
  state.similarities.push(Math.round(similarity * 1000) / 1000);
  if (!state.titleSample) state.titleSample = item.title;

  // Centroid je prosek vektora članova, pa se tema „pomera" ka novim tekstovima.
  const size = state.members.length + state.existingSize;
  for (const [term, weight] of unitVector) {
    const current = state.vector.get(term) ?? 0;
    state.vector.set(term, current + (weight - current) / size);
  }

  for (const entity of vector.entities) {
    if (!state.entities.includes(entity)) state.entities.push(entity);
  }
  state.entities = state.entities.slice(0, 20);
}

/** Sačuvani centroid iz baze u mapu, uz normalizaciju na dužinu 1. */
function normalizeStored(centroid: Record<string, number>): Map<string, number> {
  const map = new Map(Object.entries(centroid));
  let sumOfSquares = 0;
  for (const weight of map.values()) sumOfSquares += weight * weight;

  const length = Math.sqrt(sumOfSquares);
  if (length === 0) return map;

  for (const [term, weight] of map) map.set(term, weight / length);
  return map;
}

/** Najteži koreni teme, prikazani u čitljivom obliku. */
function topKeywords(
  state: ClusterState,
  vectors: Map<string, DocumentVector>,
  limit = 8,
): string[] {
  const surface = new Map<string, string>();
  for (const member of state.members) {
    const vector = vectors.get(member.id);
    if (!vector) continue;
    for (const [term, word] of vector.surface) if (!surface.has(term)) surface.set(term, word);
  }

  return [...state.vector.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term]) => surface.get(term) ?? term);
}

/** Centroid nazad u oblik za upis u bazu; čuva se samo ono što nosi težinu. */
export function centroidToJson(vector: Map<string, number>, limit = 120): Record<string, number> {
  return Object.fromEntries(
    [...vector.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([term, weight]) => [term, Math.round(weight * 10_000) / 10_000]),
  );
}
