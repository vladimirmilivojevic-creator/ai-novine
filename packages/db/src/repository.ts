import type { SupabaseClient } from '@supabase/supabase-js';
import type { Source } from '@ai-novine/core';
import type { FetchStateRow, NewRawItem, PipelineRunRow, RawItemRow, SourceRow } from './schema.js';

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
