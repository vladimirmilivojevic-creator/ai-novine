import type { SourceReport, Verdict } from './probe.js';
import { pickFeedsForConfig } from './select.js';

const VERDICT_LABEL: Record<Verdict, string> = {
  rss: 'RSS radi',
  sitemap: 'Bez RSS-a, ali ima news sitemap',
  scrape: 'Bez RSS-a — treba scraping',
  blocked: 'Blokira botove',
  error: 'Greska u dohvatanju',
};

const ANGLE_LABEL: Record<string, string> = {
  provladin: 'provladin',
  kriticki: 'kriticki',
  mejnstrim: 'mejnstrim',
  agencija: 'agencija',
};

export function renderMarkdownReport(reports: SourceReport[], startedAt: Date): string {
  const lines: string[] = [];
  const byVerdict = groupBy(reports, (report) => report.verdict);

  lines.push('# RSS discovery izveštaj');
  lines.push('');
  lines.push(`**Datum provere:** ${formatDateTime(startedAt)}`);
  lines.push(`**Provereno izvora:** ${reports.length}`);
  lines.push('');
  lines.push(
    'Izveštaj generiše `npm run pipeline -- discover`. Provera ide redom: `robots.txt`, ' +
      'pa `<link rel="alternate">` u HTML-u početne strane, pa standardne RSS putanje ' +
      '(`/feed`, `/rss`, `/rss.xml`, `/feed/rss2` i varijante), pa `sitemap.xml`. ' +
      'Svaki feed se i preuzima i parsira — sajt koji na `/feed` vrati HTML stranu ne računa se ' +
      'kao RSS.',
  );
  lines.push('');

  lines.push('## Zbirno');
  lines.push('');
  lines.push('| Ishod | Broj izvora |');
  lines.push('| --- | --- |');
  for (const verdict of ['rss', 'sitemap', 'scrape', 'blocked', 'error'] as const) {
    const count = byVerdict.get(verdict)?.length ?? 0;
    if (count > 0) lines.push(`| ${VERDICT_LABEL[verdict]} | ${count} |`);
  }
  lines.push('');

  lines.push('## Svi izvori');
  lines.push('');
  lines.push('| Izvor | Ugao | Ishod | Najbolji feed | Stavki | Najnovija vest |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const report of reports) {
    const best = bestFeed(report);
    lines.push(
      `| ${report.name} | ${ANGLE_LABEL[report.angle] ?? report.angle} | ${VERDICT_LABEL[report.verdict]} | ` +
        `${best ? `\`${best.finalUrl}\`` : '—'} | ${best ? best.itemCount : '—'} | ` +
        `${best?.newestItemAt ? formatAge(best.newestItemAt) : '—'} |`,
    );
  }
  lines.push('');

  const working = byVerdict.get('rss') ?? [];
  if (working.length > 0) {
    lines.push('## Izvori sa ispravnim RSS-om');
    lines.push('');
    for (const report of working) {
      lines.push(`### ${report.name}`);
      lines.push('');
      lines.push(`Početna: ${report.homepage} · robots.txt: ${report.robots.state}`);
      if (report.robots.crawlDelaySeconds !== null) {
        lines.push('');
        lines.push(
          `> \`Crawl-delay: ${report.robots.crawlDelaySeconds}s\` — pipeline mora da poštuje ovaj razmak.`,
        );
      }
      lines.push('');
      const chosen = new Set(pickFeedsForConfig(report).map((feed) => feed.finalUrl));
      lines.push('| Feed | Tip | Pronađen preko | Stavki | Najnovija vest | U config |');
      lines.push('| --- | --- | --- | --- | --- | --- |');
      for (const feed of report.feeds) {
        lines.push(
          `| \`${feed.finalUrl}\` | ${feed.kind} | ${feed.discoveredVia} | ${feed.itemCount} | ` +
            `${feed.newestItemAt ? formatAge(feed.newestItemAt) : 'nema datuma'} | ` +
            `${chosen.has(feed.finalUrl) ? 'da' : '—'} |`,
        );
      }
      lines.push('');
      if (report.feeds.length > chosen.size) {
        lines.push(
          `> Sajt nudi ${report.feeds.length} feed-ova (glavni plus po jedan za svaku rubriku). ` +
            `U \`config/sources.json\` ulazi ${chosen.size} — dohvatati sve značilo bi ` +
            'višestruko veći saobraćaj ka istom sajtu za skoro isti sadržaj.',
        );
        lines.push('');
      }
    }
  }

  const needScraping = [...(byVerdict.get('scrape') ?? []), ...(byVerdict.get('sitemap') ?? [])];
  if (needScraping.length > 0) {
    lines.push('## Izvori bez RSS-a — predlog fallback-a');
    lines.push('');
    lines.push(
      'Za svaki od ovih izvora predlog je: krenuti od rubrika koje se najčešće pojavljuju na ' +
        'početnoj strani, uzimati linkove na članke iz njih, i tekst vaditi sa same stranice ' +
        'članka. Sve uz poštovanje `robots.txt`, jedan zahtev u sekundi i korektan User-Agent.',
    );
    lines.push('');

    for (const report of needScraping) {
      lines.push(`### ${report.name}`);
      lines.push('');
      lines.push(`Početna: ${report.homepage} · robots.txt: ${report.robots.state}`);
      lines.push('');

      const newsSitemaps = report.sitemaps.filter((entry) => entry.isNewsSitemap);
      if (newsSitemaps.length > 0) {
        lines.push(
          '**Ima news sitemap** — to je bolje od scraping-a: uredan XML sa svežim člancima.',
        );
        lines.push('');
        for (const sitemap of newsSitemaps) {
          lines.push(`- \`${sitemap.url}\` (${sitemap.entryCount} unosa)`);
        }
        lines.push('');
      } else if (report.sitemaps.length > 0) {
        lines.push('**Sitemap-ovi pronađeni** (obični, ne news):');
        lines.push('');
        for (const sitemap of report.sitemaps) {
          lines.push(
            `- \`${sitemap.url}\` — ${sitemap.isIndex ? 'indeks' : 'urlset'}, ${sitemap.entryCount} unosa`,
          );
        }
        lines.push('');
      }

      if (report.topSegments.length > 0) {
        lines.push('Najčešće rubrike na početnoj strani:');
        lines.push('');
        lines.push('| Rubrika | Linkova | Primer |');
        lines.push('| --- | --- | --- |');
        for (const segment of report.topSegments) {
          lines.push(`| \`/${segment.segment}\` | ${segment.count} | ${segment.sample} |`);
        }
        lines.push('');
        lines.push('Predlog za `config/sources.json`:');
        lines.push('');
        lines.push('```json');
        lines.push(JSON.stringify(scrapeSuggestion(report), null, 2));
        lines.push('```');
        lines.push('');
      } else {
        lines.push(
          'Sa početne strane nije izvučena upotrebljiva mapa rubrika — verovatno se sadržaj ' +
            'učitava JavaScript-om. Ovaj izvor traži posebnu proveru ili izbacivanje.',
        );
        lines.push('');
      }
    }
  }

  const blocked = byVerdict.get('blocked') ?? [];
  if (blocked.length > 0) {
    lines.push('## Izvori koji blokiraju botove');
    lines.push('');
    lines.push(
      'Ovi sajtovi odbijaju automatske zahteve (Cloudflare ili slična zaštita). Zaobilaženje te ' +
        'zaštite je kršenje njihovih uslova korišćenja i ne radi se. Realne opcije su: izbaciti ' +
        'izvor, ili im zvanično napisati i tražiti pristup.',
    );
    lines.push('');
    for (const report of blocked) {
      lines.push(`- **${report.name}** (${report.homepage}) — robots.txt: ${report.robots.state}`);
      for (const note of report.notes) lines.push(`  - ${note}`);
    }
    lines.push('');
  }

  const failed = byVerdict.get('error') ?? [];
  if (failed.length > 0) {
    lines.push('## Izvori sa greškom');
    lines.push('');
    for (const report of failed) {
      lines.push(`- **${report.name}** (${report.homepage}) — robots.txt: ${report.robots.state}`);
      for (const note of report.notes) lines.push(`  - ${note}`);
    }
    lines.push('');
  }

  lines.push('## Dnevnik provera');
  lines.push('');
  lines.push('Sve isprobane putanje, izvor po izvor.');
  lines.push('');
  for (const report of reports) {
    lines.push('<details>');
    lines.push(`<summary>${report.name} — ${report.attempts.length} provera</summary>`);
    lines.push('');
    for (const attempt of report.attempts) {
      lines.push(`- \`${attempt.url}\` → ${attempt.outcome}`);
    }
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  return lines.join('\n');
}

/** Predlog `scrape` bloka za `config/sources.json`. */
export function scrapeSuggestion(report: SourceReport) {
  const segments = report.topSegments.slice(0, 3);
  return {
    listingUrls: segments.map((segment) => new URL(`/${segment.segment}/`, report.homepage).href),
    itemLinkSelector: 'article a[href], h2 a[href], h3 a[href]',
    linkPattern: segments.length > 0 ? `^/(${segments.map((s) => s.segment).join('|')})/` : null,
    maxLinksPerRun: 30,
  };
}

export function bestFeed(report: SourceReport) {
  return [...report.feeds].sort((a, b) => b.itemCount - a.itemCount)[0] ?? null;
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const group = groups.get(key(item));
    if (group) group.push(item);
    else groups.set(key(item), [item]);
  }
  return groups;
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('sr-RS', { timeZone: 'Europe/Belgrade', hour12: false });
}

function formatAge(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 0) return 'u budućnosti (loš datum u feedu)';
  if (minutes < 60) return `pre ${minutes} min`;
  if (minutes < 60 * 48) return `pre ${Math.round(minutes / 60)} h`;
  return `pre ${Math.round(minutes / (60 * 24))} dana`;
}
