import { gunzipSync } from 'node:zlib';
import { loadSourcesConfig } from './config.js';

export interface FetchOptions {
  /** Gornja granica cekanja na odgovor. Podrazumevano iz config/sources.json. */
  timeoutMs?: number;
  /** Najmanji razmak izmedju dva zahteva ka istom domenu. */
  minIntervalMs?: number;
  /** Vrednost `Accept` zaglavlja. */
  accept?: string;
  /** Preko koliko bajtova tela odgovora se odseca (odbrana od ogromnih strana). */
  maxBytes?: number;
}

export interface FetchResult {
  /** Finalni URL posle svih redirekcija. */
  url: string;
  status: number;
  ok: boolean;
  contentType: string | null;
  body: string;
  elapsedMs: number;
  /** Za uslovni GET u Fazi 2. */
  etag: string | null;
  lastModified: string | null;
}

export type FetchFailureKind = 'timeout' | 'network';

export class FetchFailure extends Error {
  constructor(
    message: string,
    readonly kind: FetchFailureKind,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'FetchFailure';
  }
}

const DEFAULT_MAX_BYTES = 3_000_000;

/**
 * Redosled zahteva po domenu. Svaki domen ima svoj lanac obecanja, pa dva
 * zahteva ka istom sajtu nikad ne krecu istovremeno, a sledeci ceka zadati
 * razmak posle prethodnog. Razliciti domeni idu paralelno.
 */
const hostChain = new Map<string, Promise<void>>();

async function withHostSlot<T>(host: string, minIntervalMs: number, run: () => Promise<T>) {
  const previous = hostChain.get(host) ?? Promise.resolve();

  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  hostChain.set(
    host,
    previous.then(() => current),
  );

  await previous;
  try {
    return await run();
  } finally {
    // Tajmer se namerno NE odjavljuje sa `unref()` — dok ceka razmak izmedju
    // dva zahteva ka istom domenu, on je jedino sto drzi proces zivim.
    setTimeout(release, minIntervalMs);
  }
}

/**
 * Dohvata URL uz pravila koja vaze za ceo projekat: korektan User-Agent (bez
 * glumljenja browsera), timeout, i najvise jedan zahtev u sekundi po domenu.
 */
export async function fetchText(url: string, options: FetchOptions = {}): Promise<FetchResult> {
  const defaults = loadSourcesConfig().defaults;
  const timeoutMs = options.timeoutMs ?? defaults.requestTimeoutMs;
  const minIntervalMs = options.minIntervalMs ?? 1000 / defaults.requestsPerSecondPerDomain;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const host = new URL(url).host;

  return withHostSlot(host, minIntervalMs, async () => {
    const startedAt = Date.now();
    let response: Response;

    try {
      response = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'user-agent': defaults.userAgent,
          accept: options.accept ?? '*/*',
          'accept-language': 'sr,sr-Latn;q=0.9,en;q=0.5',
        },
      });
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === 'TimeoutError';
      throw new FetchFailure(
        isTimeout ? `Isteklo vreme posle ${timeoutMs} ms` : `Mrezna greska: ${describe(error)}`,
        isTimeout ? 'timeout' : 'network',
        { cause: error },
      );
    }

    let body: string;
    try {
      body = decodeBody(new Uint8Array(await response.arrayBuffer()), response.headers);
    } catch (error) {
      throw new FetchFailure(`Ne mogu da procitam telo odgovora: ${describe(error)}`, 'network', {
        cause: error,
      });
    }

    return {
      url: response.url || url,
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get('content-type'),
      body: body.length > maxBytes ? body.slice(0, maxBytes) : body,
      elapsedMs: Date.now() - startedAt,
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
    };
  });
}

/**
 * Telo odgovora u tekst. Dve stvari koje `response.text()` sam ne resava:
 * sadrzaj sa `.gz` putanje stize spakovan (sajtovi tako serviraju sitemap-ove),
 * a poneki stariji srpski sajt jos uvek salje `windows-1250` umesto UTF-8.
 */
function decodeBody(bytes: Uint8Array, headers: Headers): string {
  const unpacked = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes;
  const charset = /charset=([^;\s]+)/i.exec(headers.get('content-type') ?? '')?.[1];

  if (charset && charset.toLowerCase() !== 'utf-8') {
    try {
      return new TextDecoder(charset).decode(unpacked);
    } catch {
      // Nepoznata oznaka kodiranja — nastavi sa UTF-8.
    }
  }
  return new TextDecoder('utf-8').decode(unpacked);
}

function describe(error: unknown): string {
  if (error instanceof Error) {
    const cause = error.cause;
    if (cause instanceof Error && cause.message !== error.message) {
      return `${error.message} (${cause.message})`;
    }
    return error.message;
  }
  return String(error);
}

/** Pokrece zadatke sa ogranicenim brojem istovremenih izvrsavanja. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await worker(items[index] as T, index);
    }
  });

  await Promise.all(runners);
  return results;
}
