import type { SupabaseClient } from '@supabase/supabase-js';
import type { ArticleRow } from './schema.js';
import { type ClusterSourceItem } from './repository.js';

/**
 * Ažuriranje postojećeg članka umesto pisanja novog (Faza 6).
 *
 * Brief, sekcija 5: ako je tema već pokrivena pre nekoliko sati, članak se
 * **dopunjuje**, a ne piše iznova. To je istovremeno najvažnija SEO zaštita iz
 * sekcije 9 — četiri skoro identična članka o istoj priči su tačno ono što
 * Google „Scaled Content Abuse" politika kažnjava — i odbrana kvaliteta:
 * čitalac dobija jednu priču koja raste, a ne četiri koje se ponavljaju.
 *
 * Slug i URL ostaju isti kroz sve dopune. To je i smisao: link koji je negde
 * podeljen i dalje vodi na najnoviju verziju.
 */

function fail(context: string, error: { message: string; code?: string }): never {
  throw new Error(`${context}: ${error.message}${error.code ? ` (${error.code})` : ''}`);
}

export interface UpdateCandidate {
  clusterId: string;
  articleId: string;
  titleSample: string | null;
  /** Vesti koje su ušle u temu posle poslednje verzije članka. */
  newItemCount: number;
  /** Koliko RAZLIČITIH izvora donosi te nove vesti. */
  newSourceCount: number;
  articleRevision: number;
  /** Trenutak od kog se broje nove vesti. */
  since: string;
}

/**
 * Teme koje već imaju članak, a od tada su dobile nove izveštaje.
 *
 * Prag „koliko novih izvora" postoji da se članak ne dopunjuje zbog jednog
 * portala koji je prepakovao istu vest — dopuna košta koliko i pisanje.
 */
export async function clustersNeedingUpdate(
  client: SupabaseClient,
  options: { windowHours: number; minNewSources: number; maxRevisions: number },
): Promise<UpdateCandidate[]> {
  const cutoff = new Date(Date.now() - options.windowHours * 3600_000).toISOString();

  const { data, error } = await client
    .from('clusters')
    .select('id, article_id, title_sample')
    .eq('status', 'covered')
    .not('article_id', 'is', null)
    .gte('last_item_at', cutoff);
  if (error) fail('Citanje pokrivenih tema nije proslo', error);

  const clusters = data as { id: string; article_id: string; title_sample: string | null }[];
  const candidates: UpdateCandidate[] = [];

  for (const cluster of clusters) {
    const { data: articleData, error: articleError } = await client
      .from('articles')
      .select('id, revision, last_update_at, created_at')
      .eq('id', cluster.article_id)
      .single();
    if (articleError) continue;

    const article = articleData as {
      id: string;
      revision: number;
      last_update_at: string | null;
      created_at: string;
    };
    if (article.revision > options.maxRevisions) continue;

    const since = article.last_update_at ?? article.created_at;
    const { data: links, error: linkError } = await client
      .from('cluster_items')
      .select('raw_item_id')
      .eq('cluster_id', cluster.id)
      .gt('added_at', since);
    if (linkError) continue;

    const ids = (links as { raw_item_id: string }[]).map((link) => link.raw_item_id);
    if (ids.length === 0) continue;

    const { data: items, error: itemError } = await client
      .from('raw_items')
      .select('source_id')
      .in('id', ids);
    if (itemError) continue;

    const sources = new Set((items as { source_id: string }[]).map((item) => item.source_id));
    if (sources.size < options.minNewSources) continue;

    candidates.push({
      clusterId: cluster.id,
      articleId: article.id,
      titleSample: cluster.title_sample,
      newItemCount: ids.length,
      newSourceCount: sources.size,
      articleRevision: article.revision,
      since,
    });
  }

  return candidates;
}

export async function getArticle(client: SupabaseClient, articleId: string): Promise<ArticleRow> {
  const { data, error } = await client.from('articles').select('*').eq('id', articleId).single();
  if (error) fail(`Citanje clanka ${articleId} nije proslo`, error);
  return data as ArticleRow;
}

/** Vesti koje su u temu ušle posle zadatog trenutka — materijal za dopunu. */
export async function newClusterItemsSince(
  client: SupabaseClient,
  clusterId: string,
  since: string,
): Promise<ClusterSourceItem[]> {
  const { data: links, error } = await client
    .from('cluster_items')
    .select('raw_item_id')
    .eq('cluster_id', clusterId)
    .gt('added_at', since);
  if (error) fail('Citanje novih clanova teme nije proslo', error);

  const ids = (links as { raw_item_id: string }[]).map((link) => link.raw_item_id);
  if (ids.length === 0) return [];

  const { data, error: itemError } = await client
    .from('raw_items')
    .select('source_id, title, summary, content, published_at, word_count')
    .in('id', ids)
    .order('published_at', { ascending: false });
  if (itemError) fail('Citanje novih vesti u temi nije proslo', itemError);
  return data as ClusterSourceItem[];
}

export interface ArticleUpdate {
  title: string;
  lead: string;
  body: string;
  wordCount: number;
  keywords: string[];
  notes: string[];
  bothSides: Record<string, string> | null;
  sourcesDiverge: boolean;
  sensitive: boolean;
  sensitivityReason: string | null;
  model: string;
  usage: Record<string, number>;
  costUsd: number;
  changeNote: string;
}

/**
 * Upisuje dopunjen članak: stara verzija ide u istoriju, nova u `articles`.
 * Slug i URL ostaju isti.
 */
export async function applyArticleUpdate(
  client: SupabaseClient,
  articleId: string,
  update: ArticleUpdate,
): Promise<number> {
  const previous = await getArticle(client, articleId);

  const { error: revisionError } = await client.from('article_revisions').insert({
    article_id: articleId,
    revision: previous.revision,
    title: previous.title,
    lead: previous.lead,
    body: previous.body,
    reason: update.changeNote.slice(0, 500),
    model: previous.model,
    usage: previous.usage,
    cost_usd: previous.cost_usd,
  });
  if (revisionError) fail('Upis prethodne verzije clanka nije prosao', revisionError);

  const revision = previous.revision + 1;
  const now = new Date().toISOString();

  const { error } = await client
    .from('articles')
    .update({
      title: update.title,
      lead: update.lead,
      body: update.body,
      word_count: update.wordCount,
      keywords: update.keywords,
      notes: update.notes,
      both_sides: update.bothSides,
      sources_diverge: update.sourcesDiverge,
      sensitive: update.sensitive,
      sensitivity_reason: update.sensitivityReason,
      model: update.model,
      usage: update.usage,
      // Trošak se sabira: članak zna koliko je ukupno koštao kroz sve verzije.
      cost_usd: Number((Number(previous.cost_usd) + update.costUsd).toFixed(6)),
      revision,
      last_update_at: now,
    })
    .eq('id', articleId);
  if (error) fail(`Dopuna clanka ${articleId} nije prosla`, error);

  return revision;
}

/**
 * Koliko je dopuna uradjeno danas. Dopuna se placa kao i pisanje, pa ulazi u
 * istu dnevnu granicu — inace bi svaki ciklus dodavao trosak van plana.
 */
export async function updatesToday(client: SupabaseClient): Promise<number> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);

  const { count, error } = await client
    .from('article_revisions')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since.toISOString());
  if (error) fail('Brojanje danasnjih dopuna nije proslo', error);
  return count ?? 0;
}
