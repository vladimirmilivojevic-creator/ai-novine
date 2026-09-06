import {
  activeSources,
  createLogger,
  loadDotEnv,
  loadSourcesConfig,
  mapWithConcurrency,
  type Source,
} from '@ai-novine/core';
import {
  createServiceClient,
  finishRun,
  getSourceStates,
  recordSourceFailure,
  recordSourceSuccess,
  startRun,
  syncSources,
} from '@ai-novine/db';
import { ingestSource, type SourceIngestResult } from '../ingest/source-run.js';

const log = createLogger('ingest');

export interface IngestCommandOptions {
  only?: string[];
  concurrency: number;
  limit: number;
  fullText: boolean;
}

export async function runIngest(options: IngestCommandOptions): Promise<void> {
  loadDotEnv();

  const config = loadSourcesConfig();
  const client = createServiceClient();

  await syncSources(client, config.sources);

  const selected = pickSources(options.only);
  if (selected.length === 0) {
    log.error('Nijedan izvor ne odgovara filteru ili nijedan nema kanal podataka.', {
      only: options.only,
    });
    process.exit(1);
  }

  const states = await getSourceStates(
    client,
    selected.map((source) => source.id),
  );

  const now = Date.now();
  const runnable: Source[] = [];
  for (const source of selected) {
    const disabledUntil = states.get(source.id)?.disabled_until;
    if (disabledUntil && new Date(disabledUntil).getTime() > now) {
      log.warn(`${source.name}: preskacem, prekidac je aktivan.`, { do: disabledUntil });
      continue;
    }
    runnable.push(source);
  }

  const runId = await startRun(client, 'ingest');
  const startedAt = Date.now();
  const results: SourceIngestResult[] = [];
  const errors: string[] = [];

  try {
    const collected = await mapWithConcurrency(
      runnable,
      options.concurrency,
      async (source: Source) => {
        try {
          const result = await ingestSource(client, source, {
            maxItemsPerSource: options.limit,
            fullText: options.fullText,
          });

          // Prekidac se resetuje samo ako je bar jedan kanal stvarno procitan.
          const nothingRead =
            result.checked > 0 && result.candidates === 0 && result.unchanged === 0;
          if (nothingRead) {
            const message = result.errors[0] ?? 'nijedan kanal nije procitan';
            const breaker = await recordSourceFailure(client, source.id, message, {
              maxConsecutiveFailures: config.defaults.maxConsecutiveFailures,
              disableForHours: config.defaults.disableAfterFailuresHours,
            });
            log.warn(`${source.name}: neuspeh ${breaker.failures}.`, {
              ugasenDo: breaker.disabledUntil ?? 'nije ugasen',
            });
          } else {
            await recordSourceSuccess(client, source.id);
          }

          for (const error of result.errors) errors.push(`${source.id}: ${error}`);
          return result;
        } catch (error) {
          const message = (error as Error).message;
          errors.push(`${source.id}: ${message}`);
          log.error(`${source.name}: ciklus pukao.`, { greska: message });

          await recordSourceFailure(client, source.id, message, {
            maxConsecutiveFailures: config.defaults.maxConsecutiveFailures,
            disableForHours: config.defaults.disableAfterFailuresHours,
          }).catch(() => undefined);

          return null;
        }
      },
    );

    for (const result of collected) if (result) results.push(result);

    const stats = summarize(results, Date.now() - startedAt);
    await finishRun(client, runId, true, stats, errors);
    log.info('Ciklus zavrsen.', stats);
  } catch (error) {
    await finishRun(client, runId, false, {}, [...errors, (error as Error).message]);
    throw error;
  }
}

function pickSources(only?: string[]): Source[] {
  const sources = activeSources().filter(
    (source) => source.feeds.length > 0 || source.newsSitemaps.length > 0 || source.scrape !== null,
  );
  if (!only?.length) return sources;
  return sources.filter((source) => only.includes(source.id));
}

function summarize(results: SourceIngestResult[], elapsedMs: number): Record<string, number> {
  const total = (pick: (result: SourceIngestResult) => number): number =>
    results.reduce((sum, result) => sum + pick(result), 0);

  return {
    izvora: results.length,
    prekoSitemapa: results.filter((result) => result.channel === 'sitemap').length,
    bezKandidata: results.filter((result) => result.channel === 'nista').length,
    provereno: total((result) => result.checked),
    nepromenjenih: total((result) => result.unchanged),
    kandidata: total((result) => result.candidates),
    novihUrl: total((result) => result.newUrls),
    izvucenTekst: total((result) => result.extracted),
    upisano: total((result) => result.inserted),
    duplikata: total((result) => result.duplicates),
    gresaka: total((result) => result.errors.length),
    trajanjeSekundi: Math.round(elapsedMs / 1000),
  };
}
