import robotsParser from 'robots-parser';
import { loadSourcesConfig } from './config.js';
import { fetchText, FetchFailure } from './http.js';

export type RobotsState =
  | { kind: 'ok'; crawlDelaySeconds: number | null }
  | { kind: 'missing' }
  | { kind: 'blocked'; status: number }
  | { kind: 'error'; message: string };

export interface RobotsInfo {
  origin: string;
  state: RobotsState;
  isAllowed(url: string): boolean;
  sitemaps: string[];
}

const cache = new Map<string, Promise<RobotsInfo>>();

/**
 * Ucitava i kesira `robots.txt` za jedan origin.
 *
 * Ako sam `robots.txt` vrati 403 (sto rade sajtovi iza Cloudflare zastite),
 * to tretiramo kao izricitu zabranu — takav sajt se ne dohvata dalje. Ako
 * `robots.txt` ne postoji (404), sve je dozvoljeno, kako standard i kaze.
 */
export function loadRobots(url: string): Promise<RobotsInfo> {
  const origin = new URL(url).origin;
  const cached = cache.get(origin);
  if (cached) return cached;

  const pending = fetchRobots(origin);
  cache.set(origin, pending);
  return pending;
}

async function fetchRobots(origin: string): Promise<RobotsInfo> {
  const robotsUrl = `${origin}/robots.txt`;
  const userAgent = loadSourcesConfig().defaults.userAgent;

  let response;
  try {
    response = await fetchText(robotsUrl, { accept: 'text/plain', maxBytes: 500_000 });
  } catch (error) {
    const message = error instanceof FetchFailure ? error.message : String(error);
    // Bez robots.txt ne znamo pravila; ne dohvatamo dalje, ali ni ne tvrdimo da je zabrana.
    return { origin, state: { kind: 'error', message }, isAllowed: () => false, sitemaps: [] };
  }

  if (response.status === 404 || response.status === 410) {
    return { origin, state: { kind: 'missing' }, isAllowed: () => true, sitemaps: [] };
  }

  if (!response.ok) {
    return {
      origin,
      state: { kind: 'blocked', status: response.status },
      isAllowed: () => false,
      sitemaps: [],
    };
  }

  const parsed = robotsParser(robotsUrl, response.body);

  return {
    origin,
    state: { kind: 'ok', crawlDelaySeconds: parsed.getCrawlDelay(userAgent) ?? null },
    isAllowed: (target: string) => parsed.isAllowed(target, userAgent) !== false,
    sitemaps: parsed.getSitemaps(),
  };
}

/** Prazni kes — koristi se u testovima. */
export function resetRobotsCache(): void {
  cache.clear();
}
