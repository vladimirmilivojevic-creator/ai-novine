import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  activeSources,
  createLogger,
  loadDotEnv,
  loadEditorialConfig,
  reportsDir,
  type Angle,
} from '@ai-novine/core';
import {
  clusterSourceItems,
  clustersWithoutArticle,
  createServiceClient,
  type ClusterCandidateRow,
} from '@ai-novine/db';
import { formatUsd, monthlyEstimate } from '../generate/cost.js';
import { generateArticle, GenerationError, type GenerationResult } from '../generate/generate.js';
import { buildUserMessage, MAX_SOURCES_IN_PROMPT, type TopicMaterial } from '../generate/prompt.js';
import { paragraphsToText } from '../generate/schema.js';

const log = createLogger('compare');

export interface CompareOptions {
  /** Koliko tema ide kroz oba modela. */
  topics: number;
  /** Id teme, kada se poredi tačno određena. */
  clusterId?: string;
}

/**
 * Kapija Faze 5: ista tema kroz oba modela, tekstovi jedan pored drugog.
 *
 * Odluku ne donosi kod nego vlasnik — on čita srpski i procenjuje da li tekst
 * zvuči kao novinarski članak ili kao mašinski rerajt. Ovde se samo pripremaju
 * uporedivi tekstovi i tačan trošak jednog i drugog.
 */
export async function runCompare(options: CompareOptions): Promise<void> {
  loadDotEnv();

  const editorial = loadEditorialConfig();
  const client = createServiceClient();
  const angleById = new Map(activeSources().map((source) => [source.id, source.angle]));

  const candidates = await pickCandidates(client, options);
  if (candidates.length === 0) {
    log.error('Nema nijedne teme koja prolazi kapije kvaliteta. Pokreni prvo `cluster`.');
    process.exit(1);
  }

  const models = [editorial.models.default, editorial.models.flagship];
  log.info('Počinje poređenje.', { tema: candidates.length, modeli: models });

  const sections: string[] = [];
  const costs = new Map<string, number[]>();

  for (const [index, candidate] of candidates.entries()) {
    const items = await clusterSourceItems(client, candidate.id);
    const material: TopicMaterial = {
      topicTitle: candidate.title_sample ?? 'Tema bez naslova',
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

    const results = new Map<string, GenerationResult | GenerationError>();

    for (const model of models) {
      try {
        const result = await generateArticle(material, {
          model,
          maxOutputTokens: editorial.models.maxOutputTokens,
          effort: 'medium',
        });
        results.set(model, result);
        costs.set(model, [...(costs.get(model) ?? []), result.cost.totalCost]);

        // Haiku kesira tek prefiks od 4096 tokena. Ako ni drugi poziv istim
        // modelom ne cita iz kesa, urednicki prompt je prekratak i procena
        // mesecnog troska ne stoji.
        if (!result.promptCacheHit && (costs.get(model)?.length ?? 0) > 1) {
          log.warn(`${model}: urednicki prompt se ne kesira — proveri duzinu prompta.`, {
            kesUpis: result.cost.cacheCreationTokens,
            kesCitanje: result.cost.cacheReadTokens,
          });
        }
      } catch (error) {
        if (!(error instanceof GenerationError)) throw error;
        log.error(`${model}: ${error.message}`);
        results.set(model, error);

        // Bez kredita nema smisla pokušavati dalje.
        if (error.kind === 'credit') {
          writeReport(sections, costs, models);
          process.exit(1);
        }
      }
    }

    sections.push(renderTopic(index + 1, candidate, material, models, results));
  }

  writeReport(sections, costs, models);
}

async function pickCandidates(
  client: ReturnType<typeof createServiceClient>,
  options: CompareOptions,
): Promise<ClusterCandidateRow[]> {
  const editorial = loadEditorialConfig();
  const all = await clustersWithoutArticle(client, 60);

  if (options.clusterId) return all.filter((row) => row.id === options.clusterId);

  return all
    .filter(
      (row) =>
        row.distinct_sources >= editorial.gates.minDistinctSources &&
        row.angles.length >= editorial.gates.minDistinctAngles &&
        row.size >= editorial.gates.minTotalItems,
    )
    .slice(0, options.topics);
}

function renderTopic(
  position: number,
  candidate: ClusterCandidateRow,
  material: TopicMaterial,
  models: string[],
  results: Map<string, GenerationResult | GenerationError>,
): string {
  const lines: string[] = [];

  lines.push(`## Tema ${position}: ${candidate.title_sample ?? '(bez naslova)'}`);
  lines.push('');
  lines.push(
    `**Skor:** ${candidate.trending_score} · **tekstova:** ${candidate.size} · ` +
      `**izvora:** ${candidate.distinct_sources} · **uglova:** ${candidate.angles.length} ` +
      `(${candidate.angles.join(', ')})`,
  );
  lines.push('');
  lines.push('<details><summary>Materijal koji je model dobio</summary>');
  lines.push('');
  lines.push('```');
  lines.push(buildUserMessage(material).slice(0, 4000));
  lines.push('```');
  lines.push('');
  lines.push('</details>');
  lines.push('');

  for (const model of models) {
    const result = results.get(model);
    lines.push(`### ${model}`);
    lines.push('');

    if (!result || result instanceof GenerationError) {
      lines.push(`❌ Nije napisano: ${result?.message ?? 'nepoznata greška'}`);
      lines.push('');
      continue;
    }

    const { article, cost, wordCount, elapsedMs } = result;
    lines.push(
      `*${wordCount} reči · ${(elapsedMs / 1000).toFixed(1)} s · ${formatUsd(cost.totalCost)} · ` +
        `ulaz ${cost.inputTokens} (keš: ${cost.cacheReadTokens}) · izlaz ${cost.outputTokens} tokena*`,
    );
    lines.push('');
    lines.push(`**${article.title}**`);
    lines.push('');
    lines.push(`*${article.lead}*`);
    lines.push('');
    lines.push(paragraphsToText(article.body));
    lines.push('');

    if (article.bothSides) {
      lines.push('**Prikaz „obe strane"**');
      lines.push('');
      lines.push(`> **${article.bothSides.officialLabel}** — ${article.bothSides.officialText}`);
      lines.push('>');
      lines.push(`> **${article.bothSides.criticalLabel}** — ${article.bothSides.criticalText}`);
      lines.push('');
    }

    lines.push(
      `Kategorija: \`${article.category}\` · osetljivo: ${article.sensitive ? `da (${article.sensitivityReason ?? 'bez obrazloženja'})` : 'ne'} · ` +
        `izvori se razilaze: ${article.sourcesDiverge ? 'da' : 'ne'}`,
    );
    if (article.keywords.length > 0) lines.push(`Ključne reči: ${article.keywords.join(', ')}`);
    if (article.notes.length > 0) lines.push(`Napomene modela: ${article.notes.join(' · ')}`);
    lines.push('');
  }

  return lines.join('\n');
}

function writeReport(sections: string[], costs: Map<string, number[]>, models: string[]): void {
  const lines: string[] = [];

  lines.push('# Poređenje modela — koji piše bolji srpski');
  lines.push('');
  lines.push(`**Vreme:** ${new Date().toLocaleString('sr-RS', { timeZone: 'Europe/Belgrade' })}`);
  lines.push('');
  lines.push(
    'Ista tema, isti materijal, isti urednički prompt — dva modela. Odluku donosi vlasnik: ' +
      'da li tekst zvuči kao novinarski članak ili kao mašinski rerajt.',
  );
  lines.push('');

  lines.push('## Trošak');
  lines.push('');
  lines.push('| Model | Članaka | Prosek po članku | Procena za 25 članaka dnevno |');
  lines.push('| --- | ---: | ---: | ---: |');
  for (const model of models) {
    const values = costs.get(model) ?? [];
    if (values.length === 0) {
      lines.push(`| \`${model}\` | 0 | — | — |`);
      continue;
    }
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    lines.push(
      `| \`${model}\` | ${values.length} | ${formatUsd(average)} | ` +
        `$${monthlyEstimate(average, 25).toFixed(2)} mesečno |`,
    );
  }
  lines.push('');
  lines.push(
    `Napomena: prvi poziv plaća upis uredničkog prompta u keš; svaki sledeći ga čita za desetinu ` +
      `cene. Procena mesečnog troška je zato realnija posle više članaka. U promptu ide najviše ` +
      `${MAX_SOURCES_IN_PROMPT} izveštaja po temi.`,
  );
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(...sections);

  mkdirSync(reportsDir, { recursive: true });
  const path = join(reportsDir, 'poredjenje-modela.md');
  writeFileSync(path, `${lines.join('\n')}\n`, 'utf8');
  log.info('Izveštaj napisan.', { fajl: path });
}
