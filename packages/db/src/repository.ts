import type { SupabaseClient } from '@supabase/supabase-js';
import type { Source } from '@ai-novine/core';
import type {
  ArticleBatchRow,
  ArticleRow,
  ClusterRow,
  FetchStateRow,
  NewRawItem,
  PipelineRunRow,
  NewArticle,
  RawItemRow,
  SourceRow,
} from './schema.js';

/** Postgres kod za povredu jedinstvenog indeksa. */
const UNIQUE_VIOLATION = '23505';

function fail(context: string, error: { message: string; code?: string }): never {
  throw new Error(`${context}: ${error.message}${error.code ? ` (${error.code})` : ''}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// sources
// ─────────────────────────────────────────────────────────────────────────────

/** Prepisuje `config/sources.json` u bazu. Stanje prekidaca se ne dira. */
export async function syncSources(client: SupabaseClient, sources: Source[]): Promise<number> {
  const rows = sources.map((source) => ({
    id: source.id,
    name: source.name,
    angle: source.angle,
    homepage: source.homepage,
    enabled: source.enabled,
  }));

  const { error } = await client.from('sources').upsert(rows, { onConflict: 'id' });
  if (error) fail('Upis izvora nije prosao', error);
  return rows.length;
}

export async function getSourceStates(
  client: SupabaseClient,
  ids: string[],
): Promise<Map<string, SourceRow>> {
  const { data, error } = await client.from('sources').select('*').in('id', ids);
  if (error) fail('Citanje izvora nije proslo', error);
  return new Map((data as SourceRow[]).map((row) => [row.id, row]));
}

/** Uspesan ciklus: prekidac se resetuje. */
export async function recordSourceSuccess(client: SupabaseClient, sourceId: string): Promise<void> {
  const { error } = await client
    .from('sources')
    .update({
      consecutive_failures: 0,
      disabled_until: null,
      last_error: null,
      last_success_at: new Date().toISOString(),
    })
    .eq('id', sourceId);
  if (error) fail(`Upis uspeha za ${sourceId} nije prosao`, error);
}

/**
 * Neuspeh: broji se, i kad dostigne prag, izvor se gasi na zadati broj sati
 * (brief, sekcija 3 — jedan izvor ne sme da obori ceo pipeline).
 */
export async function recordSourceFailure(
  client: SupabaseClient,
  sourceId: string,
  message: string,
  options: { maxConsecutiveFailures: number; disableForHours: number },
): Promise<{ failures: number; disabledUntil: string | null }> {
  const { data, error } = await client
    .from('sources')
    .select('consecutive_failures')
    .eq('id', sourceId)
    .single();
  if (error) fail(`Citanje stanja za ${sourceId} nije proslo`, error);

  const failures = ((data as { consecutive_failures: number }).consecutive_failures ?? 0) + 1;
  const disabledUntil =
    failures >= options.maxConsecutiveFailures
      ? new Date(Date.now() + options.disableForHours * 3600_000).toISOString()
      : null;

  const { error: updateError } = await client
    .from('sources')
    .update({
      consecutive_failures: failures,
      disabled_until: disabledUntil,
      last_error: message.slice(0, 500),
    })
    .eq('id', sourceId);
  if (updateError) fail(`Upis neuspeha za ${sourceId} nije prosao`, updateError);

  return { failures, disabledUntil };
}

// ─────────────────────────────────────────────────────────────────────────────
// fetch_state — uslovni GET
// ─────────────────────────────────────────────────────────────────────────────

export async function getFetchStates(
  client: SupabaseClient,
  urls: string[],
): Promise<Map<string, FetchStateRow>> {
  if (urls.length === 0) return new Map();

  const { data, error } = await client.from('fetch_state').select('*').in('url', urls);
  if (error) fail('Citanje stanja dohvatanja nije proslo', error);
  return new Map((data as FetchStateRow[]).map((row) => [row.url, row]));
}

export async function saveFetchState(
  client: SupabaseClient,
  state: {
    url: string;
    sourceId: string;
    etag: string | null;
    lastModified: string | null;
    status: number;
    changed: boolean;
  },
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await client.from('fetch_state').upsert(
    {
      url: state.url,
      source_id: state.sourceId,
      etag: state.etag,
      last_modified: state.lastModified,
      last_status: state.status,
      last_fetched_at: now,
      ...(state.changed ? { last_changed_at: now } : {}),
    },
    { onConflict: 'url' },
  );
  if (error) fail('Upis stanja dohvatanja nije prosao', error);
}

// ─────────────────────────────────────────────────────────────────────────────
// raw_items
// ─────────────────────────────────────────────────────────────────────────────

/** Koji od zadatih URL heseva vec postoje u bazi. */
export async function existingUrlHashes(
  client: SupabaseClient,
  hashes: string[],
): Promise<Set<string>> {
  return existingHashes(client, 'url_hash', hashes);
}

/** Koji od zadatih heseva sadrzaja vec postoje za taj izvor. */
export async function existingContentHashes(
  client: SupabaseClient,
  sourceId: string,
  hashes: string[],
): Promise<Set<string>> {
  return existingHashes(client, 'content_hash', hashes, sourceId);
}

async function existingHashes(
  client: SupabaseClient,
  column: 'url_hash' | 'content_hash',
  hashes: string[],
  sourceId?: string,
): Promise<Set<string>> {
  if (hashes.length === 0) return new Set();

  const found = new Set<string>();
  // PostgREST salje filter kroz URL, pa se ide u serijama.
  for (const batch of chunk(hashes, 200)) {
    let query = client.from('raw_items').select(column).in(column, batch);
    if (sourceId) query = query.eq('source_id', sourceId);

    const { data, error } = await query;
    if (error) fail(`Provera postojecih ${column} vrednosti nije prosla`, error);
    for (const row of data as Record<string, string>[]) {
      const value = row[column];
      if (value) found.add(value);
    }
  }
  return found;
}

export interface InsertResult {
  inserted: number;
  duplicates: number;
}

/**
 * Upisuje nove sirove clanke. Duplikati (isti URL, ili isti tekst sa istog
 * izvora) se tiho preskacu — u trci izmedju dva ciklusa to je ocekivano, ne
 * greska.
 */
export async function insertRawItems(
  client: SupabaseClient,
  items: NewRawItem[],
): Promise<InsertResult> {
  if (items.length === 0) return { inserted: 0, duplicates: 0 };

  const { data, error } = await client.from('raw_items').insert(items).select('id');
  if (!error) return { inserted: (data as { id: string }[]).length, duplicates: 0 };

  // Serija je pukla zbog duplikata — pokusaj red po red da ostalo prodje.
  if (error.code !== UNIQUE_VIOLATION) fail('Upis sirovih clanaka nije prosao', error);

  let inserted = 0;
  let duplicates = 0;
  for (const item of items) {
    const { error: rowError } = await client.from('raw_items').insert(item);
    if (!rowError) inserted += 1;
    else if (rowError.code === UNIQUE_VIOLATION) duplicates += 1;
    else fail(`Upis clanka ${item.url} nije prosao`, rowError);
  }
  return { inserted, duplicates };
}

export async function countRawItems(client: SupabaseClient, sourceId?: string): Promise<number> {
  let query = client.from('raw_items').select('id', { count: 'exact', head: true });
  if (sourceId) query = query.eq('source_id', sourceId);

  const { count, error } = await query;
  if (error) fail('Brojanje sirovih clanaka nije proslo', error);
  return count ?? 0;
}

export async function latestRawItems(
  client: SupabaseClient,
  limit: number,
): Promise<Pick<RawItemRow, 'source_id' | 'title' | 'url' | 'word_count' | 'published_at'>[]> {
  const { data, error } = await client
    .from('raw_items')
    .select('source_id, title, url, word_count, published_at')
    .order('fetched_at', { ascending: false })
    .limit(limit);
  if (error) fail('Citanje poslednjih clanaka nije proslo', error);
  return data as Pick<RawItemRow, 'source_id' | 'title' | 'url' | 'word_count' | 'published_at'>[];
}

// ─────────────────────────────────────────────────────────────────────────────
// pipeline_runs
// ─────────────────────────────────────────────────────────────────────────────

export async function startRun(
  client: SupabaseClient,
  command: PipelineRunRow['command'],
): Promise<string> {
  const { data, error } = await client
    .from('pipeline_runs')
    .insert({ command })
    .select('id')
    .single();
  if (error) fail('Otvaranje zapisa o pokretanju nije proslo', error);
  return (data as { id: string }).id;
}

export async function finishRun(
  client: SupabaseClient,
  id: string,
  ok: boolean,
  stats: Record<string, number>,
  errors: string[],
): Promise<void> {
  const { error } = await client
    .from('pipeline_runs')
    .update({ finished_at: new Date().toISOString(), ok, stats, errors: errors.slice(0, 50) })
    .eq('id', id);
  if (error) fail('Zatvaranje zapisa o pokretanju nije proslo', error);
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

// ─────────────────────────────────────────────────────────────────────────────
// Retention — Supabase besplatni tier je 500 MB
// ─────────────────────────────────────────────────────────────────────────────

/** Brise sirove clanke starije od zadatog broja dana. Vraca broj obrisanih. */
export async function deleteOldRawItems(client: SupabaseClient, days: number): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await client
    .from('raw_items')
    .delete()
    .lt('fetched_at', cutoff)
    .select('id');
  if (error) fail('Brisanje starih sirovih clanaka nije proslo', error);
  return (data as { id: string }[]).length;
}

/** Brise zapise o pokretanjima starije od zadatog broja dana. */
export async function deleteOldRuns(client: SupabaseClient, days: number): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await client
    .from('pipeline_runs')
    .delete()
    .lt('started_at', cutoff)
    .select('id');
  if (error) fail('Brisanje starih zapisa o pokretanjima nije proslo', error);
  return (data as { id: string }[]).length;
}

/** Broj redova i procena zauzeca, za nadzor besplatnog tier-a. */
export async function storageSnapshot(client: SupabaseClient): Promise<{
  rawItems: number;
  runs: number;
  oldestRawItem: string | null;
}> {
  const [{ count: rawItems }, { count: runs }, { data: oldest }] = await Promise.all([
    client.from('raw_items').select('id', { count: 'exact', head: true }),
    client.from('pipeline_runs').select('id', { count: 'exact', head: true }),
    client.from('raw_items').select('fetched_at').order('fetched_at').limit(1),
  ]);

  return {
    rawItems: rawItems ?? 0,
    runs: runs ?? 0,
    oldestRawItem: (oldest as { fetched_at: string }[] | null)?.[0]?.fetched_at ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// clusters — Engine 2
// ─────────────────────────────────────────────────────────────────────────────

export interface RawItemForClustering {
  id: string;
  source_id: string;
  title: string;
  content: string | null;
  published_at: string | null;
  fetched_at: string;
}

/** Sirove vesti iz zadatog prozora, najnovije prve. */
export async function rawItemsForClustering(
  client: SupabaseClient,
  windowHours: number,
  limit = 1000,
): Promise<RawItemForClustering[]> {
  const cutoff = new Date(Date.now() - windowHours * 3600_000).toISOString();
  const { data, error } = await client
    .from('raw_items')
    .select('id, source_id, title, content, published_at, fetched_at')
    .gte('fetched_at', cutoff)
    .order('fetched_at', { ascending: false })
    .limit(limit);
  if (error) fail('Citanje vesti za klasterovanje nije proslo', error);
  return data as RawItemForClustering[];
}

/** Id-jevi vesti koje su vec u nekoj temi. */
export async function clusteredItemIds(
  client: SupabaseClient,
  itemIds: string[],
): Promise<Set<string>> {
  const found = new Set<string>();

  for (const batch of chunk(itemIds, 200)) {
    const { data, error } = await client
      .from('cluster_items')
      .select('raw_item_id')
      .in('raw_item_id', batch);
    if (error) fail('Provera vec klasterovanih vesti nije prosla', error);
    for (const row of data as { raw_item_id: string }[]) found.add(row.raw_item_id);
  }
  return found;
}

/** Otvorene teme koje su se pomerile unutar prozora. */
export async function openClusters(
  client: SupabaseClient,
  windowHours: number,
  limit = 500,
): Promise<ClusterRow[]> {
  const cutoff = new Date(Date.now() - windowHours * 3600_000).toISOString();
  const { data, error } = await client
    .from('clusters')
    .select('*')
    // I teme koje VEC imaju clanak ostaju u igri. To je sustina pravila iz
    // sekcije 5 brief-a: nova vest o prici koja je pokrivena mora da udje u
    // postojecu temu, jer bi inace otvorila novu i dobila drugi, skoro
    // identican clanak.
    .in('status', ['open', 'covered'])
    .gte('updated_at', cutoff)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) fail('Citanje otvorenih tema nije proslo', error);
  return data as ClusterRow[];
}

export interface ClusterUpsert {
  id: string | null;
  first_item_at: string | null;
  last_item_at: string | null;
  size: number;
  distinct_sources: number;
  angles: string[];
  keywords: string[];
  entities: string[];
  centroid: Record<string, number>;
  trending_score: number;
  title_sample: string | null;
}

/** Upisuje ili osvezava temu i vraca njen id. */
export async function saveCluster(client: SupabaseClient, cluster: ClusterUpsert): Promise<string> {
  const payload = { ...cluster, updated_at: new Date().toISOString() };

  if (cluster.id) {
    const { error } = await client.from('clusters').update(payload).eq('id', cluster.id);
    if (error) fail(`Osvezavanje teme ${cluster.id} nije proslo`, error);
    return cluster.id;
  }

  const { id: _ignored, ...insertPayload } = payload;
  const { data, error } = await client.from('clusters').insert(insertPayload).select('id').single();
  if (error) fail('Upis nove teme nije prosao', error);
  return (data as { id: string }).id;
}

export async function addClusterItems(
  client: SupabaseClient,
  clusterId: string,
  items: { rawItemId: string; similarity: number }[],
): Promise<number> {
  if (items.length === 0) return 0;

  const rows = items.map((item) => ({
    cluster_id: clusterId,
    raw_item_id: item.rawItemId,
    similarity: item.similarity,
  }));

  const { error } = await client
    .from('cluster_items')
    .upsert(rows, { onConflict: 'cluster_id,raw_item_id', ignoreDuplicates: true });
  if (error) fail('Upis clanova teme nije prosao', error);
  return rows.length;
}

export interface ClusterWithMembers extends ClusterRow {
  members: { title: string; source_id: string; url: string; published_at: string | null }[];
}

/** Najjace teme sa naslovima unutar svake — za izvestaj vlasniku. */
export async function topClusters(
  client: SupabaseClient,
  limit: number,
  minSize = 1,
): Promise<ClusterWithMembers[]> {
  const { data, error } = await client
    .from('clusters')
    .select('*')
    .gte('size', minSize)
    .order('trending_score', { ascending: false })
    .limit(limit);
  if (error) fail('Citanje najjacih tema nije proslo', error);

  const clusters = data as ClusterRow[];
  const result: ClusterWithMembers[] = [];

  for (const cluster of clusters) {
    const { data: links, error: linkError } = await client
      .from('cluster_items')
      .select('raw_item_id')
      .eq('cluster_id', cluster.id);
    if (linkError) fail('Citanje clanova teme nije proslo', linkError);

    const ids = (links as { raw_item_id: string }[]).map((row) => row.raw_item_id);
    if (ids.length === 0) {
      result.push({ ...cluster, members: [] });
      continue;
    }

    const { data: items, error: itemError } = await client
      .from('raw_items')
      .select('title, source_id, url, published_at')
      .in('id', ids);
    if (itemError) fail('Citanje vesti u temi nije proslo', itemError);

    result.push({
      ...cluster,
      members: items as ClusterWithMembers['members'],
    });
  }
  return result;
}

/**
 * Brise sve teme. Teme su izveden podatak — prave se ponovo iz `raw_items`,
 * pa je ovo bezbedno posle promene praga slicnosti ili nacina poredjenja.
 */
export async function deleteAllClusters(client: SupabaseClient): Promise<number> {
  const { data, error } = await client
    .from('clusters')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
    .select('id');
  if (error) fail('Brisanje tema nije proslo', error);
  return (data as { id: string }[]).length;
}

/** Brise zadate teme (npr. one koje su spojene u drugu). */
export async function deleteClusters(client: SupabaseClient, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;

  const { data, error } = await client.from('clusters').delete().in('id', ids).select('id');
  if (error) fail('Brisanje spojenih tema nije proslo', error);
  return (data as { id: string }[]).length;
}

// ─────────────────────────────────────────────────────────────────────────────
// articles — Faza 5
// ─────────────────────────────────────────────────────────────────────────────

export interface ClusterCandidateRow {
  id: string;
  title_sample: string | null;
  trending_score: number;
  distinct_sources: number;
  angles: string[];
  size: number;
  /** Jeftiniji model nije dostigao potrebnu duzinu — ide jacim. */
  needs_flagship: boolean;
}

/** Teme koje jos nemaju clanak, najjace prve. */
export async function clustersWithoutArticle(
  client: SupabaseClient,
  limit = 40,
): Promise<ClusterCandidateRow[]> {
  const { data, error } = await client
    .from('clusters')
    .select('id, title_sample, trending_score, distinct_sources, angles, size, needs_flagship')
    .eq('status', 'open')
    .is('article_id', null)
    .order('trending_score', { ascending: false })
    .limit(limit);
  if (error) fail('Citanje tema bez clanka nije proslo', error);
  return data as ClusterCandidateRow[];
}

export interface ClusterSourceItem {
  source_id: string;
  title: string;
  summary: string | null;
  content: string | null;
  published_at: string | null;
  word_count: number;
}

/** Sirove vesti jedne teme — materijal koji ide modelu. */
export async function clusterSourceItems(
  client: SupabaseClient,
  clusterId: string,
): Promise<ClusterSourceItem[]> {
  const { data: links, error } = await client
    .from('cluster_items')
    .select('raw_item_id')
    .eq('cluster_id', clusterId);
  if (error) fail('Citanje clanova teme nije proslo', error);

  const ids = (links as { raw_item_id: string }[]).map((row) => row.raw_item_id);
  if (ids.length === 0) return [];

  const { data, error: itemError } = await client
    .from('raw_items')
    .select('source_id, title, summary, content, published_at, word_count')
    .in('id', ids)
    .order('word_count', { ascending: false });
  if (itemError) fail('Citanje vesti u temi nije proslo', itemError);
  return data as ClusterSourceItem[];
}

export async function insertArticle(client: SupabaseClient, article: NewArticle): Promise<string> {
  const { data, error } = await client.from('articles').insert(article).select('id').single();
  if (error) fail('Upis clanka nije prosao', error);
  return (data as { id: string }).id;
}

/** Vezuje temu za clanak i sklanja je iz reda za pisanje. */
export async function markClusterCovered(
  client: SupabaseClient,
  clusterId: string,
  articleId: string,
): Promise<void> {
  const { error } = await client
    .from('clusters')
    .update({ status: 'covered', article_id: articleId })
    .eq('id', clusterId);
  if (error) fail(`Povezivanje teme ${clusterId} sa clankom nije proslo`, error);
}

/** Koliko je clanaka napisano od pocetka dana, ukupno i jacim modelom. */
export async function articlesWrittenToday(
  client: SupabaseClient,
  flagshipModel: string,
): Promise<{ total: number; flagship: number }> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);

  const { data, error } = await client
    .from('articles')
    .select('model')
    .gte('created_at', since.toISOString());
  if (error) fail('Brojanje danasnjih clanaka nije proslo', error);

  const rows = data as { model: string }[];
  return {
    total: rows.length,
    flagship: rows.filter((row) => row.model === flagshipModel).length,
  };
}

export async function latestArticles(client: SupabaseClient, limit: number): Promise<ArticleRow[]> {
  const { data, error } = await client
    .from('articles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) fail('Citanje clanaka nije proslo', error);
  return data as ArticleRow[];
}

/** Ukupan trosak generisanja u tekucem mesecu, u dolarima. */
export async function monthlySpend(client: SupabaseClient): Promise<number> {
  const since = new Date();
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);

  const { data, error } = await client
    .from('articles')
    .select('cost_usd')
    .gte('created_at', since.toISOString());
  if (error) fail('Citanje mesecnog troska nije proslo', error);

  return (data as { cost_usd: number }[]).reduce((sum, row) => sum + Number(row.cost_usd), 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// article_batches — asinhrono pisanje kroz Batch API
// ─────────────────────────────────────────────────────────────────────────────

export async function recordBatchSubmission(
  client: SupabaseClient,
  batch: {
    batchId: string;
    model: string;
    requestCount: number;
    clusterMap: Record<string, string>;
  },
): Promise<void> {
  const { error } = await client.from('article_batches').insert({
    batch_id: batch.batchId,
    model: batch.model,
    request_count: batch.requestCount,
    cluster_map: batch.clusterMap,
  });
  if (error) fail('Upis poslatog paketa nije prosao', error);
}

/** Paketi koji cekaju da se pokupe. */
export async function pendingBatches(client: SupabaseClient): Promise<ArticleBatchRow[]> {
  const { data, error } = await client
    .from('article_batches')
    .select('*')
    .eq('status', 'submitted')
    .order('submitted_at');
  if (error) fail('Citanje poslatih paketa nije proslo', error);
  return data as ArticleBatchRow[];
}

export async function markBatchCollected(
  client: SupabaseClient,
  batchId: string,
  result: { succeeded: number; failed: number; costUsd: number; errors: string[] },
): Promise<void> {
  const { error } = await client
    .from('article_batches')
    .update({
      status: 'collected',
      collected_at: new Date().toISOString(),
      succeeded: result.succeeded,
      failed: result.failed,
      cost_usd: Number(result.costUsd.toFixed(6)),
      errors: result.errors.slice(0, 50),
    })
    .eq('batch_id', batchId);
  if (error) fail(`Zatvaranje paketa ${batchId} nije proslo`, error);
}

/** Da li tema vec ceka odgovor u nekom poslatom paketu. */
export async function clusterIdsInFlight(client: SupabaseClient): Promise<Set<string>> {
  const batches = await pendingBatches(client);
  const ids = new Set<string>();
  for (const batch of batches) {
    for (const clusterId of Object.values(batch.cluster_map)) ids.add(clusterId);
  }
  return ids;
}

/** Oznaci temu da je sledeci put pise jaci model. */
export async function markClusterNeedsFlagship(
  client: SupabaseClient,
  clusterId: string,
): Promise<void> {
  const { error } = await client
    .from('clusters')
    .update({ needs_flagship: true })
    .eq('id', clusterId);
  if (error) fail(`Oznacavanje teme ${clusterId} nije proslo`, error);
}

// ─────────────────────────────────────────────────────────────────────────────
// Naslovne slike (Faza 8)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Da li clanak treba (pre)crtati.
 *
 * Dva slucaja: nikad nije imao sliku, ili je dopunjen posle nego sto je slika
 * nacrtana — a dopuna sme da promeni naslov, koji je na slici ispisan.
 */
export function coverIsStale(
  article: Pick<ArticleRow, 'cover_url' | 'cover_at' | 'last_update_at'>,
): boolean {
  if (!article.cover_url) return true;
  if (!article.last_update_at) return false;
  if (!article.cover_at) return true;
  return Date.parse(article.cover_at) < Date.parse(article.last_update_at);
}

/**
 * Clanci kojima treba slika: oni bez nje, plus oni dopunjeni posle crtanja.
 *
 * Slika se crta posle pisanja, u zasebnom koraku, da neuspelo crtanje nikad ne
 * obori pisanje clanka — tekst je proizvod, slika je omot.
 */
export async function articlesNeedingCover(
  client: SupabaseClient,
  limit = 20,
): Promise<ArticleRow[]> {
  const { data: bezSlike, error } = await client
    .from('articles')
    .select('*')
    .is('cover_url', null)
    .neq('status', 'rejected')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) fail('Citanje clanaka bez slike nije proslo', error);

  const found = new Map((bezSlike as ArticleRow[]).map((article) => [article.id, article]));
  if (found.size >= limit) return [...found.values()].slice(0, limit);

  // Dopunjeni clanci: PostgREST ne uporedjuje dve kolone, pa se poredjenje
  // radi ovde. Prozor je nedelju dana — starije dopune se vise ne desavaju.
  const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const { data: dopunjeni, error: updateError } = await client
    .from('articles')
    .select('*')
    .not('last_update_at', 'is', null)
    .gte('last_update_at', since)
    .neq('status', 'rejected')
    .order('last_update_at', { ascending: false })
    .limit(limit);
  if (updateError) fail('Citanje dopunjenih clanaka nije proslo', updateError);

  for (const article of dopunjeni as ArticleRow[]) {
    if (found.size >= limit) break;
    if (coverIsStale(article)) found.set(article.id, article);
  }

  return [...found.values()].slice(0, limit);
}

export async function setArticleCover(
  client: SupabaseClient,
  articleId: string,
  cover: { url: string; variant: string },
): Promise<void> {
  const { error } = await client
    .from('articles')
    .update({
      cover_url: cover.url,
      cover_variant: cover.variant,
      cover_at: new Date().toISOString(),
    })
    .eq('id', articleId);
  if (error) fail(`Upis slike za clanak ${articleId} nije prosao`, error);
}
