import {
  createLogger,
  hasEnv,
  loadDotEnv,
  loadEditorialConfig,
  requireEnv,
  type EditorialConfig,
} from '@ai-novine/core';
import {
  applyReviewDecision,
  articlesAwaitingSubmission,
  createServiceClient,
  expireOldReviews,
  getArticle,
  pendingReviews,
  readState,
  recordReviewSent,
  reviewForArticle,
  writeState,
  type ReviewRow,
} from '@ai-novine/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  answerCallbackQuery,
  editMessageText,
  getUpdates,
  sendMessage,
  TelegramError,
} from '../telegram/client.js';
import {
  buildReviewMessage,
  decidedMessage,
  parseCallbackData,
  reviewButtons,
  type ReviewMessageInput,
} from '../telegram/format.js';

const log = createLogger('review');

/** Ključ pod kojim se pamti dokle su Telegram poruke pročitane. */
const OFFSET_KEY = 'telegram_update_offset';

export interface ReviewOptions {
  /** Ne šalji i ne menjaj ništa — samo prikaži šta bi bilo urađeno. */
  dryRun: boolean;
}

/**
 * Ljudsko odobravanje osetljivih članaka preko Telegrama (Faza 7).
 *
 * Jedno pokretanje radi tri stvari, tim redom:
 *
 * 1. **Pokupi odluke** koje je vlasnik doneo pritiskom na dugme.
 * 2. **Ugasi zahteve** starije od roka — ćutanje nije odobrenje, članak ostaje
 *    nacrt (brief, sekcija 7).
 * 3. **Pošalje nove** osetljive članke na odobrenje.
 *
 * Radi **bez javne adrese**: bot sam pita Telegram ima li novih odgovora
 * (`getUpdates`), umesto da čeka da Telegram pozove nas (webhook). Webhook
 * dolazi u Fazi 11, kad sajt dobije adresu; do tada je cena ovog rešenja
 * zakašnjenje od jednog ciklusa.
 */
export async function runReview(options: ReviewOptions): Promise<void> {
  loadDotEnv();

  // Telegram je opcion deo sistema. Ako nije podesen, posao se uredno preskace
  // umesto da obori ceo ciklus — clanci onda samo ostaju u redu za odobrenje.
  if (!hasEnv('TELEGRAM_BOT_TOKEN') || !hasEnv('TELEGRAM_CHAT_ID')) {
    log.warn('Telegram nije podesen, odobravanje se preskace.', {
      nedostaje: [
        hasEnv('TELEGRAM_BOT_TOKEN') ? null : 'TELEGRAM_BOT_TOKEN',
        hasEnv('TELEGRAM_CHAT_ID') ? null : 'TELEGRAM_CHAT_ID',
      ]
        .filter(Boolean)
        .join(', '),
    });
    return;
  }

  const editorial = loadEditorialConfig();
  const client = createServiceClient();
  const chatId = requireEnv('TELEGRAM_CHAT_ID');

  if (options.dryRun) {
    await showPlan(client, editorial);
    return;
  }

  const decisions = await collectDecisions(client, chatId);
  const expired = await expireStale(client, editorial, chatId);
  const sent = await sendPending(client, chatId);

  log.info('Odobravanje završeno.', {
    pokupljenoOdluka: decisions,
    isteklo: expired,
    poslato: sent,
  });
}

async function showPlan(client: SupabaseClient, editorial: EditorialConfig): Promise<void> {
  const waiting = await articlesAwaitingSubmission(client, 10);
  const pending = await pendingReviews(client);

  console.log('');
  console.log('Probni režim — ništa nije poslato ni promenjeno.');
  console.log('');
  console.log(`Članaka koji bi bili poslati na odobrenje: ${waiting.length}`);
  for (const article of waiting) {
    console.log(
      `  · ${article.title.slice(0, 62)}` +
        `\n      razlog: ${article.sensitivity_reason ?? 'nije naveden'}`,
    );
  }
  console.log('');
  console.log(`Zahteva koji čekaju odgovor: ${pending.length}`);
  for (const review of pending) {
    const hours = (Date.now() - new Date(review.sent_at).getTime()) / 3600_000;
    console.log(
      `  · poslato pre ${hours.toFixed(1)} h · ističe posle ${editorial.sensitivity.approvalTimeoutHours} h`,
    );
  }
  console.log('');
}

/**
 * Čita pritiske dugmadi i primenjuje odluke.
 *
 * Odluku prihvata **samo iz podešenog chata**. To je jedina prava zaštita ovog
 * kanala: identifikator poruke je javan podatak kad se zna token, ali odgovor
 * iz tuđeg chata se odbacuje.
 */
async function collectDecisions(client: SupabaseClient, chatId: string): Promise<number> {
  const offset = (await readState<number>(client, OFFSET_KEY)) ?? 0;

  let updates;
  try {
    updates = await getUpdates(offset);
  } catch (error) {
    if (error instanceof TelegramError) {
      log.error('Čitanje odgovora nije prošlo.', { greska: error.message });
      return 0;
    }
    throw error;
  }

  if (updates.length === 0) return 0;

  let applied = 0;
  let highest = offset;

  for (const update of updates) {
    highest = Math.max(highest, update.update_id);

    const callback = update.callback_query;
    if (!callback) continue;

    const parsed = parseCallbackData(callback.data);
    if (!parsed) continue;

    const fromChat = String(callback.message?.chat.id ?? '');
    if (fromChat !== chatId) {
      log.warn('Odgovor iz nepoznatog chata je odbačen.', { chat: fromChat });
      await answerCallbackQuery(callback.id, 'Nemaš dozvolu za ovu odluku.');
      continue;
    }

    const decidedBy = callback.from.username ?? String(callback.from.id);

    try {
      // Dva pritiska na isto dugme stizu kao dva odgovora. Odluka se primenjuje
      // jednom; drugi put se samo potvrdi, da se ne prepisuje vec upisano stanje
      // i ne pokusava izmena poruke koja je vec izmenjena.
      const existing = await reviewForArticle(client, parsed.articleId);
      if (existing && existing.status !== 'pending') {
        await answerCallbackQuery(callback.id, 'O ovom clanku je vec odluceno.');
        log.info('Ponovljen pritisak dugmeta je preskocen.', {
          clanak: parsed.articleId,
          vecOdluceno: existing.status,
        });
        continue;
      }

      const article = await getArticle(client, parsed.articleId);
      await applyReviewDecision(client, parsed.articleId, parsed.decision, decidedBy);

      await answerCallbackQuery(
        callback.id,
        parsed.decision === 'approved' ? 'Objavljeno.' : 'Odbijeno.',
      );
      if (callback.message) {
        await editMessageText(
          chatId,
          callback.message.message_id,
          decidedMessage(toMessageInput(article), parsed.decision),
        );
      }

      applied += 1;
      log.info(`Članak ${parsed.decision === 'approved' ? 'odobren' : 'odbijen'}.`, {
        clanak: parsed.articleId,
        odlucio: decidedBy,
        naslov: article.title.slice(0, 60),
      });
    } catch (error) {
      log.error('Odluka nije primenjena.', {
        clanak: parsed.articleId,
        greska: (error as Error).message,
      });
      await answerCallbackQuery(callback.id, 'Greška pri upisu odluke.');
    }
  }

  // Pomeraj se upisuje i kad nijedna odluka nije primenjena — inače bi se iste
  // poruke čitale u svakom ciklusu.
  await writeState(client, OFFSET_KEY, highest + 1);
  return applied;
}

async function expireStale(
  client: SupabaseClient,
  editorial: EditorialConfig,
  chatId: string,
): Promise<number> {
  const expired = await expireOldReviews(client, editorial.sensitivity.approvalTimeoutHours);

  for (const review of expired) {
    if (!review.message_id) continue;
    try {
      const article = await getArticle(client, review.article_id);
      await editMessageText(
        chatId,
        review.message_id,
        decidedMessage(toMessageInput(article), 'expired'),
      );
    } catch (error) {
      log.warn('Poruka o isteku nije izmenjena.', { greska: (error as Error).message });
    }
  }

  if (expired.length > 0) {
    log.info('Zahtevi su istekli bez odgovora; članci ostaju neobjavljeni.', {
      isteklo: expired.length,
      rokSati: editorial.sensitivity.approvalTimeoutHours,
    });
  }
  return expired.length;
}

async function sendPending(client: SupabaseClient, chatId: string): Promise<number> {
  const waiting = await articlesAwaitingSubmission(client, 5);
  if (waiting.length === 0) return 0;

  let sent = 0;

  for (const article of waiting) {
    const input = toMessageInput(article);
    try {
      const message = await sendMessage(
        chatId,
        buildReviewMessage(input),
        reviewButtons(article.id),
      );
      await recordReviewSent(client, {
        articleId: article.id,
        chatId,
        messageId: message.message_id,
      });
      sent += 1;
      log.info('Članak poslat na odobrenje.', {
        clanak: article.id,
        naslov: article.title.slice(0, 60),
        razlog: article.sensitivity_reason?.slice(0, 60),
      });
    } catch (error) {
      const message = error instanceof TelegramError ? error.message : (error as Error).message;
      log.error('Slanje nije prošlo.', { clanak: article.id, greska: message });

      // Upisuje se i neuspeh, da se isti članak ne pokušava u svakom ciklusu.
      await recordReviewSent(client, {
        articleId: article.id,
        chatId,
        messageId: null,
        error: message.slice(0, 300),
      });

      if (error instanceof TelegramError && (error.kind === 'auth' || error.kind === 'chat')) break;
    }
  }

  return sent;
}

function toMessageInput(article: {
  id: string;
  title: string;
  lead: string;
  body: string;
  category: string;
  sensitivity_reason: string | null;
  word_count: number;
  model: string;
}): ReviewMessageInput {
  return {
    articleId: article.id,
    title: article.title,
    lead: article.lead,
    body: article.body,
    category: article.category,
    sensitivityReason: article.sensitivity_reason,
    wordCount: article.word_count,
    model: article.model,
  };
}

export type { ReviewRow };
