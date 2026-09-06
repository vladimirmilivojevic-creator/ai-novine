import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { createLogger, repoRoot } from '@ai-novine/core';

const log = createLogger('migrate');

export const migrationsDir = join(repoRoot, 'packages', 'db', 'migrations');

export interface Migration {
  name: string;
  sql: string;
}

/** Cita `.sql` fajlove iz `packages/db/migrations`, poredjane po imenu. */
export function loadMigrations(): Migration[] {
  return readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => ({ name: file, sql: readFileSync(join(migrationsDir, file), 'utf8') }));
}

const TRACKING_TABLE = `
  create table if not exists public.schema_migrations (
    name        text primary key,
    applied_at  timestamptz not null default now()
  );
`;

/**
 * Otvara vezu ka Postgres-u. Supabase trazi SSL. Prvo se pokusava sa punom
 * proverom sertifikata; ako okruzenje nema lanac poverenja, prelazi se na vezu
 * bez provere uz jasno upozorenje — sifrovana je i dalje, ali bez potvrde
 * identiteta servera.
 */
async function connect(connectionString: string): Promise<pg.Client> {
  const strict = new pg.Client({ connectionString, ssl: { rejectUnauthorized: true } });
  try {
    await strict.connect();
    return strict;
  } catch (error) {
    await strict.end().catch(() => undefined);
    if (!isCertificateError(error)) throw error;

    log.warn(
      'SSL sertifikat nije proveren do kraja — nastavljam sa sifrovanom vezom bez provere.',
      {
        razlog: (error as Error).message,
      },
    );
    const relaxed = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
    await relaxed.connect();
    return relaxed;
  }
}

function isCertificateError(error: unknown): boolean {
  const code = (error as { code?: string }).code ?? '';
  return (
    code.startsWith('UNABLE_TO_') ||
    code.startsWith('SELF_SIGNED') ||
    code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
    code === 'CERT_HAS_EXPIRED' ||
    code === 'ERR_TLS_CERT_ALTNAME_INVALID'
  );
}

export interface MigrationResult {
  applied: string[];
  alreadyApplied: string[];
}

/**
 * Primenjuje migracije koje jos nisu primenjene. Svaka ide u sopstvenoj
 * transakciji — ako jedna pukne, prethodne ostaju, a ta se ne upisuje kao
 * primenjena, pa se sledeci put pokusava ponovo.
 */
export async function applyMigrations(connectionString: string): Promise<MigrationResult> {
  const client = await connect(connectionString);
  const result: MigrationResult = { applied: [], alreadyApplied: [] };

  try {
    await client.query(TRACKING_TABLE);
    const { rows } = await client.query<{ name: string }>(
      'select name from public.schema_migrations',
    );
    const done = new Set(rows.map((row) => row.name));

    for (const migration of loadMigrations()) {
      if (done.has(migration.name)) {
        result.alreadyApplied.push(migration.name);
        continue;
      }

      log.info(`Primenjujem ${migration.name}…`);
      await client.query('begin');
      try {
        await client.query(migration.sql);
        await client.query('insert into public.schema_migrations (name) values ($1)', [
          migration.name,
        ]);
        await client.query('commit');
        result.applied.push(migration.name);
      } catch (error) {
        await client.query('rollback');
        throw new Error(`Migracija ${migration.name} nije prosla: ${(error as Error).message}`, {
          cause: error,
        });
      }
    }
  } finally {
    await client.end().catch(() => undefined);
  }

  return result;
}

/** Imena migracija koje jos nisu primenjene. */
export async function pendingMigrations(connectionString: string): Promise<string[]> {
  const client = await connect(connectionString);
  try {
    await client.query(TRACKING_TABLE);
    const { rows } = await client.query<{ name: string }>(
      'select name from public.schema_migrations',
    );
    const done = new Set(rows.map((row) => row.name));
    return loadMigrations()
      .map((migration) => migration.name)
      .filter((name) => !done.has(name));
  } finally {
    await client.end().catch(() => undefined);
  }
}
