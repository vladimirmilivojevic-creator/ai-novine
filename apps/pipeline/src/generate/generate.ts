import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { createLogger } from '@ai-novine/core';
import { countWords } from '../ingest/normalize.js';
import { calculateCost, usageFromResponse, type CostBreakdown } from './cost.js';
import { buildUserMessage, loadSystemPrompt, type TopicMaterial } from './prompt.js';
import { articleSchema, type GeneratedArticle } from './schema.js';

const log = createLogger('generate');

/** Modeli koji podržavaju `effort`; na Haiku 4.5 taj parametar vraća grešku. */
const SUPPORTS_EFFORT = new Set(['claude-sonnet-5', 'claude-opus-5']);

export interface GenerateOptions {
  model: string;
  maxOutputTokens: number;
  /** Dubina razmišljanja na modelima koji je podržavaju. */
  effort?: 'low' | 'medium' | 'high';
}

export interface GenerationResult {
  article: GeneratedArticle;
  cost: CostBreakdown;
  wordCount: number;
  elapsedMs: number;
  /** true kada je urednički prompt stigao iz keša, a ne naplaćen po punoj ceni. */
  promptCacheHit: boolean;
}

export class GenerationError extends Error {
  constructor(
    message: string,
    readonly kind: 'auth' | 'credit' | 'rate_limit' | 'schema' | 'api',
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'GenerationError';
  }
}

let client: Anthropic | undefined;

function anthropic(): Anthropic {
  client ??= new Anthropic({ maxRetries: 2, timeout: 120_000 });
  return client;
}

/**
 * Piše jedan članak o jednoj temi.
 *
 * Urednička pravila idu kao **keširani** sistem-prompt: nepromenljiva su, pa se
 * posle prvog poziva naplaćuju desetinom cene. Materijal teme ide posle njih, jer
 * keš važi samo za nepromenjeni početak zahteva.
 */
export async function generateArticle(
  material: TopicMaterial,
  options: GenerateOptions,
): Promise<GenerationResult> {
  const startedAt = Date.now();

  // `effort` postoji samo na novijim modelima; na Haiku 4.5 vraca gresku.
  const effort =
    options.effort && SUPPORTS_EFFORT.has(options.model) ? { effort: options.effort } : {};

  let response;
  try {
    response = await anthropic().messages.parse({
      model: options.model,
      max_tokens: options.maxOutputTokens,
      system: [
        {
          type: 'text',
          text: loadSystemPrompt(),
          // Urednicka pravila se ne menjaju izmedju poziva, pa se keširaju.
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: buildUserMessage(material) }],
      output_config: {
        format: zodOutputFormat(articleSchema),
        ...effort,
      },
    });
  } catch (error) {
    throw toGenerationError(error);
  }

  const article = response.parsed_output;
  if (!article) {
    throw new GenerationError(
      'Model je odgovorio, ali odgovor ne odgovara zadatoj šemi članka.',
      'schema',
    );
  }

  const usage = usageFromResponse(response.usage);
  const cost = calculateCost(options.model, usage);
  const wordCount = countWords(`${article.lead} ${article.body}`);

  log.info(`Napisan članak (${options.model}).`, {
    reci: wordCount,
    kategorija: article.category,
    osetljivo: article.sensitive,
    obeStrane: article.bothSides !== null,
    kesUlaz: usage.cacheReadTokens,
    trosakUsd: Number(cost.totalCost.toFixed(6)),
  });

  return {
    article,
    cost,
    wordCount,
    elapsedMs: Date.now() - startedAt,
    promptCacheHit: usage.cacheReadTokens > 0,
  };
}

/**
 * Greške se razvrstavaju jer traže različit odgovor: nedostatak kredita je stvar
 * naloga i pipeline treba da stane, dok je ograničenje brzine prolazno.
 */
function toGenerationError(error: unknown): GenerationError {
  if (error instanceof Anthropic.AuthenticationError) {
    return new GenerationError('Anthropic ključ je odbijen (401).', 'auth', { cause: error });
  }

  if (error instanceof Anthropic.RateLimitError) {
    return new GenerationError(
      'Dostignuto ograničenje brzine poziva; ciklus se preskače i nastavlja sledeći put.',
      'rate_limit',
      { cause: error },
    );
  }

  if (error instanceof Anthropic.APIError) {
    const message = String(error.message);
    if (/credit balance/i.test(message)) {
      return new GenerationError(
        'Anthropic nalog nema kredita. Dodaj sredstva na console.anthropic.com → Plans & Billing; ' +
          'ključ je ispravan, ali bez kredita nijedan poziv modelu ne prolazi.',
        'credit',
        { cause: error },
      );
    }
    return new GenerationError(`Anthropic API greška ${error.status ?? ''}: ${message}`, 'api', {
      cause: error,
    });
  }

  return new GenerationError(`Neočekivana greška: ${(error as Error).message}`, 'api', {
    cause: error,
  });
}
