import { createLogger, loadDotEnv, loadEditorialConfig } from '@ai-novine/core';
import {
  createServiceClient,
  deleteOldRawItems,
  deleteOldRuns,
  finishRun,
  startRun,
  storageSnapshot,
} from '@ai-novine/db';

const log = createLogger('sweep');

export interface SweepOptions {
  /** Samo prikazi sta bi bilo obrisano. */
  dryRun: boolean;
}

/**
 * Ciscenje baze. Supabase besplatni tier je 500 MB, a puni tekst hiljadu
 * clanaka dnevno pojede to za nedelje. Sirove vesti se brisu posle zadatog
 * broja dana; generisani clanci (Faza 5) ostaju zauvek, jer su mali.
 */
export async function runSweep(options: SweepOptions): Promise<void> {
  loadDotEnv();

  const retention = loadEditorialConfig().retention;
  const client = createServiceClient();

  const before = await storageSnapshot(client);
  log.info('Stanje pre ciscenja.', {
    sirovihClanaka: before.rawItems,
    pokretanja: before.runs,
    najstarijiClanak: before.oldestRawItem ?? 'nema',
  });

  if (options.dryRun) {
    log.info('Probni rezim — nista nije obrisano.', {
      pravilo: `sirovi clanci stariji od ${retention.rawItemsDays} dana, pokretanja starija od ${retention.pipelineRunsDays} dana`,
    });
    return;
  }

  const runId = await startRun(client, 'sweep');
  try {
    const rawItems = await deleteOldRawItems(client, retention.rawItemsDays);
    const runs = await deleteOldRuns(client, retention.pipelineRunsDays);
    const after = await storageSnapshot(client);

    const stats = {
      obrisanoSirovihClanaka: rawItems,
      obrisanoPokretanja: runs,
      preostaloSirovihClanaka: after.rawItems,
    };
    await finishRun(client, runId, true, stats, []);
    log.info('Ciscenje zavrseno.', stats);
  } catch (error) {
    await finishRun(client, runId, false, {}, [(error as Error).message]);
    throw error;
  }
}
