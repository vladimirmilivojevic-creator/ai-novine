import { describe, expect, it } from 'vitest';
import { pickFeedsForConfig } from './select.js';
import type { FeedCandidate, SourceReport } from './probe.js';

function feed(url: string, itemCount: number): FeedCandidate {
  return {
    requestedUrl: url,
    finalUrl: url,
    kind: 'rss',
    title: null,
    itemCount,
    newestItemAt: null,
    discoveredVia: 'html',
  };
}

function reportWith(feeds: FeedCandidate[]): SourceReport {
  return {
    id: 'test',
    name: 'Test',
    angle: 'mejnstrim',
    homepage: 'https://primer.rs',
    enabled: true,
    robots: { state: 'dostupan', crawlDelaySeconds: null, declaredSitemaps: [] },
    homepageStatus: 200,
    feeds,
    sitemaps: [],
    topSegments: [],
    attempts: [],
    notes: [],
    verdict: 'rss',
    elapsedMs: 0,
  };
}

describe('pickFeedsForConfig', () => {
  it('stavlja glavni feed prvi, jer je njegova putanja najplica', () => {
    const report = reportWith([
      feed('https://primer.rs/rss/vesti/politika', 100),
      feed('https://primer.rs/rss/vesti', 100),
      feed('https://primer.rs/rss', 100),
    ]);

    expect(pickFeedsForConfig(report)[0]?.finalUrl).toBe('https://primer.rs/rss');
  });

  it('na istoj dubini bira feed sa vise stavki', () => {
    const report = reportWith([
      feed('https://primer.rs/rss/sport', 10),
      feed('https://primer.rs/rss/naslovna', 100),
    ]);

    expect(pickFeedsForConfig(report).map((entry) => entry.finalUrl)).toEqual([
      'https://primer.rs/rss/naslovna',
      'https://primer.rs/rss/sport',
    ]);
  });

  it('ne pusta vise od pet feed-ova po izvoru', () => {
    const many = Array.from({ length: 22 }, (_, index) =>
      feed(`https://primer.rs/rss/rubrika-${index}`, 100),
    );

    expect(pickFeedsForConfig(reportWith(many))).toHaveLength(5);
  });

  it('izbacuje WordPress feed komentara, jer u njemu nema vesti', () => {
    const report = reportWith([
      feed('https://primer.rs/comments/feed/', 50),
      feed('https://primer.rs/feed/', 20),
    ]);

    expect(pickFeedsForConfig(report).map((entry) => entry.finalUrl)).toEqual([
      'https://primer.rs/feed/',
    ]);
  });

  it('izbacuje prazne feed-ove', () => {
    const report = reportWith([
      feed('https://primer.rs/rss', 0),
      feed('https://primer.rs/feed', 7),
    ]);

    expect(pickFeedsForConfig(report).map((entry) => entry.finalUrl)).toEqual([
      'https://primer.rs/feed',
    ]);
  });
});
