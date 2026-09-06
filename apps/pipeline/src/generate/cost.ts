/**
 * Trošak jednog poziva modela.
 *
 * Ovo je jedini gotovinski trošak celog sistema, pa se meri po članku i upisuje
 * u bazu — mesečni račun se onda ne procenjuje nego čita.
 */

export interface ModelPricing {
  /** Dolara po milionu ulaznih tokena. */
  inputPerMillion: number;
  /** Dolara po milionu izlaznih tokena. */
  outputPerMillion: number;
}

/** Cene sa zvaničnog cenovnika, u dolarima po milionu tokena. */
export const PRICING: Record<string, ModelPricing> = {
  'claude-haiku-4-5': { inputPerMillion: 1, outputPerMillion: 5 },
  'claude-sonnet-5': { inputPerMillion: 2, outputPerMillion: 10 },
  'claude-opus-5': { inputPerMillion: 5, outputPerMillion: 25 },
};

/** Upis u keš košta 25% više od običnog ulaza. */
export const CACHE_WRITE_MULTIPLIER = 1.25;
/** Čitanje iz keša košta desetinu običnog ulaza — zato prompt i jeste keširan. */
export const CACHE_READ_MULTIPLIER = 0.1;

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

export interface CostBreakdown extends TokenUsage {
  model: string;
  inputCost: number;
  outputCost: number;
  cacheWriteCost: number;
  cacheReadCost: number;
  totalCost: number;
}

export function usageFromResponse(usage: {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}): TokenUsage {
  return {
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
  };
}

export function calculateCost(model: string, usage: TokenUsage): CostBreakdown {
  const pricing = PRICING[model] ?? PRICING['claude-haiku-4-5'];
  const perInputToken = (pricing?.inputPerMillion ?? 1) / 1_000_000;
  const perOutputToken = (pricing?.outputPerMillion ?? 5) / 1_000_000;

  const inputCost = usage.inputTokens * perInputToken;
  const outputCost = usage.outputTokens * perOutputToken;
  const cacheWriteCost = usage.cacheCreationTokens * perInputToken * CACHE_WRITE_MULTIPLIER;
  const cacheReadCost = usage.cacheReadTokens * perInputToken * CACHE_READ_MULTIPLIER;

  return {
    model,
    ...usage,
    inputCost,
    outputCost,
    cacheWriteCost,
    cacheReadCost,
    totalCost: inputCost + outputCost + cacheWriteCost + cacheReadCost,
  };
}

/** Dolarski iznos u oblik za prikaz: šest decimala jer su iznosi mali. */
export function formatUsd(amount: number): string {
  return `$${amount.toFixed(6)}`;
}

/** Procena mesečnog računa na osnovu prosečne cene članka. */
export function monthlyEstimate(costPerArticle: number, articlesPerDay: number): number {
  return costPerArticle * articlesPerDay * 30;
}
