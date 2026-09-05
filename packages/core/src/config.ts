import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { configDir } from './paths.js';

const urlString = z
  .string()
  .refine((value) => URL.canParse(value), { message: 'Nije validan URL' });

export const ANGLES = ['provladin', 'kriticki', 'mejnstrim', 'agencija'] as const;
export const angleSchema = z.enum(ANGLES);
export type Angle = z.infer<typeof angleSchema>;

/** Fallback za izvore bez RSS-a — popunjava se u Fazi 3. */
export const scrapeConfigSchema = z.object({
  listingUrls: z.array(urlString).min(1),
  itemLinkSelector: z.string().min(1),
  linkPattern: z.string().optional(),
  maxLinksPerRun: z.number().int().positive().default(30),
});
export type ScrapeConfig = z.infer<typeof scrapeConfigSchema>;

export const sourceSchema = z.object({
  id: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, 'id sme da sadrzi samo mala slova, cifre i crticu'),
  name: z.string().min(1),
  homepage: urlString,
  angle: angleSchema,
  enabled: z.boolean(),
  feeds: z.array(urlString),
  scrape: scrapeConfigSchema.nullable().default(null),
  notes: z.string().default(''),
});
export type Source = z.infer<typeof sourceSchema>;

export const sourcesConfigSchema = z.object({
  version: z.literal(1),
  defaults: z.object({
    userAgent: z.string().min(1),
    requestsPerSecondPerDomain: z.number().positive(),
    requestTimeoutMs: z.number().int().positive(),
    respectRobotsTxt: z.boolean(),
    maxConsecutiveFailures: z.number().int().positive(),
    disableAfterFailuresHours: z.number().positive(),
    maxItemsPerFetch: z.number().int().positive(),
  }),
  angles: z.record(angleSchema, z.string()),
  sources: z.array(sourceSchema).min(1),
});
export type SourcesConfig = z.infer<typeof sourcesConfigSchema>;

export const CATEGORIES = ['politika', 'ekonomija', 'drustvo', 'sport', 'region', 'svet'] as const;
export const categorySchema = z.enum(CATEGORIES);
export type Category = z.infer<typeof categorySchema>;

export const editorialConfigSchema = z.object({
  version: z.literal(1),
  cadence: z.object({
    ingestEveryMinutes: z.number().int().positive(),
    editorialEveryMinutes: z.number().int().positive(),
    sweepCron: z.string().min(1),
  }),
  clustering: z.object({
    similarityThreshold: z.number().gt(0).lt(1),
    windowHours: z.number().positive(),
    minTitleChars: z.number().int().positive(),
  }),
  gates: z.object({
    minDistinctSources: z.number().int().positive(),
    minDistinctAngles: z.number().int().positive(),
    minTotalItems: z.number().int().positive(),
    minWordsToPublish: z.number().int().positive(),
    maxWordsToPublish: z.number().int().positive(),
  }),
  updates: z.object({
    existingArticleWindowHours: z.number().positive(),
    minNewSourcesToTriggerUpdate: z.number().int().positive(),
    maxUpdatesPerArticle: z.number().int().positive(),
  }),
  limits: z.object({
    maxArticlesPerDay: z.number().int().positive(),
    maxFlagshipArticlesPerDay: z.number().int().nonnegative(),
    maxArticlesPerEditorialRun: z.number().int().positive(),
  }),
  models: z.object({
    default: z.string().min(1),
    flagship: z.string().min(1),
    maxOutputTokens: z.number().int().positive(),
  }),
  categories: z.record(
    categorySchema,
    z.object({
      label: z.string().min(1),
      dailyQuota: z.number().int().positive(),
      minDistinctSources: z.number().int().positive(),
    }),
  ),
  sensitivity: z.object({
    topics: z.array(z.string().min(1)).min(1),
    approvalTimeoutHours: z.number().positive(),
    onTimeout: z.enum(['draft', 'discard']),
  }),
  retention: z.object({
    rawItemsDays: z.number().int().positive(),
    pipelineRunsDays: z.number().int().positive(),
    rejectedClustersDays: z.number().int().positive(),
  }),
});
export type EditorialConfig = z.infer<typeof editorialConfigSchema>;

function loadJson<T>(fileName: string, schema: z.ZodType<T>): T {
  const path = join(configDir, fileName);

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Ne mogu da procitam ${path}: ${(error as Error).message}`, { cause: error });
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(koren)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Konfiguracija ${fileName} nije ispravna:\n${details}`);
  }
  return result.data;
}

let sourcesCache: SourcesConfig | undefined;
let editorialCache: EditorialConfig | undefined;

export function loadSourcesConfig(): SourcesConfig {
  sourcesCache ??= loadJson('sources.json', sourcesConfigSchema);
  return sourcesCache;
}

export function loadEditorialConfig(): EditorialConfig {
  editorialCache ??= loadJson('editorial.json', editorialConfigSchema);
  return editorialCache;
}

/** Samo ukljuceni izvori — ono sto pipeline stvarno dohvata. */
export function activeSources(): Source[] {
  return loadSourcesConfig().sources.filter((source) => source.enabled);
}
