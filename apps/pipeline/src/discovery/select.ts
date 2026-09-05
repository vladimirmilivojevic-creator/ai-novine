import type { FeedCandidate, SourceReport } from './probe.js';

export const MAX_FEEDS_PER_SOURCE = 5;

/**
 * Bira koje feed-ove upisati u `config/sources.json`.
 *
 * Portali tipa Kurira i Monda nude po dvadesetak feed-ova — jedan glavni i po
 * jedan za svaku rubriku. Sve njih dohvatati znaci dvadeset puta veci saobracaj
 * ka istom sajtu za skoro isti sadrzaj. Zato: prvo najplici URL (to je gotovo
 * uvek glavni feed), pa oni sa najvise stavki, i najvise pet ukupno.
 */
export function pickFeedsForConfig(
  report: SourceReport,
  limit = MAX_FEEDS_PER_SOURCE,
): FeedCandidate[] {
  return [...report.feeds]
    .filter((feed) => feed.itemCount > 0 && !isCommentFeed(feed.finalUrl))
    .sort((a, b) => pathDepth(a.finalUrl) - pathDepth(b.finalUrl) || b.itemCount - a.itemCount)
    .slice(0, limit);
}

/**
 * WordPress uz svaki sajt nudi i feed komentara. To su komentari citalaca, ne
 * vesti — u njemu nema ni naslova ni teksta clanka.
 */
export function isCommentFeed(url: string): boolean {
  return /\/comments\/feed|comments-feed|\/feed\/comments/i.test(url);
}

function pathDepth(url: string): number {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}
