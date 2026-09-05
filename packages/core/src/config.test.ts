import { describe, expect, it } from 'vitest';
import { ANGLES, CATEGORIES, loadEditorialConfig, loadSourcesConfig } from './config.js';

describe('config/sources.json', () => {
  const config = loadSourcesConfig();

  it('prolazi kroz semu i ima izvore', () => {
    expect(config.sources.length).toBeGreaterThan(0);
  });

  it('nema ponovljene id-jeve', () => {
    const ids = config.sources.map((source) => source.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('pokriva sve uglove, jer kapija kvaliteta trazi najmanje dva razlicita', () => {
    const used = new Set(config.sources.filter((s) => s.enabled).map((s) => s.angle));
    for (const angle of ANGLES) expect(used.has(angle)).toBe(true);
  });

  it('koristi korektan User-Agent, bez glumljenja browsera', () => {
    expect(config.defaults.userAgent).toContain('AINovineBot');
    expect(config.defaults.userAgent).not.toMatch(/Mozilla|Chrome|Safari/);
  });

  it('postuje robots.txt i ne ide brze od jednog zahteva u sekundi po domenu', () => {
    expect(config.defaults.respectRobotsTxt).toBe(true);
    expect(config.defaults.requestsPerSecondPerDomain).toBeLessThanOrEqual(1);
  });
});

describe('config/editorial.json', () => {
  const config = loadEditorialConfig();

  it('definise svaku kategoriju iz sistema', () => {
    for (const category of CATEGORIES) expect(config.categories[category]).toBeDefined();
  });

  it('drzi kapije iz sekcije 9 brief-a: bar 3 izvora iz bar 2 ugla', () => {
    expect(config.gates.minDistinctSources).toBeGreaterThanOrEqual(3);
    expect(config.gates.minDistinctAngles).toBeGreaterThanOrEqual(2);
  });

  it('ne dozvoljava tanke clanke', () => {
    expect(config.gates.minWordsToPublish).toBeGreaterThanOrEqual(300);
    expect(config.gates.maxWordsToPublish).toBeGreaterThan(config.gates.minWordsToPublish);
  });

  it('ima tvrdu gornju granicu objava dnevno', () => {
    expect(config.limits.maxArticlesPerDay).toBeLessThanOrEqual(50);
    expect(config.limits.maxFlagshipArticlesPerDay).toBeLessThanOrEqual(
      config.limits.maxArticlesPerDay,
    );
  });

  it('zbir dnevnih kvota po kategorijama ne sme da bude manji od ukupne granice', () => {
    const sum = Object.values(config.categories).reduce((acc, c) => acc + c.dailyQuota, 0);
    expect(sum).toBeGreaterThanOrEqual(config.limits.maxArticlesPerDay);
  });

  it('brise sirove vesti pre nego sto Supabase besplatni tier pukne', () => {
    expect(config.retention.rawItemsDays).toBeLessThanOrEqual(14);
  });
});
