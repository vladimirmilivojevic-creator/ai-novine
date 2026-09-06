import type { InlineButton } from './client.js';

/**
 * Sastavljanje poruke koju vlasnik dobija na telefon.
 *
 * Poruka mora da stane u jedan ekran i da sadrži tačno ono što je potrebno za
 * odluku: zašto je članak označen kao osetljiv, kako glasi, i dva dugmeta.
 * Ako je predugačak, seče se — puni tekst je u bazi, a ovde se odlučuje.
 */

/** Telegram dozvoljava 4096 znakova po poruci; ostavlja se prostora za zaglavlje. */
export const MAX_MESSAGE_CHARS = 3500;

/**
 * HTML se u Telegram porukama koristi za podebljan tekst, pa znakovi `<`, `>` i
 * `&` iz naslova moraju da se zamene — inače Telegram odbije celu poruku.
 */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface ReviewMessageInput {
  articleId: string;
  title: string;
  lead: string;
  body: string;
  category: string;
  sensitivityReason: string | null;
  wordCount: number;
  model: string;
  sourceCount?: number;
}

export function buildReviewMessage(article: ReviewMessageInput): string {
  const parts: string[] = [];

  parts.push('⚠️ <b>Osetljiv članak — čeka odobrenje</b>');
  parts.push('');
  parts.push(`<b>${escapeHtml(article.title)}</b>`);
  parts.push('');
  parts.push(escapeHtml(article.lead));
  parts.push('');

  const remaining = MAX_MESSAGE_CHARS - parts.join('\n').length;
  const body = escapeHtml(trimToLength(article.body, Math.max(300, remaining)));
  parts.push(body);
  parts.push('');
  parts.push('———');
  parts.push(`Razlog: ${escapeHtml(article.sensitivityReason ?? 'nije naveden')}`);
  parts.push(
    `Rubrika: ${article.category} · ${article.wordCount} reči · model: ${article.model}` +
      (article.sourceCount ? ` · izvora: ${article.sourceCount}` : ''),
  );
  parts.push('');
  // Bez ovog objašnjenja izgleda kao da dugme ne radi: „sat" na dugmetu nestaje
  // tek kad pipeline pokupi odgovor, a to je u sledećem ciklusu.
  parts.push(
    '<i>Dugme će se nakratko vrteti — to je normalno. Odluka se upisuje kad pipeline ' +
      'sledeći put pokupi odgovore. Dovoljno je pritisnuti jednom.</i>',
  );

  return parts.join('\n');
}

/** Seče tekst na granici rečenice, da poruka ne prestane usred reči. */
export function trimToLength(text: string, limit: number): string {
  if (text.length <= limit) return text;

  const cut = text.slice(0, limit);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n'));
  const trimmed = lastStop > limit * 0.5 ? cut.slice(0, lastStop + 1) : cut;
  return `${trimmed.trimEnd()}\n\n[…tekst je skraćen za poruku; ceo je u bazi]`;
}

export const APPROVE_PREFIX = 'odobri';
export const REJECT_PREFIX = 'odbij';

/**
 * Podaci koje dugme nosi. Telegram dozvoljava 64 bajta, a `odobri:` plus
 * identifikator članka staje u 43.
 */
export function reviewButtons(articleId: string): InlineButton[][] {
  return [
    [
      { text: '✅ Odobri', callback_data: `${APPROVE_PREFIX}:${articleId}` },
      { text: '❌ Odbij', callback_data: `${REJECT_PREFIX}:${articleId}` },
    ],
  ];
}

export type ReviewDecision = 'approved' | 'rejected';

export interface ParsedCallback {
  decision: ReviewDecision;
  articleId: string;
}

/** Čita šta je pritisnuto. Vraća `null` za sve što nije naše dugme. */
export function parseCallbackData(data: string | undefined): ParsedCallback | null {
  if (!data) return null;

  const [prefix, articleId] = data.split(':');
  if (!articleId) return null;

  if (prefix === APPROVE_PREFIX) return { decision: 'approved', articleId };
  if (prefix === REJECT_PREFIX) return { decision: 'rejected', articleId };
  return null;
}

/** Tekst koji zamenjuje poruku pošto je odluka doneta. */
export function decidedMessage(
  original: ReviewMessageInput,
  decision: ReviewDecision | 'expired',
  when = new Date(),
): string {
  const stamp = when.toLocaleString('sr-RS', { timeZone: 'Europe/Belgrade', hour12: false });

  const heading =
    decision === 'approved'
      ? '✅ <b>Odobreno i objavljeno</b>'
      : decision === 'rejected'
        ? '❌ <b>Odbijeno — ostaje neobjavljeno</b>'
        : '⏳ <b>Isteklo bez odgovora — ostaje kao nacrt</b>';

  return [
    heading,
    '',
    `<b>${escapeHtml(original.title)}</b>`,
    '',
    escapeHtml(original.lead),
    '',
    '———',
    `${stamp} · rubrika: ${original.category} · ${original.wordCount} reči`,
  ].join('\n');
}
