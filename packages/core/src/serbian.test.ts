import { describe, expect, it } from 'vitest';
import {
  extractEntities,
  foldDiacritics,
  normalizeForMatching,
  stem,
  STOP_WORDS,
  tokenize,
  toLatin,
} from './serbian.js';

describe('toLatin', () => {
  it('prevodi ćirilicu u latinicu, uključujući dvoslove', () => {
    expect(toLatin('Александар Вучић')).toBe('Aleksandar Vučić');
    expect(toLatin('Љубав и џеп њему')).toBe('Ljubav i džep njemu');
  });

  it('ne dira tekst koji je već latinica', () => {
    expect(toLatin('Vlada Srbije, 2026.')).toBe('Vlada Srbije, 2026.');
  });
});

describe('foldDiacritics', () => {
  it('skida kvačice, a đ prevodi u dj', () => {
    expect(foldDiacritics('Đorđe čačak žito šuma ćuk')).toBe('Djordje cacak zito suma cuk');
  });
});

describe('normalizeForMatching', () => {
  it('svodi ćirilicu, latinicu sa kvačicama i latinicu bez kvačica na isti oblik', () => {
    const oblici = ['Вучић', 'Vučić', 'Vucic', 'VUČIĆ'].map(normalizeForMatching);
    expect(new Set(oblici).size).toBe(1);
    expect(oblici[0]).toBe('vucic');
  });
});

describe('stem', () => {
  it('svodi padeže iste reči na isti koren', () => {
    const oblici = ['vucica', 'vucicu', 'vucicem', 'vucicevo'].map((w) => stem(w));
    expect(new Set(oblici).size).toBe(1);
  });

  it('ne spaja reči koje se ne završavaju nastavkom', () => {
    expect(stem('predsednik')).toBe('predsednik');
    expect(stem('predstavnik')).toBe('predstavnik');
  });

  it('ne skida nastavak ako bi koren ostao prekratak', () => {
    expect(stem('oko')).toBe('oko');
  });
});

describe('tokenize', () => {
  it('daje iste tokene za ćirilični i latinični zapis iste rečenice', () => {
    const cir = tokenize('Влада Србије усвојила буџет за наредну годину');
    const lat = tokenize('Vlada Srbije usvojila budžet za narednu godinu');
    expect(cir).toEqual(lat);
  });

  it('izbacuje stop-reči i prekratke reči', () => {
    const tokens = tokenize('Vlada je danas i za sve to usvojila budžet');
    expect(tokens).not.toContain('danas');
    expect(tokens).not.toContain('za');
    expect(tokens).toContain(stem('vlada'));
    expect(tokens).toContain(stem('usvojila'));
  });

  it('zadržava godine, a odbacuje sitne brojeve', () => {
    const tokens = tokenize('U 2026. godini poginulo je 20 ljudi');
    expect(tokens).toContain('2026');
    expect(tokens).not.toContain('20');
  });

  it('stop-reči su zapisane u istom obliku u kom se i porede', () => {
    for (const word of STOP_WORDS) expect(normalizeForMatching(word)).toBe(word);
  });
});

describe('extractEntities', () => {
  it('hvata imena i nazive iz sredine rečenice', () => {
    const entities = extractEntities(
      'Predsednik Aleksandar Vučić sastao se sa premijerkom. Sednicu je otvorila Narodna skupština.',
    );
    expect(entities).toContain('Aleksandar Vučić');
    // Institucija se hvata samo dokle ide veliko slovo — „skupština" je malim.
    expect(entities).toContain('Narodna');
  });

  it('preskače prvu reč rečenice, jer je veliko slovo tu pravopis a ne ime', () => {
    expect(extractEntities('Vlada je usvojila budžet.')).not.toContain('Vlada');
  });

  it('radi i na ćiriličnom tekstu, uz prevod u latinicu', () => {
    const entities = extractEntities('Данас је председник Александар Вучић отворио седницу.');
    expect(entities).toContain('Александар Вучић'.replace(/./g, (c) => toLatin(c)));
  });

  it('ne vraća ništa kad imena nema', () => {
    expect(extractEntities('vlada je usvojila budzet za narednu godinu')).toEqual([]);
  });
});
