import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import {
  describeSupabaseKey,
  ENV_SPECS,
  loadDotEnv,
  repoRoot,
  type EnvVarSpec,
} from '@ai-novine/core';

/**
 * Provera okruzenja. Nijedna prava vrednost kljuca se NE ispisuje — samo
 * ✅ / ❌ i osobine koje nisu tajna (duzina, format, uloga iz JWT-a).
 */

type Status = 'ok' | 'fail' | 'skip';

interface Check {
  status: Status;
  label: string;
  detail: string;
}

const results: Check[] = [];

function add(status: Status, label: string, detail: string): void {
  results.push({ status, label, detail });
}

export async function runDoctor(): Promise<void> {
  const loaded = loadDotEnv();

  console.log('');
  console.log('AI Novine — provera okruzenja');
  console.log('═'.repeat(72));

  section('Bezbednost');
  checkGitSafety(loaded);

  section('Env varijable');
  const missingRequired = checkEnvVars();

  section('Konekcije');
  await checkSupabase();
  await checkAnthropic();
  await checkTelegram();

  console.log('');
  console.log('═'.repeat(72));
  const failed = results.filter((check) => check.status === 'fail').length;
  const skipped = results.filter((check) => check.status === 'skip').length;
  const passed = results.filter((check) => check.status === 'ok').length;
  console.log(`${passed} u redu · ${failed} greska · ${skipped} preskoceno`);
  console.log('');

  if (failed > 0 || missingRequired > 0) process.exit(1);
}

function section(title: string): void {
  console.log('');
  console.log(`${title}`);
  console.log('─'.repeat(72));
}

function line(status: Status, label: string, detail: string): void {
  const icon = status === 'ok' ? '✅' : status === 'fail' ? '❌' : '⏭️ ';
  console.log(`  ${icon} ${label.padEnd(30)} ${detail}`);
  add(status, label, detail);
}

function checkGitSafety(loaded: boolean): void {
  line(
    loaded ? 'ok' : 'fail',
    '.env postoji',
    loaded ? 'ucitan iz korena repozitorijuma' : 'nije pronadjen — kopiraj .env.example u .env',
  );

  const gitignore = join(repoRoot, '.gitignore');
  const ignoresEnv = existsSync(gitignore)
    ? readFileSync(gitignore, 'utf8')
        .split('\n')
        .some((row) => row.trim() === '.env')
    : false;
  line(
    ignoresEnv ? 'ok' : 'fail',
    '.env je u .gitignore',
    ignoresEnv ? 'git ga ignorise' : 'DODAJ GA ODMAH — repo je javan',
  );

  line(
    isTrackedByGit('.env') ? 'fail' : 'ok',
    '.env nije u gitu',
    isTrackedByGit('.env') ? 'PRACEN JE — ukloni ga iz indeksa odmah' : 'nije praceni fajl',
  );

  const exampleHasSecrets = hasFilledValues(join(repoRoot, '.env.example'));
  line(
    exampleHasSecrets ? 'fail' : 'ok',
    '.env.example bez tajni',
    exampleHasSecrets
      ? 'IMA POPUNJENE VREDNOSTI — taj fajl se commit-uje, isprazni ga'
      : 'samo prazni placeholderi',
  );
}

function isTrackedByGit(relativePath: string): boolean {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', relativePath], {
      cwd: repoRoot,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

/** Da li u fajlu ima vrednosti koje lice na pravu tajnu (a ne na placeholder). */
function hasFilledValues(path: string): boolean {
  if (!existsSync(path)) return false;

  return readFileSync(path, 'utf8')
    .split('\n')
    .some((row) => {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(row.trim());
      const value = match?.[2]?.trim();
      if (!value || value.length < 20) return false;
      return (
        /^(sk-ant-|eyJ|sb_secret_|sb_publishable_)/.test(value) || /^\d+:[\w-]{30,}$/.test(value)
      );
    });
}

function checkEnvVars(): number {
  let missingRequired = 0;

  for (const spec of ENV_SPECS) {
    const value = process.env[spec.name]?.trim();

    if (!value) {
      if (spec.required) missingRequired += 1;
      line(
        spec.required ? 'fail' : 'skip',
        spec.name,
        spec.required ? `nije postavljena — ${spec.description}` : `nije postavljena (opciono)`,
      );
      continue;
    }

    const problem = spec.validate?.(value) ?? null;
    line(problem ? 'fail' : 'ok', spec.name, problem ?? describeValue(spec, value));
  }

  return missingRequired;
}

function describeValue(spec: EnvVarSpec, value: string): string {
  if (spec.name.startsWith('SUPABASE_') && spec.name.endsWith('_KEY')) {
    const shape = describeSupabaseKey(value);
    return `postavljena · ${shape.format}, role=${shape.role ?? 'nepoznato'}, ${shape.length} znakova`;
  }
  if (spec.name === 'SUPABASE_URL' || spec.name === 'NEXT_PUBLIC_SITE_URL') {
    return `postavljena · ${new URL(value).host}`;
  }
  if (spec.name === 'LOG_LEVEL') return `postavljena · ${value}`;
  return `postavljena · ${value.length} znakova`;
}

async function checkSupabase(): Promise<void> {
  const url = process.env['SUPABASE_URL']?.trim();
  const anon = process.env['SUPABASE_ANON_KEY']?.trim();
  const service = process.env['SUPABASE_SERVICE_ROLE_KEY']?.trim();

  if (!url || !anon || !service) {
    line('skip', 'Supabase konekcija', 'nedostaju podaci za povezivanje');
    return;
  }

  // Koren `/rest/v1/` je namerno dostupan samo service_role kljucu, pa se anon
  // kljuc proverava upitom nad tabelom.
  await pingSupabase('Supabase (anon kljuc)', url, anon, 'tabela');
  await pingSupabase('Supabase (service kljuc)', url, service, 'koren');

  // Projekat iz URL-a mora da odgovara projektu upisanom u kljuc.
  const ref = describeSupabaseKey(service).projectRef;
  if (ref) {
    const matches = new URL(url).host.startsWith(`${ref}.`);
    line(
      matches ? 'ok' : 'fail',
      'kljuc i URL isti projekat',
      matches ? 'odgovaraju' : 'kljuc pripada drugom Supabase projektu nego SUPABASE_URL',
    );
  }
}

async function pingSupabase(
  label: string,
  url: string,
  key: string,
  probe: 'koren' | 'tabela',
): Promise<void> {
  const path =
    probe === 'koren' ? '/rest/v1/' : '/rest/v1/ainovine_provera_kljuca?select=id&limit=1';

  try {
    const response = await fetch(`${url.replace(/\/+$/, '')}${path}`, {
      headers: { apikey: key, authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15_000),
    });
    const body = await response.text();

    if (response.ok) {
      line('ok', label, `veza radi (HTTP ${response.status})`);
      return;
    }

    // PGRST205 = PostgREST je prihvatio kljuc, samo tabela ne postoji.
    // To je uredan ishod dok se sema ne napravi u Fazi 2.
    if (response.status === 404 && body.includes('PGRST205')) {
      line('ok', label, 'kljuc vazi (tabela jos ne postoji — ocekivano pre Faze 2)');
      return;
    }

    if (response.status === 401 || response.status === 403) {
      line('fail', label, `kljuc odbijen (HTTP ${response.status})`);
      return;
    }

    line('fail', label, `neocekivan odgovor (HTTP ${response.status})`);
  } catch (error) {
    line('fail', label, `nema veze — ${(error as Error).message}`);
  }
}

async function checkAnthropic(): Promise<void> {
  const key = process.env['ANTHROPIC_API_KEY']?.trim();
  if (!key) {
    line('skip', 'Anthropic API', 'kljuc nije postavljen');
    return;
  }

  try {
    // `models.list` je besplatan GET poziv — ne trosi tokene.
    const models = await client().models.list({ limit: 3 });
    line('ok', 'Anthropic API', `kljuc vazi · dostupno modela u odgovoru: ${models.data.length}`);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      line('fail', 'Anthropic API', 'kljuc je odbijen (401)');
    } else if (error instanceof Anthropic.APIError) {
      line('fail', 'Anthropic API', `greska ${error.status ?? ''} ${error.message}`.trim());
    } else {
      line('fail', 'Anthropic API', `nema veze — ${(error as Error).message}`);
    }
  }
}

function client(): Anthropic {
  return new Anthropic({ maxRetries: 1, timeout: 20_000 });
}

async function checkTelegram(): Promise<void> {
  const token = process.env['TELEGRAM_BOT_TOKEN']?.trim();
  if (!token) {
    line('skip', 'Telegram bot', 'token nije postavljen (Faza 7)');
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(15_000),
    });
    const payload = (await response.json()) as {
      ok: boolean;
      result?: { username?: string };
      description?: string;
    };

    if (payload.ok && payload.result?.username) {
      line('ok', 'Telegram bot', `token vazi · @${payload.result.username}`);
    } else {
      line('fail', 'Telegram bot', payload.description ?? `HTTP ${response.status}`);
    }
  } catch (error) {
    line('fail', 'Telegram bot', `nema veze — ${(error as Error).message}`);
  }
}
