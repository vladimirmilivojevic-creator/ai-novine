#!/usr/bin/env -S npx tsx
import { Command } from 'commander';
import { logger } from '@ai-novine/core';
import { runConfigCheck } from './commands/config-check.js';
import { runDiscover } from './commands/discover.js';
import { runDoctor } from './commands/doctor.js';
import { runIngest } from './commands/ingest.js';
import { runMigrate } from './commands/migrate.js';

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
  .command('editorial')
  .description('Klasteruje vesti, bira teme i generise clanke (Faze 4 i 5)')
  .action(() => {
    notYet('editorial', 4);
  });

program
  .command('sweep')
  .description('Brise stare sirove vesti i gasi istekle zahteve za odobrenje (Faza 3 i 7)')
  .action(() => {
    notYet('sweep', 3);
  });

function notYet(command: string, phase: number): never {
  logger.warn(`Komanda "${command}" jos nije implementirana — dolazi u Fazi ${phase}.`);
  process.exit(0);
}

try {
  await program.parseAsync();
} catch (error) {
  logger.error('Pipeline je pukao.', { greska: (error as Error).message });
  process.exit(1);
}
