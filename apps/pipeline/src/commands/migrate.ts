import { relative } from 'node:path';
import { createLogger, loadDotEnv, repoRoot } from '@ai-novine/core';
import { applyMigrations, loadMigrations, migrationsDir, pendingMigrations } from '@ai-novine/db';

const log = createLogger('migrate');

export interface MigrateOptions {
  /** Samo prikazi sta bi bilo primenjeno. */
  check: boolean;
}

export async function runMigrate(options: MigrateOptions): Promise<void> {
  loadDotEnv();

  const connectionString = process.env['SUPABASE_DB_URL']?.trim();
  if (!connectionString) {
    printManualInstructions();
    process.exit(1);
  }

  if (options.check) {
    const pending = await pendingMigrations(connectionString);
    if (pending.length === 0) {
      log.info('Baza je u koraku sa migracijama.');
      return;
    }
    log.warn(`Nije primenjeno migracija: ${pending.length}`, { migracije: pending });
    return;
  }

  const result = await applyMigrations(connectionString);
  log.info('Migracije zavrsene.', {
    primenjeno: result.applied.length,
    vecPrimenjeno: result.alreadyApplied.length,
    ...(result.applied.length > 0 ? { nove: result.applied } : {}),
  });
}

function printManualInstructions(): void {
  const files = loadMigrations().map((migration) => migration.name);

  console.log('');
  console.log('Nedostaje SUPABASE_DB_URL — bez njega ne mogu sam da primenim migracije.');
  console.log('');
  console.log('Imaš dva puta:');
  console.log('');
  console.log('A) Dodaj vezu u .env pa pusti mene (preporuka, radi i za sve buduće migracije)');
  console.log('   1. Otvori supabase.com/dashboard i izaberi svoj projekat.');
  console.log('   2. Klikni zeleno dugme "Connect" gore desno.');
  console.log('   3. Kartica "Connection string" → izaberi "Session pooler".');
  console.log('   4. Kopiraj ceo string (počinje sa postgresql://).');
  console.log('   5. U njemu zameni [YOUR-PASSWORD] lozinkom baze. Ako je ne znaš:');
  console.log('      Settings → Database → "Reset database password".');
  console.log('   6. Nalepi u .env kao:  SUPABASE_DB_URL=postgresql://...');
  console.log('   7. Pokreni ponovo:    npm run pipeline -- migrate');
  console.log('');
  console.log('B) Primeni ručno kroz dashboard (bez dodavanja lozinke u .env)');
  console.log('   1. Dashboard → SQL Editor → New query.');
  console.log(`   2. Nalepi sadržaj fajla iz ${relative(repoRoot, migrationsDir)}:`);
  for (const file of files) console.log(`        - ${file}`);
  console.log('   3. Klikni Run.');
  console.log('');
}
