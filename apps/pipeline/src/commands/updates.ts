import { activeSources, createLogger, type Angle, type EditorialConfig } from '@ai-novine/core';
import {
  applyArticleUpdate,
  clustersNeedingUpdate,
  getArticle,
  newClusterItemsSince,
  type UpdateCandidate,
} from '@ai-novine/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatUsd } from '../generate/cost.js';
import { generateArticle, GenerationError } from '../generate/generate.js';
import type { TopicMaterial } from '../generate/prompt.js';
import { paragraphsToText } from '../generate/schema.js';

const log = createLogger('updates');

/**
 * Dopuna već objavljenih članaka novim izveštajima (Faza 6).
 *
 * Priča koja se razvija dobija **jedan članak koji raste**, a ne četiri skoro
 * identična. Slug i URL ostaju isti, stara verzija ide u istoriju.
 *
 * Dopune se plaćaju kao i pisanje, pa ulaze u istu dnevnu granicu i isti
 * mesečni budžet. Zato imaju prag: tema mora dobiti nove izveštaje iz najmanje
 * dva različita izvora da bi se članak uopšte dirao.
 */

export interface UpdateOutcome {
  updated: number;
  skipped: number;
  cost: number;
  errors: string[];
}

export async function runArticleUpdates(
  client: SupabaseClient,
  editorial: EditorialConfig,
  options: { budgetLeft: number; maxUpdates: number; dryRun?: boolean },
): Promise<UpdateOutcome> {
  const outcome: UpdateOutcome = { updated: 0, skipped: 0, cost: 0, errors: [] };

  const candidates = await clustersNeedingUpdate(client, {
    windowHours: editorial.updates.existingArticleWindowHours,
    minNewSources: editorial.updates.minNewSourcesToTriggerUpdate,
    maxRevisions: editorial.updates.maxUpdatesPerArticle,
  });

  if (candidates.length === 0) {
    log.info('Nijedan objavljen članak nema dovoljno novih izveštaja za dopunu.');
    return outcome;
  }

  log.info('Članci koji čekaju dopunu.', {
    kandidata: candidates.length,
    pragIzvora: editorial.updates.minNewSourcesToTriggerUpdate,
  });

  if (options.dryRun) {
    console.log('');
    console.log('Probni režim — dopune koje bi bile napisane:');
    for (const candidate of candidates.slice(0, options.maxUpdates)) {
      console.log(
        `  verzija ${candidate.articleRevision} → ${candidate.articleRevision + 1} · ` +
          `${candidate.newItemCount} novih vesti iz ${candidate.newSourceCount} izvora — ` +
          `${(candidate.titleSample ?? '').slice(0, 55)}`,
      );
    }
    console.log('');
    outcome.skipped = candidates.length;
    return outcome;
  }

  const angleById = new Map(activeSources().map((source) => [source.id, source.angle]));

  // Prvo članci sa najviše novih izveštaja — tamo je dopuna najvrednija.
  const ordered = [...candidates].sort((a, b) => b.newSourceCount - a.newSourceCount);

  for (const candidate of ordered.slice(0, options.maxUpdates)) {
    if (outcome.cost >= options.budgetLeft) {
      outcome.errors.push('preostali budžet potrošen pre kraja dopuna');
      break;
    }

    try {
      const result = await updateOne(client, editorial, candidate, angleById);
      outcome.updated += 1;
      outcome.cost += result.cost;
    } catch (error) {
      const message = error instanceof GenerationError ? error.message : (error as Error).message;
      outcome.errors.push(`${candidate.articleId}: ${message}`);
      log.error('Dopuna nije uspela.', { clanak: candidate.articleId, greska: message });

      if (error instanceof GenerationError && (error.kind === 'credit' || error.kind === 'auth')) {
        break;
      }
    }
  }

  log.info('Dopune završene.', {
    dopunjeno: outcome.updated,
    trosak: formatUsd(outcome.cost),
    gresaka: outcome.errors.length,
  });
  return outcome;
}

async function updateOne(
  client: SupabaseClient,
  editorial: EditorialConfig,
  candidate: UpdateCandidate,
  angleById: Map<string, Angle>,
): Promise<{ cost: number }> {
  const article = await getArticle(client, candidate.articleId);
  const newItems = await newClusterItemsSince(client, candidate.clusterId, candidate.since);

  if (newItems.length === 0) return { cost: 0 };

  const material: TopicMaterial = {
    topicTitle: candidate.titleSample ?? article.title,
    keywords: article.keywords,
    entities: [],
    sources: newItems.map((item) => ({
      angle: angleById.get(item.source_id) ?? 'mejnstrim',
      title: item.title,
      summary: item.summary,
      content: item.content,
      publishedAt: item.published_at,
    })),
    existingArticle: {
      title: article.title,
      lead: article.lead,
      body: article.body,
      revision: article.revision,
    },
  };

  // Dopunu piše model koji je i napisao članak — tekst tako ostaje ujednačen.
  const model = article.model || editorial.models.default;

  const result = await generateArticle(material, {
    model,
    maxOutputTokens: editorial.models.maxOutputTokens,
    effort: 'medium',
    minWords: editorial.gates.minWordsToPublish,
  });

  const changeNote = result.article.notes[0] ?? 'Dopunjeno novim izveštajima.';

  const revision = await applyArticleUpdate(client, candidate.articleId, {
    title: result.article.title,
    lead: result.article.lead,
    body: paragraphsToText(result.article.body),
    wordCount: result.wordCount,
    keywords: result.article.keywords,
    notes: result.article.notes,
    bothSides: result.article.bothSides,
    sourcesDiverge: result.article.sourcesDiverge,
    sensitive: result.article.sensitive,
    sensitivityReason: result.article.sensitivityReason,
    model,
    usage: {
      ulazniTokeni: result.cost.inputTokens,
      izlazniTokeni: result.cost.outputTokens,
      kesUpis: result.cost.cacheCreationTokens,
      kesCitanje: result.cost.cacheReadTokens,
    },
    costUsd: result.cost.totalCost,
    changeNote,
  });

  log.info('Članak dopunjen.', {
    clanak: candidate.articleId,
    verzija: revision,
    novihIzvestaja: newItems.length,
    reci: result.wordCount,
    promena: changeNote.slice(0, 80),
    trosak: formatUsd(result.cost.totalCost),
  });

  return { cost: result.cost.totalCost };
}

/** Koliko dopuna sme u jedan ciklus — dopune troše istu dnevnu granicu. */
export function maxUpdatesPerRun(editorial: EditorialConfig): number {
  return Math.max(1, Math.floor(editorial.limits.maxArticlesPerEditorialRun / 2));
}
