import { createHash } from 'node:crypto';
import { serbianWallClockToIso } from '@ai-novine/core';

/**
 * Parametri koji ne menjaju sadrzaj strane, samo prate odakle je posetilac
 * dosao. Isti clanak deljen sa Facebook-a i iz newsletter-a ima razlicit URL
 * samo zbog njih — zato lete pre racunanja hesa.
 */
const TRACKING_PARAMS =
  /^(utm_|fbclid$|gclid$|gbraid$|wbraid$|yclid$|msclkid$|igshid$|mc_|_ga$|ref$|ref_src$|source$|src$)/i;

/**
 * Svodi URL na oblik koji jednoznacno pokazuje na clanak: bez pracecih
 * parametara, bez fragmenta, bez `www.`, bez zavrsne kose crte, mala slova u
 * imenu domena. Vraca `null` ako URL nije upotrebljiv.
 */
export function canonicalizeUrl(raw: string, base?: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim(), base);
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  url.hash = '';
  url.username = '';
  url.password = '';
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');

  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();

  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '');
  }

  return url.toString();
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function urlHash(canonicalUrl: string): string {
  return sha256(canonicalUrl.toLowerCase());
}

/**
 * Otisak sadrzaja: naslov i tekst svedeni na mala slova i jedan razmak.
 * Isti tekst objavljen na dva URL-a daje isti hes.
 */
export function contentHash(title: string, text: string): string {
  const normalized = normalizeWhitespace(`${title}\n${text}`)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '');
  return sha256(normalized);
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Skida HTML iz kratkih opisa koje feed-ovi cesto daju sa markupom. */
export function stripHtml(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>'),
  );
}

export function countWords(text: string): number {
  const trimmed = normalizeWhitespace(text);
  return trimmed ? trimmed.split(' ').length : 0;
}

/** Datum iz feeda u ISO oblik; `null` ako ga nema ili je neupotrebljiv. */
export function toIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  // Datum iz buducnosti je greska u feedu, ne vest.
  if (date.getTime() > Date.now() + 24 * 3600_000) return null;
  return date.toISOString();
}

/**
 * Datum u srpskom zapisu — `6.9.2026.` ili `06.09.2026, 09:07`.
 *
 * Poneki portal (RTS, na primer) nema nijednu masinski citljivu oznaku datuma,
 * pa je vidljivi datum na strani jedino sto postoji.
 *
 * Vreme se ODUVEK cita kao beogradsko, bez obzira gde kod radi. Bez toga bi
 * isti clanak dobio jedno vreme na razvojnom racunaru (Europe/Belgrade), a
 * drugo na GitHub Actions i Vercel serverima (UTC) — razlika od sat ili dva.
 *
 * Prihvata se samo datum iz poslednjih 30 dana i ne iz buducnosti, da se ne
 * uhvati datum iz teksta clanka ili iz podnozja strane.
 */
export function parseSerbianDate(text: string, now = Date.now()): string | null {
  const pattern = /(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})\.?(?:[\s,]+(\d{1,2}):(\d{2}))?/g;

  for (const match of text.matchAll(pattern)) {
    const [, day, month, year, hour, minute] = match;

    const iso = serbianWallClockToIso({
      year: Number(year),
      month: Number(month),
      day: Number(day),
      // Bez vremena uzima se podne, da greska u oba smera bude najmanja.
      hour: hour ? Number(hour) : 12,
      minute: minute ? Number(minute) : 0,
    });
    if (!iso) continue;

    const age = now - new Date(iso).getTime();
    if (age < -86_400_000 || age > 30 * 86_400_000) continue;
    return iso;
  }
  return null;
}
