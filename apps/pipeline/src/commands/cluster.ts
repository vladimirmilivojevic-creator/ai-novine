import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  activeSources,
  createLogger,
  isMultiEventTitle,
  loadDotEnv,
  loadEditorialConfig,
  reportsDir,
  type Angle,
} from '@ai-novine/core';
import {
  addClusterItems,
  clusteredItemIds,
  deleteAllClusters,
  deleteClusters,
  createServiceClient,
  finishRun,
  openClusters,
  rawItemsForClustering,
  saveCluster,
  startRun,
  topClusters,
  type ClusterWithMembers,
} from '@ai-novine/db';
import {
  centroidToJson,
  clusterItems,
  type ExistingCluster,
  type ItemInput,
} from '../cluster/cluster.js';
import { checkQualityGates, trendingScore } from '../cluster/trending.js';

const log = createLogger('cluster');

export interface ClusterCommandOptions {
  /** Koliko tema ide u izveštaj. */
  report: number;
  /** Samo izveštaj o postojećim temama, bez novog klasterovanja. */
  reportOnly: boolean;
  /** Obriši sve teme i grupiši ispočetka. */
  reset: boolean;
}

export async function runCluster(options: ClusterCommandOptions): Promise<void> {
  loadDotEnv();

  const editorial = loadEditorialConfig();
  const client = createServiceClient();

  if (options.reset) {
    // Teme su izvedeni podatak — uvek se mogu napraviti ponovo iz raw_items.
    // Ovo treba posle svake promene praga ili nacina poredjenja.
    const removed = await deleteAllClusters(client);
    log.warn('Sve teme obrisane, grupisanje krece ispocetka.', { obrisanoTema: removed });
  }

  if (!options.reportOnly) {
    await buildClusters(client, editorial);
  }

  await writeReport(client, editorial, options.report);
}

async function buildClusters(
  client: ReturnType<typeof createServiceClient>,
  editorial: ReturnType<typeof loadEditorialConfig>,
): Promise<void> {
  const runId = await startRun(client, 'editorial');
  const startedAt = Date.now();

  try {
    const angleById = new Map(activeSources().map((source) => [source.id, source.angle]));

    const rows = await rawItemsForClustering(client, editorial.clustering.windowHours);
    const alreadyClustered = await clusteredItemIds(
      client,
      rows.map((row) => row.id),
    );

    // Pregledi dana pokrivaju više nepovezanih događaja odjednom, pa bi svaku
    // temu u koju uđu delom pogrešno predstavljali. Uživo blogovi ostaju.
    const roundups = rows.filter((row) => isMultiEventTitle(row.title)).length;

    const items: ItemInput[] = rows
      .filter((row) => !alreadyClustered.has(row.id))
      .filter((row) => row.title.length >= editorial.clustering.minTitleChars)
      .filter((row) => !isMultiEventTitle(row.title))
      .map((row) => ({
        id: row.id,
        sourceId: row.source_id,
        angle: (angleById.get(row.source_id) ?? 'mejnstrim') as Angle,
        title: row.title,
        content: row.content,
        // Bez datuma objave uzima se vreme preuzimanja — za sveže vesti je to
        // razlika od par minuta.
        publishedAt: new Date(row.published_at ?? row.fetched_at).getTime(),
      }));

    const existingRows = await openClusters(client, editorial.clustering.windowHours);
    const existing: ExistingCluster[] = existingRows.map((row) => ({
      id: row.id,
      centroid: row.centroid,
      entities: row.entities,
      sourceIds: [],
      angles: row.angles as Angle[],
      itemTimes: row.last_item_at ? [new Date(row.last_item_at).getTime()] : [],
      size: row.size,
    }));

    log.info('Počinje klasterovanje.', {
      vestiUProzoru: rows.length,
      novih: items.length,
      otvorenihTema: existing.length,
      prag: editorial.clustering.similarityThreshold,
    });

    const outcome = clusterItems(items, existing, {
      threshold: editorial.clustering.similarityThreshold,
      mergeThreshold: editorial.clustering.mergeThreshold,
    });

    let savedClusters = 0;
    let savedLinks = 0;

    for (const state of outcome.clusters) {
      if (state.members.length === 0) continue;

      const times = state.itemTimes;
      const existingRow = state.id ? existingRows.find((row) => row.id === state.id) : undefined;

      const sourceIds = new Set([...state.sourceIds]);
      const angles = new Set<string>([...state.angles, ...(existingRow?.angles ?? [])]);
      const size = state.members.length + state.existingSize;

      const trending = trendingScore({
        distinctSources: Math.max(sourceIds.size, existingRow?.distinct_sources ?? 0),
        distinctAngles: angles.size,
        itemTimes: times,
      });

      const clusterId = await saveCluster(client, {
        id: state.id,
        first_item_at: isoOrNull(Math.min(...times)),
        last_item_at: isoOrNull(Math.max(...times)),
        size,
        distinct_sources: Math.max(sourceIds.size, existingRow?.distinct_sources ?? 0),
        angles: [...angles],
        keywords: state.keywords,
        entities: state.entities.slice(0, 15),
        centroid: centroidToJson(state.vector),
        trending_score: trending.score,
        title_sample: state.titleSample || (existingRow?.title_sample ?? null),
      });

      savedClusters += 1;
      savedLinks += await addClusterItems(
        client,
        clusterId,
        state.members.map((member, index) => ({
          rawItemId: member.id,
          similarity: state.similarities[index] ?? 0,
        })),
      );
    }

    // Teme koje su u drugom prolazu spojene u drugu — njihove veze su vec
    // prepisane na novu temu, pa stari red vise nema clanove.
    if (outcome.absorbedIds.length > 0) {
      await deleteClusters(client, outcome.absorbedIds);
    }

    const stats = {
      vestiUProzoru: rows.length,
      preskocenoPregledaDana: roundups,
      novihVesti: items.length,
      novihTema: outcome.created,
      spojenoTema: outcome.merged,
      pridruzenoPostojecim: outcome.joinedExisting,
      upisanoTema: savedClusters,
      upisanoVeza: savedLinks,
      trajanjeSekundi: Math.round((Date.now() - startedAt) / 1000),
    };

    await finishRun(client, runId, true, stats, []);
    log.info('Klasterovanje završeno.', stats);
  } catch (error) {
    await finishRun(client, runId, false, {}, [(error as Error).message]);
    throw error;
  }
}

/**
 * Izveštaj koji vlasnik čita: najjače teme dana, sa naslovima unutar svake i sa
 * jasnom oznakom da li tema prolazi kapije kvaliteta.
 */
async function writeReport(
  client: ReturnType<typeof createServiceClient>,
  editorial: ReturnType<typeof loadEditorialConfig>,
  limit: number,
): Promise<void> {
  const clusters = await topClusters(client, limit, 1);
  const names = new Map(activeSources().map((source) => [source.id, source.name]));

  const lines: string[] = [];
  lines.push('# Teme dana');
  lines.push('');
  lines.push(`**Vreme:** ${new Date().toLocaleString('sr-RS', { timeZone: 'Europe/Belgrade' })}`);
  lines.push(`**Prikazano tema:** ${clusters.length}`);
  lines.push('');
  lines.push(
    'Teme su grupisane leksički, bez ijednog AI poziva. „Prolazi kapije" znači da temu javlja ' +
      `najmanje ${editorial.gates.minDistinctSources} nezavisna izvora iz najmanje ` +
      `${editorial.gates.minDistinctAngles} različita ugla — tek takva tema ide na pisanje članka u Fazi 5.`,
  );
  lines.push('');

  let passing = 0;

  for (const [index, cluster] of clusters.entries()) {
    const gates = checkQualityGates(
      {
        distinctSources: cluster.distinct_sources,
        distinctAngles: cluster.angles.length,
        size: cluster.size,
      },
      editorial.gates,
    );
    if (gates.passes) passing += 1;

    lines.push(`## ${index + 1}. ${cluster.title_sample ?? '(bez naslova)'}`);
    lines.push('');
    lines.push(
      `**Skor:** ${cluster.trending_score} · **tekstova:** ${cluster.size} · ` +
        `**izvora:** ${cluster.distinct_sources} · **uglova:** ${cluster.angles.length} ` +
        `(${cluster.angles.join(', ')})`,
    );
    lines.push('');
    lines.push(
      gates.passes
        ? '✅ **Prolazi kapije kvaliteta**'
        : `❌ Ne prolazi: ${gates.reasons.join('; ')}`,
    );
    lines.push('');
    if (cluster.keywords.length > 0) lines.push(`**Ključne reči:** ${cluster.keywords.join(', ')}`);
    if (cluster.entities.length > 0) {
      lines.push(`**Imena i nazivi:** ${cluster.entities.slice(0, 8).join(', ')}`);
    }
    lines.push('');
    lines.push('| Izvor | Naslov |');
    lines.push('| --- | --- |');
    for (const member of cluster.members) {
      const name = names.get(member.source_id) ?? member.source_id;
      lines.push(`| ${name} | [${escapePipes(member.title)}](${member.url}) |`);
    }
    lines.push('');
  }

  mkdirSync(reportsDir, { recursive: true });
  const path = join(reportsDir, 'teme-dana.md');
  writeFileSync(path, `${lines.join('\n')}\n`, 'utf8');

  log.info('Izveštaj napisan.', {
    fajl: path,
    tema: clusters.length,
    prolaziKapije: passing,
  });

  printSummary(clusters, passing);
}

function printSummary(clusters: ClusterWithMembers[], passing: number): void {
  console.log('');
  console.log(`Najjače teme (${clusters.length}), kapije prolazi ${passing}:`);
  console.log('');
  for (const [index, cluster] of clusters.entries()) {
    console.log(
      `${String(index + 1).padStart(2)}. [skor ${String(cluster.trending_score).padStart(6)}] ` +
        `${cluster.size} tekst(ova) iz ${cluster.distinct_sources} izvora / ` +
        `${cluster.angles.length} ugla — ${(cluster.title_sample ?? '').slice(0, 70)}`,
    );
  }
  console.log('');
}

function isoOrNull(time: number): string | null {
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function escapePipes(text: string): string {
  return text.replace(/\|/g, '\\|');
}
