import type { Angle, Category } from './config.js';

/** Jedan sirovi clanak dohvacen sa nekog izvora (tabela `raw_items`, Faza 2). */
export interface RawItem {
  id: string;
  sourceId: string;
  url: string;
  canonicalUrl: string | null;
  title: string;
  summary: string | null;
  content: string | null;
  contentHash: string;
  publishedAt: string | null;
  fetchedAt: string;
}

/** Grupa sirovih clanaka o istoj temi (tabela `clusters`, Faza 4). */
export interface Cluster {
  id: string;
  createdAt: string;
  updatedAt: string;
  itemIds: string[];
  distinctSources: number;
  distinctAngles: Angle[];
  keywords: string[];
  entities: string[];
  trendingScore: number;
  articleId: string | null;
}

export type ArticleStatus = 'draft' | 'pending_review' | 'published' | 'rejected';

/** Generisan clanak (tabela `articles`, Faza 5). */
export interface Article {
  id: string;
  clusterId: string;
  slug: string;
  title: string;
  lead: string;
  body: string;
  category: Category;
  status: ArticleStatus;
  sensitive: boolean;
  bothSides: BothSides | null;
  model: string;
  wordCount: number;
  publishedAt: string | null;
  updatedAt: string;
}

/**
 * Prikaz "obe strane". Paneli se NIKAD ne etiketiraju imenom izvora — samo
 * genericka oznaka ugla (brief, sekcija 5).
 */
export interface BothSides {
  officialLabel: string;
  officialText: string;
  criticalLabel: string;
  criticalText: string;
}

/** Zapis o jednom pokretanju pipeline-a (tabela `pipeline_runs`, Faza 3). */
export interface PipelineRun {
  id: string;
  command: 'discover' | 'ingest' | 'editorial' | 'sweep';
  startedAt: string;
  finishedAt: string | null;
  ok: boolean;
  stats: Record<string, number>;
  errors: string[];
}
