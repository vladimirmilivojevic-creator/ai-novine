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
  const target = parsePostgresUrl(connectionString);

  const strict = new pg.Client({ ...target, ssl: { rejectUnauthorized: true } });
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
    const relaxed = new pg.Client({ ...target, ssl: { rejectUnauthorized: false } });
    await relaxed.connect();
    return relaxed;
  }
}

export interface PostgresTarget {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/**
 * Rastavlja `postgresql://` vezu na delove, rucno.
 *
 * Razlog: lozinka sme da sadrzi `@`, `/` i `?`. Standardni parseri preseku
 * string na prvom takvom znaku i onda pokusaju da se poveze na pogresan host.
 * Zato se prvo trazi POSLEDNJI `@` — sve pre njega je korisnik i lozinka, sve
 * posle je host, port i ime baze. Lozinka sa `@` tako radi i kad je upisana
 * doslovno, i kad je kodirana kao `%40`.
 */
export function parsePostgresUrl(raw: string): PostgresTarget {
  const value = raw.trim();
  if (!/^postgres(ql)?:\/\//i.test(value)) {
    throw new Error('SUPABASE_DB_URL mora da pocinje sa postgresql:// ili postgres://');
  }

  const withoutScheme = value.replace(/^postgres(ql)?:\/\//i, '');
  const separator = withoutScheme.lastIndexOf('@');
  if (separator === -1) {
    throw new Error('SUPABASE_DB_URL nema korisnika i lozinku (nedostaje "@" pre imena servera)');
  }

  const userInfo = withoutScheme.slice(0, separator);
  const serverPart = withoutScheme.slice(separator + 1);

  const colon = userInfo.indexOf(':');
  const user = decodeIfEncoded(colon === -1 ? userInfo : userInfo.slice(0, colon));
  const password = colon === -1 ? '' : decodeIfEncoded(userInfo.slice(colon + 1));

  const slash = serverPart.indexOf('/');
  const hostPort = slash === -1 ? serverPart : serverPart.slice(0, slash);
  const database = slash === -1 ? 'postgres' : (serverPart.slice(slash + 1).split('?')[0] ?? '');

  const portMatch = /:(\d+)$/.exec(hostPort);
  const host = portMatch ? hostPort.slice(0, portMatch.index) : hostPort;
  const port = portMatch?.[1] ? Number.parseInt(portMatch[1], 10) : 5432;

  if (!host) throw new Error('SUPABASE_DB_URL nema ime servera');
  if (!user) throw new Error('SUPABASE_DB_URL nema korisnicko ime');

  return { host, port, user, password, database: decodeIfEncoded(database) || 'postgres' };
}

/** `%40` postaje `@`; doslovno upisan `@` ostaje kakav jeste. */
function decodeIfEncoded(value: string): string {
  if (!value.includes('%')) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
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
