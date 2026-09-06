import {
  activeSources,
  createLogger,
  loadEditorialConfig,
  type Angle,
  type EditorialConfig,
} from '@ai-novine/core';
import {
  articlesWrittenToday,
  clusterIdsInFlight,
  clusterSourceItems,
  clustersWithoutArticle,
  finishRun,
  insertArticle,
  markBatchCollected,
  markClusterCovered,
  markClusterNeedsFlagship,
  monthlySpend,
  pendingBatches,
  recordBatchSubmission,
  startRun,
} from '@ai-novine/db';
import { batchState, collectBatch, submitBatch, type BatchItem } from '../generate/batch.js';
import { formatUsd } from '../generate/cost.js';
import type { TopicMaterial } from '../generate/prompt.js';
import { paragraphsToText } from '../generate/schema.js';
import { selectClustersForGeneration, slugify } from '../generate/select.js';
import { countWords } from '../ingest/normalize.js';
import type { SupabaseClient } from '@supabase/supabase-js';

const log = createLogger('editorial');

/**
 * Asinhrono pisanje kroz Batch API — pola cene, uz zakašnjenje od jednog ciklusa.
 *
 * Jedan ciklus pošalje paket i završi; sledeći pokupi rezultate i pošalje novi.
 * Cron na sat vremena tako nikad ne stoji i ne čeka odgovor modela.
 */

export async function submitBatches(
  client: SupabaseClient,
  editorial: EditorialConfig,
  limit?: number,
): Promise<void> {
  const spent = await monthlySpend(client);
  if (spent >= editorial.limits.monthlyBudgetUsd) {
    log.error('Mesečni budžet je potrošen — paket se ne šalje.', {
      potroseno: formatUsd(spent),
      budzet: formatUsd(editorial.limits.monthlyBudgetUsd),
    });
    return;
  }

  const inFlight = await clusterIdsInFlight(client);
  if (inFlight.size > 0) {
    log.info('Neki paketi još čekaju odgovor; te teme se preskaču.', { tema: inFlight.size });
  }

  const written = await articlesWrittenToday(client, editorial.models.flagship);
  const candidates = (await clustersWithoutArticle(client, 60)).filter(
    (row) => !inFlight.has(row.id),
  );

  const outcome = selectClustersForGeneration(
    candidates.map((row) => ({
      clusterId: row.id,
      titleSample: row.title_sample,
      trendingScore: row.trending_score,
      distinctSources: row.distinct_sources,
      distinctAngles: row.angles.length,
      size: row.size,
      needsFlagship: row.needs_flagship,
    })),
    editorial.gates,
    {
      maxPerRun: limit ?? editorial.limits.maxArticlesPerEditorialRun,
      maxPerDay: editorial.limits.maxArticlesPerDay,
      maxFlagshipPerDay: editorial.limits.maxFlagshipArticlesPerDay,
      writtenToday: written.total,
      flagshipWrittenToday: written.flagship,
    },
  );

  if (outcome.selected.length === 0) {
    log.info('Nema tema za slanje.', { kandidata: candidates.length });
    return;
  }

  const angleById = new Map(activeSources().map((source) => [source.id, source.angle]));

  // Jedan paket po modelu — cena i keširanje su vezani za model.
  const byModel = new Map<string, { items: BatchItem[]; clusterMap: Record<string, string> }>();

  for (const selection of outcome.selected) {
    const model =
      selection.tier === 'flagship' ? editorial.models.flagship : editorial.models.default;

    const items = await clusterSourceItems(client, selection.candidate.clusterId);
    if (items.length === 0) continue;

    const material: TopicMaterial = {
      topicTitle: selection.candidate.titleSample ?? 'Tema bez naslova',
      keywords: [],
      entities: [],
      sources: items.map((item) => ({
        angle: (angleById.get(item.source_id) ?? 'mejnstrim') as Angle,
        title: item.title,
        summary: item.summary,
        content: item.content,
        publishedAt: item.published_at,
      })),
    };

    const bucket = byModel.get(model) ?? { items: [], clusterMap: {} };
    // custom_id sme samo slova, cifre, crticu i donju crtu.
    const customId = `tema-${selection.candidate.clusterId}`;
    bucket.items.push({ customId, material });
    bucket.clusterMap[customId] = selection.candidate.clusterId;
    byModel.set(model, bucket);
  }

  for (const [model, bucket] of byModel) {
    const submitted = await submitBatch(bucket.items, {
      model,
      maxOutputTokens: editorial.models.maxOutputTokens,
      effort: 'medium',
    });

    await recordBatchSubmission(client, {
      batchId: submitted.batchId,
      model,
      requestCount: submitted.requestCount,
      clusterMap: bucket.clusterMap,
    });
  }

  log.info('Paketi poslati; rezultati se kupe u sledećem ciklusu.', {
    paketa: byModel.size,
    tema: outcome.selected.length,
  });
}

export async function collectBatches(
  client: SupabaseClient,
  editorial: EditorialConfig,
): Promise<void> {
  const batches = await pendingBatches(client);
  if (batches.length === 0) {
    log.info('Nema paketa koji čekaju.');
    return;
  }

  const runId = await startRun(client, 'editorial');
  const startedAt = Date.now();
  let written = 0;
  let sensitive = 0;
  let escalations = 0;
  let totalCost = 0;
  const errors: string[] = [];

  try {
    for (const batch of batches) {
      const state = await batchState(batch.batch_id);
      if (state.state !== 'ended') {
        log.info('Paket još nije gotov.', {
          paket: batch.batch_id,
          uObradi: state.processing,
          gotovo: state.succeeded,
        });
        continue;
      }

      const results = await collectBatch(batch.batch_id, batch.model);
      let batchCost = 0;
      let failed = 0;

      for (const item of results.articles) {
        const clusterId = batch.cluster_map[item.customId];
        if (!clusterId) continue;

        const words = countWords(`${item.article.lead} ${item.article.body.join(' ')}`);
        batchCost += item.cost.totalCost;

        // Prekratak tekst se ne objavljuje (brief, sekcija 9). U paketu se od
        // modela ne može tražiti dopuna, pa temu u sledećem paketu piše jači model.
        if (words < editorial.gates.minWordsToPublish) {
          await markClusterNeedsFlagship(client, clusterId);
          failed += 1;
          escalations += 1;
          errors.push(`${clusterId}: ${words} reči, prelazi na jači model`);
          continue;
        }

        const articleId = await insertArticle(client, {
          cluster_id: clusterId,
          slug: slugify(item.article.title),
          title: item.article.title,
          lead: item.article.lead,
          body: paragraphsToText(item.article.body),
          category: item.article.category,
          status: item.article.sensitive ? 'pending_review' : 'draft',
          sensitive: item.article.sensitive,
          sensitivity_reason: item.article.sensitivityReason,
          both_sides: item.article.bothSides,
          sources_diverge: item.article.sourcesDiverge,
          keywords: item.article.keywords,
          notes: item.article.notes,
          word_count: words,
          model: batch.model,
          usage: {
            ulazniTokeni: item.cost.inputTokens,
            izlazniTokeni: item.cost.outputTokens,
            kesUpis: item.cost.cacheCreationTokens,
            kesCitanje: item.cost.cacheReadTokens,
          },
          cost_usd: Number(item.cost.totalCost.toFixed(6)),
          published_at: null,
        });

        await markClusterCovered(client, clusterId, articleId);
        written += 1;
        if (item.article.sensitive) sensitive += 1;
      }

      for (const failure of results.failures) {
        const clusterId = batch.cluster_map[failure.customId];
        failed += 1;
        errors.push(`${clusterId ?? failure.customId}: ${failure.reason}`);
        if (clusterId && failure.retryable) await markClusterNeedsFlagship(client, clusterId);
      }

      totalCost += batchCost;
      await markBatchCollected(client, batch.batch_id, {
        succeeded: results.articles.length,
        failed,
        costUsd: batchCost,
        errors: errors.slice(-20),
      });
    }

    const stats = {
      napisano: written,
      osetljivih: sensitive,
      presloNaJaciModel: escalations,
      trosakUsd: Number(totalCost.toFixed(6)),
      gresaka: errors.length,
      trajanjeSekundi: Math.round((Date.now() - startedAt) / 1000),
    };
    await finishRun(client, runId, true, stats, errors);
    log.info('Rezultati paketa pokupljeni.', { ...stats, trosak: formatUsd(totalCost) });
  } catch (error) {
    await finishRun(client, runId, false, {}, [...errors, (error as Error).message]);
    throw error;
  }
}

/** Zajednički ulaz za oba koraka, radi jednostavnijeg poziva iz komande. */
export async function runBatchCycle(client: SupabaseClient, limit?: number): Promise<void> {
  const editorial = loadEditorialConfig();
  await collectBatches(client, editorial);
  await submitBatches(client, editorial, limit);
}
