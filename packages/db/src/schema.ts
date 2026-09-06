/** Redovi tabela iz `packages/db/migrations`. Imena polja su ista kao u bazi. */

export interface SourceRow {
  id: string;
  name: string;
  angle: 'provladin' | 'kriticki' | 'mejnstrim' | 'agencija';
  homepage: string;
  enabled: boolean;
  consecutive_failures: number;
  disabled_until: string | null;
  last_error: string | null;
  last_success_at: string | null;
}

export interface FetchStateRow {
  url: string;
  source_id: string | null;
  etag: string | null;
  last_modified: string | null;
  last_status: number | null;
  last_fetched_at: string | null;
  last_changed_at: string | null;
}

export interface RawItemRow {
  id: string;
  source_id: string;
  url: string;
  canonical_url: string | null;
  url_hash: string;
  content_hash: string;
  title: string;
  summary: string | null;
  content: string | null;
  word_count: number;
  author: string | null;
  image_url: string | null;
  language: string | null;
  published_at: string | null;
  fetched_at: string;
  extraction: 'readability' | 'feed' | 'none';
}

/** Novi red pre upisa — baza sama popunjava `id`, `fetched_at` i `created_at`. */
export type NewRawItem = Omit<RawItemRow, 'id' | 'fetched_at'> & { fetched_at?: string };

export interface PipelineRunRow {
  id: string;
  command: 'discover' | 'ingest' | 'editorial' | 'sweep';
  started_at: string;
  finished_at: string | null;
  ok: boolean | null;
  stats: Record<string, number>;
  errors: string[];
}
