import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { createLogger } from '@ai-novine/core';
import { calculateCost, usageFromResponse, type CostBreakdown } from './cost.js';
import { buildUserMessage, loadSystemPrompt, type TopicMaterial } from './prompt.js';
import { repairAndValidate } from './repair.js';
import { articleSchema, type GeneratedArticle } from './schema.js';

const log = createLogger('batch');

/**
 * Asinhrono pisanje članaka kroz Batch API.
 *
 * Batch API naplaćuje **pola cene** za sve tokene, a keširanje uredničkog
 * prompta i dalje važi. Cena po članku time pada na polovinu.
 *
 * Zauzvrat, odgovori ne stižu odmah: većina paketa bude gotova za manje od sat
 * vremena, a rok je 24 sata. Zato pipeline radi u dva koraka — jedan ciklus
 * pošalje paket i završi, sledeći pokupi rezultate. Cron na sat vremena tako
 * nikad ne stoji i čeka, a sajt dobija članke sa zakašnjenjem od jednog ciklusa.
 *
 * Šta se NE prenosi u batch: razgovor sa modelom. U neposrednom pozivu se od
 * modela može tražiti ispravka odmah; ovde odgovor koji ne prođe proveru ide u
 * sledeći paket, i to jačem modelu.
 */

let client: Anthropic | undefined;

function anthropic(): Anthropic {
  client ??= new Anthropic({ maxRetries: 2, timeout: 120_000 });
  return client;
}

export interface BatchItem {
  /** Naš identifikator zahteva; vraća se uz odgovor. */
  customId: string;
  material: TopicMaterial;
}

export interface BatchSubmitOptions {
  model: string;
  maxOutputTokens: number;
  effort?: 'low' | 'medium' | 'high';
}

/** Modeli koji podržavaju `effort`; na Haiku 4.5 taj parametar vraća grešku. */
const SUPPORTS_EFFORT = new Set(['claude-sonnet-5', 'claude-opus-5']);

export interface SubmittedBatch {
  batchId: string;
  requestCount: number;
}

export async function submitBatch(
  items: BatchItem[],
  options: BatchSubmitOptions,
): Promise<SubmittedBatch> {
  const effort =
    options.effort && SUPPORTS_EFFORT.has(options.model) ? { effort: options.effort } : {};

  const batch = await anthropic().messages.batches.create({
    requests: items.map((item) => ({
      custom_id: item.customId,
      params: {
        model: options.model,
        max_tokens: options.maxOutputTokens,
        system: [
          {
            type: 'text' as const,
            text: loadSystemPrompt(),
            cache_control: { type: 'ephemeral' as const },
          },
        ],
        messages: [{ role: 'user' as const, content: buildUserMessage(item.material) }],
        output_config: { format: zodOutputFormat(articleSchema), ...effort },
      },
    })),
  });

  log.info('Paket poslat.', {
    paket: batch.id,
    zahteva: items.length,
    model: options.model,
    stanje: batch.processing_status,
  });

  return { batchId: batch.id, requestCount: items.length };
}

export type BatchState = 'in_progress' | 'canceling' | 'ended';

export async function batchState(batchId: string): Promise<{
  state: BatchState;
  succeeded: number;
  errored: number;
  processing: number;
}> {
  const batch = await anthropic().messages.batches.retrieve(batchId);
  return {
    state: batch.processing_status as BatchState,
    succeeded: batch.request_counts.succeeded,
    errored: batch.request_counts.errored,
    processing: batch.request_counts.processing,
  };
}

export interface BatchArticle {
  customId: string;
  article: GeneratedArticle;
  cost: CostBreakdown;
  repairs: string[];
}

export interface BatchFailure {
  customId: string;
  reason: string;
  /** `true` kada isti zahtev ima smisla poslati ponovo (npr. jačem modelu). */
  retryable: boolean;
}

export interface BatchResults {
  articles: BatchArticle[];
  failures: BatchFailure[];
}

/** Čita rezultate završenog paketa i proverava svaki odgovor. */
export async function collectBatch(batchId: string, model: string): Promise<BatchResults> {
  const results: BatchResults = { articles: [], failures: [] };

  for await (const entry of await anthropic().messages.batches.results(batchId)) {
    const customId = entry.custom_id;

    if (entry.result.type === 'errored') {
      const error = entry.result.error;
      const type = 'type' in error ? String(error.type) : 'nepoznato';
      results.failures.push({
        customId,
        reason: `greška u obradi (${type})`,
        // Greška u zahtevu se neće popraviti sama; greška servera hoće.
        retryable: type !== 'invalid_request',
      });
      continue;
    }

    if (entry.result.type === 'expired') {
      results.failures.push({ customId, reason: 'zahtev je istekao', retryable: true });
      continue;
    }

    if (entry.result.type !== 'succeeded') {
      results.failures.push({ customId, reason: `neočekivan ishod`, retryable: true });
      continue;
    }

    const message = entry.result.message;
    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    const parsed = repairAndValidate(readJson(text));
    // Batch cena je pola redovne, na svim vrstama tokena.
    const cost = halveCost(calculateCost(model, usageFromResponse(message.usage)));

    if (!parsed.article) {
      results.failures.push({
        customId,
        reason: `odgovor ne odgovara šemi: ${parsed.problems.slice(0, 2).join('; ')}`,
        retryable: true,
      });
      continue;
    }

    results.articles.push({ customId, article: parsed.article, cost, repairs: parsed.repairs });
  }

  return results;
}

/** Batch API naplaćuje pola cene za sve tokene, uključujući keš. */
export function halveCost(cost: CostBreakdown): CostBreakdown {
  return {
    ...cost,
    inputCost: cost.inputCost / 2,
    outputCost: cost.outputCost / 2,
    cacheWriteCost: cost.cacheWriteCost / 2,
    cacheReadCost: cost.cacheReadCost / 2,
    totalCost: cost.totalCost / 2,
  };
}

/** JSON iz odgovora; `null` kada odgovor nije ispravan JSON. */
function readJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
