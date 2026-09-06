import { createLogger, requireEnv } from '@ai-novine/core';

const log = createLogger('telegram');

/**
 * Telegram Bot API — samo ono što nam treba za odobravanje članaka.
 *
 * Namerno bez biblioteke: koriste se četiri poziva, svi obični HTTP zahtevi.
 * Biblioteka bi donela zavisnost, svoje verzije i svoje greške, a ne bi uštedela
 * više od stotinak linija.
 *
 * Radi **bez javne adrese**. Telegram nudi dva načina da bot sazna za odgovor:
 * webhook (traži javni URL, koji sajt dobija tek u Fazi 11) i `getUpdates`
 * (bot sam pita ima li nečeg novog). Ovde se koristi `getUpdates`, pa
 * odobravanje radi već sada, sa zakašnjenjem od jednog ciklusa.
 */

const API_BASE = 'https://api.telegram.org';

export class TelegramError extends Error {
  constructor(
    message: string,
    readonly kind: 'auth' | 'chat' | 'network' | 'api',
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'TelegramError';
  }
}

interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

async function call<T>(method: string, payload?: Record<string, unknown>): Promise<T> {
  const token = requireEnv('TELEGRAM_BOT_TOKEN');

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload ?? {}),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new TelegramError(`Nema veze sa Telegramom: ${(error as Error).message}`, 'network', {
      cause: error,
    });
  }

  const body = (await response.json()) as TelegramResponse<T>;

  if (!body.ok) {
    const description = body.description ?? `HTTP ${response.status}`;
    if (body.error_code === 401) {
      throw new TelegramError('Telegram je odbio token bota (401).', 'auth');
    }
    // Najčešća greška u praksi: vlasnik nikad nije napisao botu, pa bot ne sme
    // prvi da mu piše. Telegram to zove „chat not found".
    if (/chat not found|bot can't initiate/i.test(description)) {
      throw new TelegramError(
        'Bot ne može da piše u taj chat. Otvori Telegram, nađi bota i pošalji mu bilo koju ' +
          'poruku (npr. /start) — dok mu se ne obratiš prvi, ne sme da ti šalje poruke.',
        'chat',
      );
    }
    throw new TelegramError(`Telegram greška: ${description}`, 'api');
  }

  return body.result as T;
}

export interface SentMessage {
  message_id: number;
  chat: { id: number };
}

export interface InlineButton {
  text: string;
  callback_data: string;
}

export async function sendMessage(
  chatId: string,
  text: string,
  buttons?: InlineButton[][],
): Promise<SentMessage> {
  return call<SentMessage>('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
  });
}

/** Menja tekst već poslate poruke — koristi se da se posle odluke sklone dugmad. */
export async function editMessageText(
  chatId: string,
  messageId: number,
  text: string,
): Promise<void> {
  try {
    await call('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
  } catch (error) {
    // Neuspela izmena poruke ne sme da obori obradu odluke — odluka je već doneta.
    log.warn('Izmena poruke nije prošla.', { greska: (error as Error).message });
  }
}

export interface CallbackQuery {
  id: string;
  from: { id: number; username?: string; first_name?: string };
  message?: { message_id: number; chat: { id: number } };
  data?: string;
}

export interface Update {
  update_id: number;
  callback_query?: CallbackQuery;
  message?: { text?: string; chat: { id: number } };
}

/**
 * Čita nove poruke i pritiske dugmadi.
 *
 * `offset` je obavezan: Telegram čuva poruke dok se ne potvrdi da su pročitane,
 * pa bi bez pomeraja isti pritisak dugmeta bio obrađen u svakom ciklusu.
 */
export async function getUpdates(offset: number, timeoutSeconds = 0): Promise<Update[]> {
  return call<Update[]>('getUpdates', {
    offset,
    timeout: timeoutSeconds,
    allowed_updates: ['callback_query', 'message'],
  });
}

/** Sklanja „sat" sa dugmeta i po želji ispisuje kratku poruku korisniku. */
export async function answerCallbackQuery(callbackId: string, text?: string): Promise<void> {
  try {
    await call('answerCallbackQuery', {
      callback_query_id: callbackId,
      ...(text ? { text, show_alert: false } : {}),
    });
  } catch (error) {
    log.warn('Potvrda pritiska dugmeta nije prošla.', { greska: (error as Error).message });
  }
}

/** Podaci o botu — koristi se u proveri okruženja. */
export async function getMe(): Promise<{ id: number; username: string }> {
  return call<{ id: number; username: string }>('getMe');
}
