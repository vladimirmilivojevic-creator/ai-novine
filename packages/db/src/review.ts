import type { SupabaseClient } from '@supabase/supabase-js';
import type { ArticleRow } from './schema.js';

/**
 * Red za ljudsko odobravanje osetljivih članaka (Faza 7).
 *
 * Brief, sekcija 7: članak o krivičnom postupku, tragediji sa žrtvama ili
 * sudskom procesu ne izlazi sam. **Ćutanje nije odobrenje** — ako vlasnik ne
 * odgovori u roku, članak ostaje nacrt.
 */

function fail(context: string, error: { message: string; code?: string }): never {
  throw new Error(`${context}: ${error.message}${error.code ? ` (${error.code})` : ''}`);
}

export interface ReviewRow {
  id: string;
  article_id: string;
  chat_id: string;
  message_id: number | null;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'failed';
  sent_at: string;
  decided_at: string | null;
  decided_by: string | null;
  error: string | null;
}

/** Osetljivi članci koji još nisu poslati na odobrenje. */
export async function articlesAwaitingSubmission(
  client: SupabaseClient,
  limit = 10,
): Promise<ArticleRow[]> {
  const { data: sent, error: sentError } = await client.from('review_queue').select('article_id');
  if (sentError) fail('Citanje reda za odobravanje nije proslo', sentError);

  const alreadySent = new Set((sent as { article_id: string }[]).map((row) => row.article_id));

  const { data, error } = await client
    .from('articles')
    .select('*')
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true })
    .limit(limit + alreadySent.size);
  if (error) fail('Citanje clanaka koji cekaju odobrenje nije proslo', error);

  return (data as ArticleRow[]).filter((article) => !alreadySent.has(article.id)).slice(0, limit);
}

export async function recordReviewSent(
  client: SupabaseClient,
  entry: { articleId: string; chatId: string; messageId: number | null; error?: string },
): Promise<void> {
  const { error } = await client.from('review_queue').insert({
    article_id: entry.articleId,
    chat_id: entry.chatId,
    message_id: entry.messageId,
    status: entry.error ? 'failed' : 'pending',
    error: entry.error ?? null,
  });
  if (error) fail('Upis u red za odobravanje nije prosao', error);
}

export async function pendingReviews(client: SupabaseClient): Promise<ReviewRow[]> {
  const { data, error } = await client
    .from('review_queue')
    .select('*')
    .eq('status', 'pending')
    .order('sent_at');
  if (error) fail('Citanje poslatih zahteva nije proslo', error);
  return data as ReviewRow[];
}

/**
 * Upisuje odluku i menja stanje članka.
 *
 * Odobren članak dobija `published` i vreme objave; odbijen dobija `rejected` i
 * ostaje u bazi — ne briše se, jer i odbijanje je podatak.
 */
export async function applyReviewDecision(
  client: SupabaseClient,
  articleId: string,
  decision: 'approved' | 'rejected',
  decidedBy: string,
): Promise<void> {
  const now = new Date().toISOString();

  const { error: reviewError } = await client
    .from('review_queue')
    .update({ status: decision, decided_at: now, decided_by: decidedBy })
    .eq('article_id', articleId);
  if (reviewError) fail('Upis odluke nije prosao', reviewError);

  const { error } = await client
    .from('articles')
    .update(
      decision === 'approved' ? { status: 'published', published_at: now } : { status: 'rejected' },
    )
    .eq('id', articleId);
  if (error) fail(`Promena stanja clanka ${articleId} nije prosla`, error);
}

/**
 * Zahtevi stariji od roka. Clanak ostaje `pending_review` — dakle neobjavljen —
 * jer cutanje nije odobrenje (brief, sekcija 7).
 */
export async function expireOldReviews(
  client: SupabaseClient,
  timeoutHours: number,
): Promise<ReviewRow[]> {
  const cutoff = new Date(Date.now() - timeoutHours * 3600_000).toISOString();

  const { data, error } = await client
    .from('review_queue')
    .update({ status: 'expired', decided_at: new Date().toISOString() })
    .eq('status', 'pending')
    .lt('sent_at', cutoff)
    .select('*');
  if (error) fail('Gasenje isteklih zahteva nije proslo', error);
  return data as ReviewRow[];
}

// ─────────────────────────────────────────────────────────────────────────────
// app_state — sitno stanje pipeline-a
// ─────────────────────────────────────────────────────────────────────────────

export async function readState<T>(client: SupabaseClient, key: string): Promise<T | null> {
  const { data, error } = await client
    .from('app_state')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) fail(`Citanje stanja ${key} nije proslo`, error);
  return (data as { value: T } | null)?.value ?? null;
}

export async function writeState(
  client: SupabaseClient,
  key: string,
  value: unknown,
): Promise<void> {
  const { error } = await client
    .from('app_state')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) fail(`Upis stanja ${key} nije prosao`, error);
}

/** Zahtev za odobravanje jednog clanka; `null` ako clanak nije ni poslat. */
export async function reviewForArticle(
  client: SupabaseClient,
  articleId: string,
): Promise<ReviewRow | null> {
  const { data, error } = await client
    .from('review_queue')
    .select('*')
    .eq('article_id', articleId)
    .maybeSingle();
  if (error) fail(`Citanje zahteva za clanak ${articleId} nije proslo`, error);
  return (data as ReviewRow | null) ?? null;
}
