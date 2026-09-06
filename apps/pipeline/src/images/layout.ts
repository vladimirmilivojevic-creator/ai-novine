import { paletteFor, type Variant } from './palette.js';

/**
 * Raspored jedne naslovne slike, opisan kao stablo elemenata koje satori ume da
 * pretvori u SVG. Nema JSX-a — satori prima obična objekat-stabla, pa projekat
 * ostaje bez React zavisnosti.
 *
 * Format 1200×630 je ono što Facebook, X, Viber i Google očekuju za pregled
 * linka. Ista slika služi i kao naslovna na sajtu (Faza 9), pa se crta jednom.
 */

export const COVER_WIDTH = 1200;
export const COVER_HEIGHT = 630;

/** Traži ga brief, sekcija 8: čitalac mora znati da tekst nije pisao čovek. */
export const WATERMARK = 'Tekst generisala veštačka inteligencija · AI Novine';

export interface CoverInput {
  title: string;
  category: string;
  variant: Variant;
  /** Datum ispisan uz žig; podrazumevano se ne ispisuje. */
  dateLabel?: string;
}

interface Node {
  type: string;
  props: Record<string, unknown> & { children?: unknown };
}

function box(style: Record<string, unknown>, children?: unknown): Node {
  return { type: 'div', props: { style: { display: 'flex', ...style }, children } };
}

function text(content: string, style: Record<string, unknown>): Node {
  return { type: 'div', props: { style: { display: 'flex', ...style }, children: content } };
}

/**
 * Veličina slova prema dužini naslova.
 *
 * Satori ne ume da sam smanji tekst da stane, pa se veličina računa unapred.
 * Granice su izmerene na naslovima iz baze: 90% ih je između 40 i 95 znakova.
 */
export function titleFontSize(title: string): number {
  const length = title.length;
  if (length <= 42) return 70;
  if (length <= 62) return 62;
  if (length <= 85) return 54;
  if (length <= 115) return 46;
  return 40;
}

/**
 * Naslov duži od granice se seče na granici reči.
 *
 * Radije kraći naslov nego naslov koji izlazi iz slike: slika je najava, ceo
 * naslov stoji ispod nje na sajtu.
 */
export function fitTitle(title: string, limit = 150): string {
  const clean = title.replace(/\s+/g, ' ').trim();
  if (clean.length <= limit) return clean;

  const cut = clean.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,.;:–-]$/, '')}…`;
}

/**
 * Geometrija koja razlikuje tri varijacije. Sve tri koriste istu boju rubrike i
 * ostaju iza teksta, da kontrast naslova nikad ne padne.
 */
function geometry(variant: Variant, accent: string): Node[] {
  if (variant === 'traka') {
    return [
      box({
        position: 'absolute',
        right: -180,
        bottom: -260,
        width: 900,
        height: 420,
        backgroundColor: accent,
        opacity: 0.16,
        transform: 'rotate(-18deg)',
      }),
      box({
        position: 'absolute',
        right: -120,
        bottom: -320,
        width: 900,
        height: 420,
        backgroundColor: accent,
        opacity: 0.28,
        transform: 'rotate(-18deg)',
      }),
    ];
  }

  if (variant === 'mreza') {
    const dots: Node[] = [];
    for (let row = 0; row < 5; row += 1) {
      for (let column = 0; column < 7; column += 1) {
        dots.push(
          box({
            width: 14,
            height: 14,
            marginRight: 26,
            marginBottom: 26,
            backgroundColor: accent,
            opacity: 0.14 + row * 0.07 + column * 0.02,
          }),
        );
      }
    }
    return [
      box(
        {
          position: 'absolute',
          top: 148,
          right: 52,
          width: 300,
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
        },
        dots,
      ),
    ];
  }

  return [
    box({
      position: 'absolute',
      right: 0,
      top: 0,
      width: 260,
      height: COVER_HEIGHT,
      backgroundColor: accent,
      opacity: 0.12,
    }),
    box({
      position: 'absolute',
      right: 66,
      top: 150,
      width: 190,
      height: 190,
      backgroundColor: accent,
      opacity: 0.3,
    }),
    box({
      position: 'absolute',
      right: 0,
      bottom: 60,
      width: 320,
      height: 120,
      backgroundColor: accent,
      opacity: 0.2,
    }),
  ];
}

/** Celo stablo jedne slike. */
export function coverElement(input: CoverInput): Node {
  const palette = paletteFor(input.category);
  const title = fitTitle(input.title);

  return box(
    {
      width: COVER_WIDTH,
      height: COVER_HEIGHT,
      position: 'relative',
      flexDirection: 'column',
      backgroundColor: palette.ink,
      fontFamily: 'Inter',
      overflow: 'hidden',
    },
    [
      ...geometry(input.variant, palette.accent),

      box(
        {
          position: 'relative',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: COVER_WIDTH,
          height: COVER_HEIGHT,
          padding: 64,
        },
        [
          // Zaglavlje: znak lista levo, rubrika desno.
          box({ justifyContent: 'space-between', alignItems: 'center' }, [
            box({ alignItems: 'center' }, [
              box({
                width: 26,
                height: 26,
                marginRight: 16,
                backgroundColor: palette.accent,
              }),
              text('AI NOVINE', {
                color: '#FFFFFF',
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: 4,
              }),
            ]),
            text(palette.label, {
              color: palette.accent,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 3,
            }),
          ]),

          // Naslov sa trakom u boji rubrike iznad njega.
          box({ flexDirection: 'column', maxWidth: 880 }, [
            box({ width: 88, height: 8, marginBottom: 28, backgroundColor: palette.accent }),
            text(title, {
              color: '#FFFFFF',
              fontSize: titleFontSize(title),
              fontWeight: 700,
              lineHeight: 1.18,
            }),
          ]),

          // Podnožje: vodeni žig je deo slike, ne prekrivka koja se može skinuti.
          box({ flexDirection: 'column' }, [
            box({
              width: COVER_WIDTH - 128,
              height: 1,
              marginBottom: 20,
              backgroundColor: '#FFFFFF',
              opacity: 0.18,
            }),
            box({ justifyContent: 'space-between', alignItems: 'center' }, [
              text(WATERMARK, { color: '#C7CDD4', fontSize: 22 }),
              text(input.dateLabel ?? '', { color: '#8A939C', fontSize: 20 }),
            ]),
          ]),
        ],
      ),
    ],
  );
}
