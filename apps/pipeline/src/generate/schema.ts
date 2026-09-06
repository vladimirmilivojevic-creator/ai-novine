import { z } from 'zod';

/**
 * Oblik odgovora modela. Opisi polja idu modelu kao deo šeme, pa su i oni deo
 * uredničkih pravila — piše se isto što i u `config/editorial-prompt.md`, samo
 * kraće i na mestu gde model odlučuje šta u koje polje ide.
 */

export const CATEGORY_VALUES = [
  'politika',
  'ekonomija',
  'drustvo',
  'sport',
  'region',
  'svet',
] as const;

/**
 * Šema drži samo STRUKTURU — da telo nije jedna rečenica i da pasusi nisu
 * jednorečenične crtice. Pravo pravilo je ukupna dužina članka od 350 reči
 * (brief, sekcija 9), i ono se proverava u kodu posle odgovora: tvrda granica
 * po svakom pasusu se pokazala prekrutom, jer Haiku ume da promaši jedan pasus
 * za dvadesetak znakova i time izgubi ceo članak.
 */
export const MIN_PARAGRAPHS = 4;
export const MAX_PARAGRAPHS = 9;
export const MIN_PARAGRAPH_CHARS = 200;

export const bothSidesSchema = z.object({
  officialLabel: z
    .string()
    .describe('Generička oznaka prvog ugla, npr. „Zvanični ugao". Nikad ime medija.'),
  officialText: z.string().describe('Dve do četiri rečenice: kako događaj izgleda iz tog ugla.'),
  criticalLabel: z
    .string()
    .describe('Generička oznaka drugog ugla, npr. „Kritički ugao". Nikad ime medija.'),
  criticalText: z.string().describe('Dve do četiri rečenice: kako događaj izgleda iz drugog ugla.'),
});

export const articleSchema = z.object({
  title: z
    .string()
    .describe(
      'Naslov članka na srpskom, latinicom, do 90 znakova. Bez uzvičnika i velikih slova usred rečenice.',
    ),
  lead: z
    .string()
    .describe('Uvodni pasus od dve do tri rečenice: šta, ko, kada i gde. Bez naslova u sebi.'),
  /**
   * Telo se traži kao NIZ pasusa sa najmanjom dužinom svakog, a ne kao jedan
   * tekst. Razlog je merenje: uz tekstualnu instrukciju „piši između 350 i 900
   * reči" Haiku 4.5 je vraćao članke od 99 do 302 reči. Šema je obavezujuća —
   * odgovor koji je ne ispuni nije validan, pa se traži ispravka.
   */
  body: z
    .array(z.string().min(MIN_PARAGRAPH_CHARS))
    .min(MIN_PARAGRAPHS)
    .max(MAX_PARAGRAPHS)
    .describe(
      `Pasusi tela članka: najmanje ${MIN_PARAGRAPHS}, najviše ${MAX_PARAGRAPHS}, svaki najmanje ` +
        `${MIN_PARAGRAPH_CHARS} znakova. Svaki pasus je jedna misao i obična rečenica — bez markdown ` +
        'naslova, bez crtica na početku, bez HTML-a. Ne ponavljaj uvod.',
    ),
  category: z.enum(CATEGORY_VALUES).describe('Tačno jedna kategorija.'),
  sensitive: z
    .boolean()
    .describe(
      'true ako se članak bavi krivičnim postupkom, imenovanom optužbom, tragedijom sa žrtvama, sudskim postupkom, zdravljem imenovane osobe ili maloletnicima.',
    ),
  sensitivityReason: z
    .string()
    .nullable()
    .describe('Kratko obrazloženje zašto je članak osetljiv; null kada nije.'),
  sourcesDiverge: z
    .boolean()
    .describe(
      'true samo kada se izveštaji stvarno razilaze u TUMAČENJU istog događaja. Razlika u broju ili datumu nije razilaženje u tumačenju.',
    ),
  bothSides: bothSidesSchema
    .nullable()
    .describe('Popunjeno samo kada je sourcesDiverge true; inače null.'),
  keywords: z
    .array(z.string())
    .describe('Tri do osam ključnih reči ili imena iz članka, na srpskom, latinicom.'),
  notes: z
    .array(z.string())
    .describe(
      'Napomene za uredništvo: gde je primenjena ograda zbog neslaganja u brojevima, šta nije bilo moguće potvrditi, zašto je članak kraći od 350 reči. Prazan niz kada nema šta da se javi.',
    ),
});

export type GeneratedArticle = z.infer<typeof articleSchema>;
export type BothSides = z.infer<typeof bothSidesSchema>;

/** Pasusi u jedan tekst, onako kako se čuva u bazi i prikazuje na sajtu. */
export function paragraphsToText(paragraphs: string[]): string {
  return paragraphs.join('\n\n');
}
