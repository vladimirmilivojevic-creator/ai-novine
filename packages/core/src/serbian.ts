/**
 * Obrada srpskog teksta za klasterovanje (Engine 2).
 *
 * Ovde nema nijednog AI poziva. Grupisanje hiljadu dnevnih clanaka u teme radi
 * se leksicki, a model se poziva tek na temu koja prodje kapije kvaliteta —
 * to je najveca usteda u celom sistemu.
 *
 * Tri stvari koje srpski trazi, a engleske biblioteke ne rade:
 * 1. Isti tekst stize i cirilicom i latinicom (RTS pise cirilicom, Danas
 *    latinicom) — bez transliteracije to su dva razlicita teksta.
 * 2. Dijakritici se u praksi pisu i bez kvacica („Vučić" i „Vucic").
 * 3. Padezi menjaju kraj reci („Vučić", „Vučića", „Vučiću") — bez skracivanja
 *    na koren to su tri razlicite reci.
 */

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  ђ: 'đ',
  е: 'e',
  ж: 'ž',
  з: 'z',
  и: 'i',
  ј: 'j',
  к: 'k',
  л: 'l',
  љ: 'lj',
  м: 'm',
  н: 'n',
  њ: 'nj',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  ћ: 'ć',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'c',
  ч: 'č',
  џ: 'dž',
  ш: 'š',
  А: 'A',
  Б: 'B',
  В: 'V',
  Г: 'G',
  Д: 'D',
  Ђ: 'Đ',
  Е: 'E',
  Ж: 'Ž',
  З: 'Z',
  И: 'I',
  Ј: 'J',
  К: 'K',
  Л: 'L',
  Љ: 'Lj',
  М: 'M',
  Н: 'N',
  Њ: 'Nj',
  О: 'O',
  П: 'P',
  Р: 'R',
  С: 'S',
  Т: 'T',
  Ћ: 'Ć',
  У: 'U',
  Ф: 'F',
  Х: 'H',
  Ц: 'C',
  Ч: 'Č',
  Џ: 'Dž',
  Ш: 'Š',
};

const DIACRITIC_TO_ASCII: Record<string, string> = {
  č: 'c',
  ć: 'c',
  ž: 'z',
  š: 's',
  đ: 'dj',
  Č: 'C',
  Ć: 'C',
  Ž: 'Z',
  Š: 'S',
  Đ: 'Dj',
};

/** Ćirilica u latinicu, znak po znak. Latinični tekst prolazi nepromenjen. */
export function toLatin(text: string): string {
  let out = '';
  for (const char of text) out += CYRILLIC_TO_LATIN[char] ?? char;
  return out;
}

/** Latinica sa kvačicama u golu ASCII latinicu: „Vučić" → „vucic". */
export function foldDiacritics(text: string): string {
  let out = '';
  for (const char of text) out += DIACRITIC_TO_ASCII[char] ?? char;
  return out;
}

/** Zajednički oblik za poređenje: latinica, bez kvačica, mala slova. */
export function normalizeForMatching(text: string): string {
  return foldDiacritics(toLatin(text)).toLowerCase();
}

/**
 * Reči koje se pojavljuju u skoro svakoj vesti, pa ne govore ništa o temi.
 * Uz veznike i predloge tu su i novinarske fraze („izjavio", „saopštio"),
 * jer se javljaju u svakom tekstu bez obzira na temu.
 */
export const STOP_WORDS = new Set(
  [
    // veznici, predlozi, zamenice, pomoćni glagoli
    'a',
    'ako',
    'ali',
    'bez',
    'bi',
    'bih',
    'bila',
    'bili',
    'bilo',
    'bio',
    'biti',
    'biće',
    'ce',
    'cemo',
    'ces',
    'cu',
    'da',
    'do',
    'dok',
    'dr',
    'ga',
    'god',
    'i',
    'iako',
    'ih',
    'ili',
    'im',
    'ima',
    'imaju',
    'imao',
    'iz',
    'ja',
    'je',
    'jedan',
    'jedna',
    'jedno',
    'jer',
    'jos',
    'ju',
    'kad',
    'kada',
    'kako',
    'kao',
    'koja',
    'koje',
    'koji',
    'kojih',
    'kojim',
    'kojoj',
    'koju',
    'kroz',
    'li',
    'me',
    'mi',
    'mogu',
    'moze',
    'my',
    'na',
    'nad',
    'nakon',
    'nas',
    'nasa',
    'ne',
    'nego',
    'nekoliko',
    'nema',
    'nesto',
    'ni',
    'nije',
    'nisu',
    'njega',
    'njegov',
    'njen',
    'nju',
    'no',
    'o',
    'od',
    'ona',
    'onda',
    'oni',
    'ono',
    'osim',
    'ova',
    'ovaj',
    'ove',
    'ovo',
    'pa',
    'po',
    'pod',
    'pored',
    'posle',
    'pre',
    'preko',
    'prema',
    'pri',
    'protiv',
    'sa',
    'sam',
    'samo',
    'se',
    'si',
    'smo',
    'ste',
    'su',
    'sve',
    'svi',
    'svoj',
    'ta',
    'taj',
    'tako',
    'te',
    'tim',
    'to',
    'toga',
    'tom',
    'tu',
    'u',
    'uz',
    'vec',
    'vise',
    'za',
    'zbog',
    'ako',
    'sto',
    'sta',
    'ko',
    'gde',
    'kome',
    'cega',
    'cemu',
    'jedne',
    'jednog',
    // novinarske fraze bez tematske težine
    'izjavio',
    'izjavila',
    'rekao',
    'rekla',
    'kaze',
    'saopstio',
    'saopsteno',
    'navodi',
    'naveo',
    'dodao',
    'istakao',
    'poruka',
    'agencija',
    'portal',
    'redakcija',
    'foto',
    'video',
    'danas',
    'juce',
    'sutra',
    'godine',
    'godina',
    'sati',
    'sata',
    'casova',
    'prenosi',
    'objavljeno',
    'komentar',
    'komentara',
    'vest',
    'vesti',
    'tekst',
  ].map(normalizeForMatching),
);

/**
 * Padežni i množinski nastavci, od dužih ka kraćim. Skida se najduži koji
 * odgovara, i to samo ako koren posle toga ostane dovoljno dug.
 */
const SUFFIXES = [
  'ovima',
  'evima',
  'ijama',
  'icama',
  'ovom',
  'evom',
  'ovim',
  'evim',
  'ama',
  'ima',
  'oga',
  'ome',
  'omu',
  'ovi',
  'evi',
  'iju',
  'ovo',
  'evo',
  'ova',
  'eva',
  'ovu',
  'evu',
  'ih',
  'im',
  'em',
  'om',
  'og',
  'ju',
  'a',
  'e',
  'i',
  'o',
  'u',
].sort((a, b) => b.length - a.length);

/**
 * Svođenje reči na koren skidanjem nastavka.
 *
 * U srpskom padež menja kraj reči, pa „Vučića", „Vučiću", „Vučićem" i
 * „Vučićevo" treba da daju isti token. Fiksno sečenje na prvih N znakova to ne
 * postiže — razlika je baš na kraju. Skidanje nastavka jeste, a pritom ne spaja
 * nepovezane reči („predsednik" i „predstavnik" ostaju različiti, jer se ne
 * završavaju nastavkom).
 *
 * Ovo nije pravi stemmer za srpski; to bi bila mnogo veća stvar. Za grupisanje
 * vesti je dovoljno, a greške idu ka spajanju srodnih reči, ne ka spajanju
 * nepovezanih tema.
 */
export function stem(word: string, minStemLength = 4): string {
  for (const suffix of SUFFIXES) {
    if (word.endsWith(suffix) && word.length - suffix.length >= minStemLength) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}

export interface TokenizeOptions {
  /** Najkraća reč koja se uzima u obzir. */
  minWordLength?: number;
  /** Najkraći koren koji sme da ostane posle skidanja nastavka. */
  minStemLength?: number;
  /** Da li izbaciti stop-reči. */
  dropStopWords?: boolean;
}

/** Tekst u niz korena spremnih za poređenje. */
export function tokenize(text: string, options: TokenizeOptions = {}): string[] {
  const minLength = options.minWordLength ?? 3;
  const minStemLength = options.minStemLength ?? 4;
  const dropStopWords = options.dropStopWords ?? true;

  const normalized = normalizeForMatching(text);
  const tokens: string[] = [];

  for (const word of normalized.split(/[^a-z0-9]+/)) {
    if (word.length < minLength) continue;
    if (dropStopWords && STOP_WORDS.has(word)) continue;
    // Goli brojevi ne nose temu, osim godina i većih brojeva iz vesti.
    if (/^\d+$/.test(word) && word.length < 4) continue;
    tokens.push(stem(word, minStemLength));
  }
  return tokens;
}

/**
 * Imena i nazivi — reči koje počinju velikim slovom usred rečenice, uzete u
 * nizu („Aleksandar Vučić", „Narodna skupština"). Ovo nije pravo prepoznavanje
 * entiteta, ali za srpske vesti radi posao: dve vesti o istom događaju gotovo
 * uvek dele bar jedno ime.
 */
export function extractEntities(text: string, maxEntities = 25): string[] {
  const latin = toLatin(text);
  const counts = new Map<string, number>();

  // Rečenica počinje velikim slovom, pa se prva reč rečenice preskače.
  const sentences = latin.split(/(?<=[.!?])\s+|\n+/);

  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/);
    let run: string[] = [];

    for (let index = 0; index < words.length; index += 1) {
      const word = (words[index] ?? '').replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
      const isCapitalized = /^\p{Lu}\p{L}{2,}/u.test(word);

      if (isCapitalized && index > 0) {
        run.push(word);
        continue;
      }

      if (run.length > 0) {
        addEntity(counts, run);
        run = [];
      }
    }
    if (run.length > 0) addEntity(counts, run);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, maxEntities)
    .map(([entity]) => entity);
}

function addEntity(counts: Map<string, number>, run: string[]): void {
  const entity = run.join(' ');
  const key = normalizeForMatching(entity);
  if (key.length < 4) return;
  if (STOP_WORDS.has(key)) return;
  counts.set(entity, (counts.get(entity) ?? 0) + 1);
}

/**
 * „Pregled dana" — jedan tekst koji pokriva više NEPOVEZANIH događaja, prepoznat
 * po tački-zarezu koji razdvaja dve samostalne izjave:
 * „ИРГЦ: Погодили смо носач авиона; владине снаге напале Хуте у Јемену".
 *
 * Takav tekst se izostavlja iz grupisanja. Ne zato što nije vest, nego zato što
 * pripada u tri teme odjednom: kao član podiže broj izvora teme na koju se samo
 * delom odnosi, a u Fazi 5 bi model dobio izvorni tekst koji je pola o nečem
 * drugom.
 */
export function isMultiEventTitle(title: string): boolean {
  const parts = title.split(';').map((part) => part.trim());
  return parts.length > 1 && parts.every((part) => part.split(/\s+/).length >= 4);
}

/**
 * Uživo blog ili minut-po-minut praćenje. Za razliku od pregleda dana, ovo je
 * po pravilu jedan događaj, pa tekst OSTAJE u temi — samo ne sme da bude naslov
 * teme, jer „UŽIVO: Izbori u Srbiji" ne kaže šta se u temi dogodilo.
 */
export function isLiveBlogTitle(title: string): boolean {
  const normalized = normalizeForMatching(title);
  return /\buzivo\b|\bblog\b|\blive\b|minut po minut|sta se desava/.test(normalized);
}

/** Naslov koji ne opisuje jedan događaj, pa ne može da predstavlja temu. */
export function isUnsuitableTopicTitle(title: string): boolean {
  return isMultiEventTitle(title) || isLiveBlogTitle(title);
}
