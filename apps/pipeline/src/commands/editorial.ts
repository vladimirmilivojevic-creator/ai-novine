import {
  activeSources,
  createLogger,
  loadDotEnv,
  loadEditorialConfig,
  type Angle,
} from '@ai-novine/core';
import {
  articlesWrittenToday,
  monthlySpend,
  updatesToday,
  clusterSourceItems,
  clustersWithoutArticle,
  createServiceClient,
  finishRun,
  insertArticle,
  markClusterCovered,
  startRun,
} from '@ai-novine/db';
import { formatUsd } from '../generate/cost.js';
import { generateArticle, GenerationError } from '../generate/generate.js';
import type { TopicMaterial } from '../generate/prompt.js';
import { selectClustersForGeneration, slugify } from '../generate/select.js';
import { runBatchCycle } from './editorial-batch.js';
import { maxUpdatesPerRun, runArticleUpdates } from './updates.js';
import { paragraphsToText } from '../generate/schema.js';

const log = createLogger('editorial');

export interface EditorialOptions {
  /** Ne zovi model i ne upisuj ništa — samo pokaži šta bi bilo napisano. */
  dryRun: boolean;
  /** Gornja granica članaka u ovom ciklusu; podrazumevano iz konfiguracije. */
  limit?: number;
  /**
   * Asinhrono pisanje kroz Batch API — pola cene, uz zakašnjenje od jednog
   * ciklusa. Jedan ciklus pokupi prethodni paket i pošalje novi.
   */
  batch: boolean;
}

/**
 * Urednički ciklus: bira teme koje zaslužuju članak i piše ih.
 *
 * Osetljivi članci (krivične teme, tragedije, sudski postupci) ne idu u objavu
 * nego u `pending_review` — u Fazi 7 odatle stižu na Telegram na odobrenje.
 * Ostali ostaju `draft` dok sajt ne postoji (Faza 9).
 */
export async function runEditorial(options: EditorialOptions): Promise<void> {
  loadDotEnv();

  const editorial = loadEditorialConfig();
  const client = createServiceClient();
  const angleById = new Map(activeSources().map((source) => [source.id, source.angle]));

  if (options.batch && !options.dryRun) {
    await runBatchCycle(client, options.limit);
    return;
  }

  // Kočnica pre svega ostalog: bolje da nekog dana nema novih članaka nego da
  // račun eksplodira zbog greške u kodu ili dana sa neuobičajeno mnogo vesti.
  const spent = await monthlySpend(client);
  const budget = editorial.limits.monthlyBudgetUsd;
  if (spent >= budget) {
    log.error('Mesečni budžet je potrošen — generisanje se preskače do prvog u mesecu.', {
      potroseno: formatUsd(spent),
      budzet: formatUsd(budget),
    });
    return;
  }
  log.info('Stanje budžeta.', {
    potroseno: formatUsd(spent),
    budzet: formatUsd(budget),
    preostalo: formatUsd(budget - spent),
  });

  const written = await articlesWrittenToday(client, editorial.models.flagship);
  const updatesDone = await updatesToday(client);

  // Dopune idu PRE pisanja novih clanaka: prica koja se razvija je vrednija od
  // jos jedne nove teme (brief, sekcije 5 i 9).
  //
  // Dopuna se placa kao i pisanje, pa TROSI ISTU DNEVNU GRANICU. Bez toga bi
  // svaki ciklus dodavao poziv modelu van plana i budzet bi tiho probijen.
  const roomToday = Math.max(0, editorial.limits.maxArticlesPerDay - written.total - updatesDone);
  const updates = await runArticleUpdates(client, editorial, {
    budgetLeft: budget - spent,
    maxUpdates: Math.min(maxUpdatesPerRun(editorial), roomToday),
    dryRun: options.dryRun,
  });
  const candidates = await clustersWithoutArticle(client, 60);

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
      maxPerRun: options.limit ?? editorial.limits.maxArticlesPerEditorialRun,
      maxPerDay: editorial.limits.maxArticlesPerDay,
      maxFlagshipPerDay: editorial.limits.maxFlagshipArticlesPerDay,
      // Dopune se broje kao i novi clanci — obe stvari kostaju isto.
      writtenToday: written.total + updatesDone + updates.updated,
      flagshipWrittenToday: written.flagship,
    },
  );

  log.info('Izbor tema završen.', {
    kandidata: candidates.length,
    izabrano: outcome.selected.length,
    odbijeno: outcome.rejected.length,
    danasNapisano: written.total,
    danasDopunjeno: updatesDone + updates.updated,
    dnevnaGranica: editorial.limits.maxArticlesPerDay,
  });

  for (const rejection of outcome.rejected.slice(0, 5)) {
    log.debug(`Preskočeno: ${rejection.candidate.titleSample ?? rejection.candidate.clusterId}`, {
      razlozi: rejection.reasons,
    });
  }

  if (options.dryRun) {
    console.log('');
    console.log('Probni režim — nijedan poziv modelu nije poslat.');
    console.log('');
    for (const [index, selection] of outcome.selected.entries()) {
      console.log(
        `${String(index + 1).padStart(2)}. [${selection.tier === 'flagship' ? editorial.models.flagship : editorial.models.default}] ` +
          `skor ${selection.candidate.trendingScore} · ${selection.candidate.size} tekstova iz ` +
          `${selection.candidate.distinctSources} izvora — ${(selection.candidate.titleSample ?? '').slice(0, 60)}`,
      );
    }
    console.log('');
    return;
  }

  if (outcome.selected.length === 0) {
    log.info('Nijedna tema ne prolazi kapije ili je dnevna granica potrošena.');
    return;
  }

  const runId = await startRun(client, 'editorial');
  const startedAt = Date.now();
  const errors: string[] = [];
  let written_ = 0;
  let sensitive = 0;
  let escalated = 0;
  let totalCost = 0;

  try {
    for (const selection of outcome.selected) {
      const model =
        selection.tier === 'flagship' ? editorial.models.flagship : editorial.models.default;

      const items = await clusterSourceItems(client, selection.candidate.clusterId);
      if (items.length === 0) {
        errors.push(`${selection.candidate.clusterId}: tema nema nijedan tekst`);
        continue;
      }

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

      try {
        let result;
        try {
          result = await generateArticle(material, {
            model,
            maxOutputTokens: editorial.models.maxOutputTokens,
            effort: 'medium',
            minWords: editorial.gates.minWordsToPublish,
          });
        } catch (error) {
          // Jeftiniji model ume da ne dogura do 350 reči ni posle dopune. Tada
          // temu preuzima jači model umesto da ostane bez članka — to je i
          // jeftinije nego da svi članci idu na jači model.
          const escalatable =
            error instanceof GenerationError &&
            error.kind === 'too_short' &&
            model !== editorial.models.flagship;
          if (!escalatable) throw error;

          log.warn('Tema prelazi na jači model jer tekst nije dostigao potrebnu dužinu.', {
            tema: selection.candidate.titleSample?.slice(0, 60),
            razlog: (error as GenerationError).message,
          });
          escalated += 1;
          result = await generateArticle(material, {
            model: editorial.models.flagship,
            maxOutputTokens: editorial.models.maxOutputTokens,
            effort: 'medium',
            minWords: editorial.gates.minWordsToPublish,
          });
        }

        const usedModel = result.cost.model;
        const article = result.article;
        const articleId = await insertArticle(client, {
          cluster_id: selection.candidate.clusterId,
          slug: slugify(article.title),
          title: article.title,
          lead: article.lead,
          body: paragraphsToText(article.body),
          category: article.category,
          // Osetljiv clanak ceka ljudsku proveru (brief, sekcija 7).
          status: article.sensitive ? 'pending_review' : 'draft',
          sensitive: article.sensitive,
          sensitivity_reason: article.sensitivityReason,
          both_sides: article.bothSides,
          sources_diverge: article.sourcesDiverge,
          keywords: article.keywords,
          notes: article.notes,
          word_count: result.wordCount,
          model: usedModel,
          usage: {
            ulazniTokeni: result.cost.inputTokens,
            izlazniTokeni: result.cost.outputTokens,
            kesUpis: result.cost.cacheCreationTokens,
            kesCitanje: result.cost.cacheReadTokens,
          },
          cost_usd: Number(result.cost.totalCost.toFixed(6)),
          published_at: null,
        });

        await markClusterCovered(client, selection.candidate.clusterId, articleId);

        written_ += 1;
        totalCost += result.cost.totalCost;
        if (article.sensitive) sensitive += 1;
      } catch (error) {
        if (!(error instanceof GenerationError)) throw error;
        errors.push(`${selection.candidate.clusterId}: ${error.message}`);
        log.error(`Tema nije napisana: ${error.message}`);

        // Bez kredita ili sa odbijenim ključem nema smisla nastaviti ciklus.
        if (error.kind === 'credit' || error.kind === 'auth') break;
      }
    }

    const stats = {
      napisano: written_,
      dopunjeno: updates.updated,
      trosakDopunaUsd: Number(updates.cost.toFixed(6)),
      osetljivih: sensitive,
      presloNaJaciModel: escalated,
      mesecnoUkupnoUsd: Number((spent + totalCost).toFixed(6)),
      trosakUsd: Number(totalCost.toFixed(6)),
      gresaka: errors.length,
      trajanjeSekundi: Math.round((Date.now() - startedAt) / 1000),
    };

    await finishRun(client, runId, errors.length === 0, stats, [...errors, ...updates.errors]);
    log.info('Urednički ciklus završen.', { ...stats, trosak: formatUsd(totalCost) });
  } catch (error) {
    await finishRun(client, runId, false, {}, [...errors, (error as Error).message]);
    throw error;
  }
}
