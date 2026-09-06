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
  body: z
    .string()
    .describe(
      'Telo članka, tri do sedam pasusa razdvojenih praznim redom. Običan tekst, bez markdown naslova i HTML-a. Ne ponavlja uvod.',
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
