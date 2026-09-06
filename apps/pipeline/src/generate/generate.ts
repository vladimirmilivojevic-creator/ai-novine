import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { createLogger } from '@ai-novine/core';
import { countWords } from '../ingest/normalize.js';
import { calculateCost, usageFromResponse, type CostBreakdown } from './cost.js';
import { buildUserMessage, loadSystemPrompt, type TopicMaterial } from './prompt.js';
import { repairAndValidate } from './repair.js';
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
  /** Šta je moralo da se popravi u odgovoru modela. */
  repairs: string[];
  /** true kada je prvi odgovor bio neispravan pa je zatražena ispravka. */
  retried: boolean;
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

  const system = [
    {
      type: 'text' as const,
      text: loadSystemPrompt(),
      // Urednicka pravila se ne menjaju izmedju poziva, pa se keširaju.
      cache_control: { type: 'ephemeral' as const },
    },
  ];
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: buildUserMessage(material) },
  ];

  const call = async (): Promise<Anthropic.Message> => {
    try {
      return await anthropic().messages.create({
        model: options.model,
        max_tokens: options.maxOutputTokens,
        system,
        messages,
        output_config: { format: zodOutputFormat(articleSchema), ...effort },
      });
    } catch (error) {
      throw toGenerationError(error);
    }
  };

  let response = await call();
  let parsed = repairAndValidate(readJson(response));
  let retried = false;

  // Strukturisani izlaz nije tvrda garancija na svim modelima. Umesto da se
  // ceo clanak baci zbog jedne pogresne reci, trazi se ispravka — jednom.
  if (!parsed.article) {
    log.warn(`${options.model}: odgovor ne odgovara semi, trazim ispravku.`, {
      problemi: parsed.problems.slice(0, 3),
    });

    messages.push({ role: 'assistant', content: textOf(response) });
    messages.push({
      role: 'user',
      content: [
        'Odgovor ne odgovara zadatoj šemi. Problemi:',
        ...parsed.problems.map((problem) => `- ${problem}`),
        '',
        'Pošalji ispravljen JSON, isti sadržaj članka, bez ikakvog teksta van JSON-a.',
      ].join('\n'),
    });

    const retryResponse = await call();
    const retryParsed = repairAndValidate(readJson(retryResponse));
    retried = true;

    // Potrošnja oba poziva se sabira — oba su naplaćena.
    response = mergeUsage(response, retryResponse);
    parsed = { ...retryParsed, repairs: [...parsed.repairs, ...retryParsed.repairs] };
  }

  if (!parsed.article) {
    throw new GenerationError(
      `Model ni posle ispravke nije vratio ispravan članak: ${parsed.problems.slice(0, 3).join('; ')}`,
      'schema',
    );
  }

  const article = parsed.article;
  const usage = usageFromResponse(response.usage);
  const cost = calculateCost(options.model, usage);
  const wordCount = countWords(`${article.lead} ${article.body}`);

  log.info(`Napisan članak (${options.model}).`, {
    reci: wordCount,
    ...(parsed.repairs.length > 0 ? { popravke: parsed.repairs } : {}),
    ...(retried ? { trazenaIspravka: true } : {}),
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
    repairs: parsed.repairs,
    retried,
  };
}

/** Tekst odgovora — model vraća JSON kao običan tekstualni blok. */
function textOf(response: Anthropic.Message): string {
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

function readJson(response: Anthropic.Message): unknown {
  try {
    return JSON.parse(textOf(response));
  } catch {
    return null;
  }
}

/** Sabira potrošnju dva poziva, jer se oba naplaćuju. */
function mergeUsage(first: Anthropic.Message, second: Anthropic.Message): Anthropic.Message {
  return {
    ...second,
    usage: {
      ...second.usage,
      input_tokens: (first.usage.input_tokens ?? 0) + (second.usage.input_tokens ?? 0),
      output_tokens: (first.usage.output_tokens ?? 0) + (second.usage.output_tokens ?? 0),
      cache_creation_input_tokens:
        (first.usage.cache_creation_input_tokens ?? 0) +
        (second.usage.cache_creation_input_tokens ?? 0),
      cache_read_input_tokens:
        (first.usage.cache_read_input_tokens ?? 0) + (second.usage.cache_read_input_tokens ?? 0),
    },
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
