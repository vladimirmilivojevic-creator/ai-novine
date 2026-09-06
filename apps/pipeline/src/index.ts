#!/usr/bin/env -S npx tsx
import { Command } from 'commander';
import { logger } from '@ai-novine/core';
import { runCluster } from './commands/cluster.js';
import { runCompare } from './commands/compare.js';
import { runConfigCheck } from './commands/config-check.js';
import { runDiscover } from './commands/discover.js';
import { runDoctor } from './commands/doctor.js';
import { runEditorial } from './commands/editorial.js';
import { runIngest } from './commands/ingest.js';
import { runMigrate } from './commands/migrate.js';
import { runReview } from './commands/review.js';
import { runSweep } from './commands/sweep.js';

const program = new Command();

program
  .name('ainovine')
  .description('AI Novine pipeline — discover | ingest | editorial | sweep')
  .version('0.1.0');

program
  .command('config')
  .description('Proverava da li su config/sources.json i config/editorial.json ispravni')
  .action(() => {
    runConfigCheck();
  });

program
  .command('doctor')
  .description('Proverava env varijable i veze ka Supabase, Anthropic i Telegram servisima')
  .action(async () => {
    await runDoctor();
  });

program
  .command('discover')
  .description('Trazi RSS feed za svaki izvor i pravi izvestaj u reports/')
  .option('--only <ids>', 'proveri samo zadate izvore, npr. --only n1,danas,kurir')
  .option('--concurrency <broj>', 'koliko domena istovremeno (podrazumevano 4)', '4')
  .option('--apply', 'upisi pronadjene feed-ove u config/sources.json', false)
  .action(async (options: { only?: string; concurrency: string; apply: boolean }) => {
    await runDiscover({
      only: options.only
        ?.split(',')
        .map((id) => id.trim())
        .filter(Boolean),
      concurrency: Math.max(1, Number.parseInt(options.concurrency, 10) || 4),
      apply: options.apply,
    });
  });

program
  .command('migrate')
  .description('Primenjuje SQL migracije iz packages/db/migrations na Supabase bazu')
  .option('--check', 'samo prikazi koje migracije nisu primenjene', false)
  .action(async (options: { check: boolean }) => {
    await runMigrate({ check: options.check });
  });

program
  .command('ingest')
  .description('Dohvata nove clanke sa izvora i upisuje ih u bazu')
  .option('--only <ids>', 'samo zadati izvori, npr. --only n1,danas,kurir')
  .option('--concurrency <broj>', 'koliko izvora istovremeno (podrazumevano 3)', '3')
  .option('--limit <broj>', 'najvise novih clanaka po izvoru (podrazumevano 25)', '25')
  .option('--no-full-text', 'ne otvaraj stranice clanaka, koristi samo ono sto feed daje')
  .action(
    async (options: { only?: string; concurrency: string; limit: string; fullText: boolean }) => {
      await runIngest({
        only: options.only
          ?.split(',')
          .map((id) => id.trim())
          .filter(Boolean),
        concurrency: Math.max(1, Number.parseInt(options.concurrency, 10) || 3),
        limit: Math.max(1, Number.parseInt(options.limit, 10) || 25),
        fullText: options.fullText,
      });
    },
  );

program
  .command('cluster')
  .description('Grupise sirove vesti u teme i pravi izvestaj reports/teme-dana.md')
  .option('--report <broj>', 'koliko tema ide u izvestaj (podrazumevano 15)', '15')
  .option('--report-only', 'samo izvestaj o postojecim temama, bez novog grupisanja', false)
  .option('--reset', 'obrisi sve teme i grupisi ispocetka (posle promene praga)', false)
  .action(async (options: { report: string; reportOnly: boolean; reset: boolean }) => {
    await runCluster({
      report: Math.max(1, Number.parseInt(options.report, 10) || 15),
      reportOnly: options.reportOnly,
      reset: options.reset,
    });
  });

program
  .command('editorial')
  .description('Bira teme koje zasluzuju clanak i pise ih')
  .option('--dry-run', 'samo prikazi koje bi teme dobile clanak, bez poziva modelu', false)
  .option('--limit <broj>', 'najvise clanaka u ovom ciklusu')
  .option('--batch', 'asinhrono kroz Batch API: pola cene, odgovor u sledecem ciklusu', false)
  .action(async (options: { dryRun: boolean; limit?: string; batch: boolean }) => {
    await runEditorial({
      dryRun: options.dryRun,
      batch: options.batch,
      ...(options.limit ? { limit: Math.max(1, Number.parseInt(options.limit, 10) || 1) } : {}),
    });
  });

program
  .command('compare')
  .description('Pise istu temu sa dva modela i pravi izvestaj za poredjenje (kapija Faze 5)')
  .option('--topics <broj>', 'koliko tema ide kroz oba modela (podrazumevano 2)', '2')
  .option('--cluster <id>', 'poredi tacno odredjenu temu')
  .action(async (options: { topics: string; cluster?: string }) => {
    await runCompare({
      topics: Math.max(1, Number.parseInt(options.topics, 10) || 2),
      ...(options.cluster ? { clusterId: options.cluster } : {}),
    });
  });

program
  .command('review')
  .description('Salje osetljive clanke na Telegram i kupi odluke (Faza 7)')
  .option('--dry-run', 'samo prikazi sta bi bilo poslato, bez slanja', false)
  .action(async (options: { dryRun: boolean }) => {
    await runReview({ dryRun: options.dryRun });
  });

program
  .command('sweep')
  .description('Brise stare sirove vesti i zapise o pokretanjima')
  .option('--dry-run', 'samo prikazi stanje, ne brisi nista', false)
  .action(async (options: { dryRun: boolean }) => {
    await runSweep({ dryRun: options.dryRun });
  });

try {
  await program.parseAsync();
} catch (error) {
  logger.error('Pipeline je pukao.', { greska: (error as Error).message });
  process.exit(1);
}
