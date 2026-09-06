import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  configDir,
  createLogger,
  loadSourcesConfig,
  mapWithConcurrency,
  reportsDir,
  type Source,
} from '@ai-novine/core';
import { probeSource, type SourceReport } from '../discovery/probe.js';
import { renderMarkdownReport } from '../discovery/report.js';
import { pickFeedsForConfig } from '../discovery/select.js';

const log = createLogger('discover');

export interface DiscoverOptions {
  /** Proveri samo ove izvore (po `id`). */
  only?: string[];
  /** Koliko domena se proverava istovremeno. Unutar jednog domena ostaje 1 zahtev/s. */
  concurrency: number;
  /** Upiši pronađene feed-ove nazad u `config/sources.json`. */
  apply: boolean;
}

export async function runDiscover(options: DiscoverOptions): Promise<void> {
  const config = loadSourcesConfig();
  const selected = options.only?.length
    ? config.sources.filter((source) => options.only?.includes(source.id))
    : config.sources;

  if (selected.length === 0) {
    log.error('Nijedan izvor ne odgovara zadatom filteru.', { only: options.only });
    process.exit(1);
  }

  const startedAt = new Date();
  log.info('Počinje provera izvora.', {
    izvora: selected.length,
    istovremeno: options.concurrency,
    korisnickiAgent: config.defaults.userAgent,
  });

  const reports = await mapWithConcurrency(
    selected,
    options.concurrency,
    async (source: Source) => {
      try {
        return await probeSource(source);
      } catch (error) {
        log.error(`${source.name}: neočekivana greška.`, { greska: (error as Error).message });
        return failedReport(source, error);
      }
    },
  );

  mkdirSync(reportsDir, { recursive: true });

  const markdownPath = join(reportsDir, 'rss-discovery.md');
  writeFileSync(markdownPath, `${renderMarkdownReport(reports, startedAt)}\n`, 'utf8');

  const jsonPath = join(reportsDir, 'rss-discovery.json');
  writeFileSync(
    jsonPath,
    `${JSON.stringify({ generatedAt: startedAt.toISOString(), reports }, null, 2)}\n`,
    'utf8',
  );

  const counts = new Map<string, number>();
  for (const report of reports) counts.set(report.verdict, (counts.get(report.verdict) ?? 0) + 1);

  log.info('Izveštaj napisan.', {
    markdown: markdownPath,
    json: jsonPath,
    ishodi: Object.fromEntries(counts),
    trajanjeSekundi: Math.round((Date.now() - startedAt.getTime()) / 1000),
  });

  if (options.apply) applyFeedsToConfig(reports);
}

/**
 * Upisuje pronađene feed URL-ove u `config/sources.json`. Menja samo polje
 * `feeds`; sve ostalo — uključujući `enabled` i beleške — ostaje kako jeste,
 * jer o izbacivanju izvora odlučuje vlasnik, ne skripta.
 */
function applyFeedsToConfig(reports: SourceReport[]): void {
  const path = join(configDir, 'sources.json');
  const raw = JSON.parse(readFileSync(path, 'utf8')) as {
    sources: { id: string; feeds: string[]; newsSitemaps?: string[] }[];
  };

  let changed = 0;
  for (const entry of raw.sources) {
    const report = reports.find((candidate) => candidate.id === entry.id);
    if (!report) continue;
    let touched = false;

    if (report.verdict === 'rss') {
      const feeds = pickFeedsForConfig(report).map((feed) => feed.finalUrl);
      if (feeds.length > 0 && JSON.stringify(entry.feeds) !== JSON.stringify(feeds)) {
        entry.feeds = feeds;
        touched = true;
      }
    }

    // News sitemap je rezervni put za izvore bez RSS-a — uredan XML sa svezim
    // clancima. Upisuje se i kod izvora koji imaju RSS, kao dodatna mreza.
    const sitemaps = report.sitemaps
      .filter((sitemap) => sitemap.isNewsSitemap && sitemap.entryCount > 0)
      .map((sitemap) => sitemap.url)
      .slice(0, 2);

    if (
      sitemaps.length > 0 &&
      JSON.stringify(entry.newsSitemaps ?? []) !== JSON.stringify(sitemaps)
    ) {
      entry.newsSitemaps = sitemaps;
      touched = true;
    }

    if (touched) changed += 1;
  }

  writeFileSync(path, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
  log.info('config/sources.json ažuriran.', {
    izmenjenoIzvora: changed,
    napomena: 'pokreni `npm run format` da fajl ostane u Prettier stilu',
  });
}

function failedReport(source: Source, error: unknown): SourceReport {
  return {
    id: source.id,
    name: source.name,
    angle: source.angle,
    homepage: source.homepage,
    enabled: source.enabled,
    robots: { state: 'nepoznato', crawlDelaySeconds: null, declaredSitemaps: [] },
    homepageStatus: null,
    feeds: [],
    sitemaps: [],
    topSegments: [],
    attempts: [],
    notes: [`Provera je pukla: ${(error as Error).message}`],
    verdict: 'error',
    elapsedMs: 0,
  };
}
