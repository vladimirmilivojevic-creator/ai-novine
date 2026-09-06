import { describe, expect, it } from 'vitest';
import {
  APPROVE_PREFIX,
  buildReviewMessage,
  decidedMessage,
  escapeHtml,
  MAX_MESSAGE_CHARS,
  parseCallbackData,
  REJECT_PREFIX,
  reviewButtons,
  trimToLength,
  type ReviewMessageInput,
} from './format.js';

const ARTICLE: ReviewMessageInput = {
  articleId: '487e9baa-2ece-414d-82ae-c5e6e5b5056e',
  title: 'M. J. (34) osumnjičen za tešku krađu u centru grada',
  lead: 'Policija je saopštila da je uhapšen muškarac osumnjičen za provalu u juvelirnicu.',
  body: 'Prvi pasus teksta.\n\nDrugi pasus teksta.',
  category: 'drustvo',
  sensitivityReason: 'krivični postupak protiv imenovane osobe',
  wordCount: 412,
  model: 'claude-sonnet-5',
};

describe('escapeHtml', () => {
  it('zamenjuje znakove koje Telegram tumači kao oznake', () => {
    expect(escapeHtml('Vlada & <b>opozicija</b>')).toBe('Vlada &amp; &lt;b&gt;opozicija&lt;/b&gt;');
  });

  it('naslov sa navodnicima prolazi nepromenjen', () => {
    expect(escapeHtml('Vučić: „Nema odustajanja"')).toBe('Vučić: „Nema odustajanja"');
  });
});

describe('buildReviewMessage', () => {
  const message = buildReviewMessage(ARTICLE);

  it('sadrži naslov, uvod i razlog osetljivosti', () => {
    expect(message).toContain(ARTICLE.title);
    expect(message).toContain(ARTICLE.lead);
    expect(message).toContain('krivični postupak');
  });

  it('kaže koliko reči ima i koji model je pisao', () => {
    expect(message).toContain('412 reči');
    expect(message).toContain('claude-sonnet-5');
  });

  it('staje u granicu koju Telegram dozvoljava', () => {
    const dugacak = buildReviewMessage({ ...ARTICLE, body: 'reč '.repeat(5000) });
    expect(dugacak.length).toBeLessThanOrEqual(4096);
  });

  it('ne pušta neescape-ovan HTML iz naslova', () => {
    const opasan = buildReviewMessage({ ...ARTICLE, title: '<script>x</script>' });
    expect(opasan).not.toContain('<script>');
    expect(opasan).toContain('&lt;script&gt;');
  });
});

describe('trimToLength', () => {
  it('ne dira tekst koji staje', () => {
    expect(trimToLength('Kratko.', 100)).toBe('Kratko.');
  });

  it('seče na kraju rečenice i kaže da je skraćeno', () => {
    const text = `${'Prva rečenica ima smisla. '.repeat(20)}Poslednja.`;
    const trimmed = trimToLength(text, 200);
    expect(trimmed.length).toBeLessThan(text.length);
    expect(trimmed).toContain('skraćen');
    expect(trimmed.split('\n')[0]?.endsWith('.')).toBe(true);
  });
});

describe('dugmad i odgovori', () => {
  it('pravi dva dugmeta sa identifikatorom članka', () => {
    const buttons = reviewButtons(ARTICLE.articleId);
    expect(buttons[0]).toHaveLength(2);
    expect(buttons[0]?.[0]?.callback_data).toBe(`${APPROVE_PREFIX}:${ARTICLE.articleId}`);
    expect(buttons[0]?.[1]?.callback_data).toBe(`${REJECT_PREFIX}:${ARTICLE.articleId}`);
  });

  it('podatak dugmeta staje u granicu od 64 bajta', () => {
    for (const button of reviewButtons(ARTICLE.articleId)[0] ?? []) {
      expect(Buffer.byteLength(button.callback_data, 'utf8')).toBeLessThanOrEqual(64);
    }
  });

  it('čita odobrenje i odbijanje', () => {
    expect(parseCallbackData(`odobri:${ARTICLE.articleId}`)).toEqual({
      decision: 'approved',
      articleId: ARTICLE.articleId,
    });
    expect(parseCallbackData(`odbij:${ARTICLE.articleId}`)?.decision).toBe('rejected');
  });

  it('odbacuje sve što nije naše dugme', () => {
    expect(parseCallbackData(undefined)).toBeNull();
    expect(parseCallbackData('nesto:drugo')).toBeNull();
    expect(parseCallbackData('odobri')).toBeNull();
    expect(parseCallbackData('')).toBeNull();
  });
});

describe('decidedMessage', () => {
  const when = new Date('2026-09-07T10:00:00Z');

  it('jasno kaže da je članak objavljen', () => {
    const text = decidedMessage(ARTICLE, 'approved', when);
    expect(text).toContain('Odobreno');
    expect(text).toContain(ARTICLE.title);
  });

  it('jasno kaže da odbijen članak ostaje neobjavljen', () => {
    expect(decidedMessage(ARTICLE, 'rejected', when)).toContain('ostaje neobjavljeno');
  });

  it('istek jasno kaže da ćutanje nije odobrenje', () => {
    const text = decidedMessage(ARTICLE, 'expired', when);
    expect(text).toContain('bez odgovora');
    expect(text).toContain('nacrt');
  });

  it('poruka o odluci je kratka — bez celog teksta članka', () => {
    expect(decidedMessage(ARTICLE, 'approved', when).length).toBeLessThan(MAX_MESSAGE_CHARS);
  });
});
