#!/usr/bin/env -S npx tsx
import { Command } from 'commander';
import { logger } from '@ai-novine/core';
import { runConfigCheck } from './commands/config-check.js';
import { runDiscover } from './commands/discover.js';

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
  .command('ingest')
  .description('Dohvata nove clanke sa izvora i upisuje ih u bazu (Faza 2 i 3)')
  .action(() => {
    notYet('ingest', 2);
  });

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
