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
  extraction: 'readability' | 'jsonld' | 'container' | 'feed' | 'none';
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

export interface ClusterRow {
  id: string;
  created_at: string;
  updated_at: string;
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
  status: 'open' | 'covered' | 'rejected';
  article_id: string | null;
  needs_flagship: boolean;
}

export interface ClusterItemRow {
  cluster_id: string;
  raw_item_id: string;
  similarity: number | null;
  added_at: string;
}

export interface ArticleRow {
  id: string;
  cluster_id: string | null;
  slug: string;
  title: string;
  lead: string;
  body: string;
  category: string;
  status: 'draft' | 'pending_review' | 'published' | 'rejected';
  sensitive: boolean;
  sensitivity_reason: string | null;
  both_sides: Record<string, string> | null;
  sources_diverge: boolean;
  keywords: string[];
  notes: string[];
  word_count: number;
  model: string;
  usage: Record<string, number>;
  cost_usd: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  revision: number;
  last_update_at: string | null;
}

export type NewArticle = Omit<
  ArticleRow,
  'id' | 'created_at' | 'updated_at' | 'revision' | 'last_update_at'
>;

export interface ArticleBatchRow {
  id: string;
  batch_id: string;
  model: string;
  status: 'submitted' | 'collected' | 'failed' | 'canceled';
  request_count: number;
  cluster_map: Record<string, string>;
  submitted_at: string;
  collected_at: string | null;
  succeeded: number;
  failed: number;
  cost_usd: number;
  errors: string[];
}
