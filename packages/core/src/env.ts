import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './paths.js';

/**
 * Ucitava `.env` iz korena repozitorijuma, ako postoji. Node 22 to ume sam,
 * bez `dotenv` paketa. Vrednosti koje su vec u okruzenju (GitHub Actions,
 * Vercel) imaju prednost i ne prepisuju se.
 */
export function loadDotEnv(): boolean {
  const path = join(repoRoot, '.env');
  if (!existsSync(path)) return false;

  process.loadEnvFile(path);

  // `loadEnvFile` prepisuje postojece vrednosti; vrati one koje su vec bile
  // postavljene spolja, jer su u produkciji one merodavne.
  for (const [key, value] of originalEnv) process.env[key] = value;
  return true;
}

/** Snimak okruzenja pre nego sto je `.env` ucitan. */
const originalEnv = new Map(Object.entries(process.env));

export type EnvPhase = 'baza' | 'ai' | 'telegram' | 'sajt' | 'opciono';

export interface EnvVarSpec {
  name: string;
  phase: EnvPhase;
  /** Bez ovoga pipeline ne radi. */
  required: boolean;
  description: string;
  /** Vraca opis problema ako oblik vrednosti ne valja, inace `null`. */
  validate?: (value: string) => string | null;
}

export const ENV_SPECS: EnvVarSpec[] = [
  {
    name: 'SUPABASE_URL',
    phase: 'baza',
    required: true,
    description: 'adresa Supabase projekta',
    validate: (value) =>
      URL.canParse(value) && value.includes('.supabase.')
        ? null
        : 'ocekuje se adresa oblika https://<projekat>.supabase.co',
  },
  {
    name: 'SUPABASE_ANON_KEY',
    phase: 'baza',
    required: true,
    description: 'javni kljuc za citanje objavljenog sadrzaja',
    validate: (value) => expectSupabaseKey(value, 'anon'),
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    phase: 'baza',
    required: true,
    description: 'kljuc pipeline-a, zaobilazi RLS',
    validate: (value) => expectSupabaseKey(value, 'service_role'),
  },
  {
    name: 'SUPABASE_DB_URL',
    phase: 'baza',
    required: false,
    description: 'direktna Postgres veza — treba samo za migracije (npm run pipeline -- migrate)',
    validate: (value) =>
      value.startsWith('postgres://') || value.startsWith('postgresql://')
        ? null
        : 'ocekuje se postgresql:// veza iz Supabase dashboard-a (Connect → Session pooler)',
  },
  {
    name: 'ANTHROPIC_API_KEY',
    phase: 'ai',
    required: true,
    description: 'kljuc za generisanje clanaka',
    validate: (value) =>
      value.startsWith('sk-ant-') ? null : 'Anthropic kljuc pocinje sa "sk-ant-"',
  },
  {
    name: 'TELEGRAM_BOT_TOKEN',
    phase: 'telegram',
    required: false,
    description: 'bot koji salje osetljive drafove na odobrenje',
    validate: (value) =>
      /^\d+:[A-Za-z0-9_-]{30,}$/.test(value) ? null : 'ocekuje se oblik <broj>:<niz znakova>',
  },
  {
    name: 'TELEGRAM_CHAT_ID',
    phase: 'telegram',
    required: false,
    description: 'chat u koji bot salje poruke',
    validate: (value) => (/^-?\d+$/.test(value) ? null : 'ocekuje se ceo broj'),
  },
  {
    name: 'TELEGRAM_WEBHOOK_SECRET',
    phase: 'telegram',
    required: false,
    description: 'tajna koju Telegram vraca u zaglavlju webhook zahteva',
    validate: (value) => (value.length >= 12 ? null : 'prekratka — najmanje 12 znakova, nasumicno'),
  },
  {
    name: 'NEXT_PUBLIC_SITE_URL',
    phase: 'sajt',
    required: false,
    description: 'adresa sajta, koristi se u sitemap-u i OG tagovima',
    validate: (value) => (URL.canParse(value) ? null : 'nije validan URL'),
  },
  {
    name: 'LOG_LEVEL',
    phase: 'opciono',
    required: false,
    description: 'debug | info | warn | error',
    validate: (value) =>
      ['debug', 'info', 'warn', 'error'].includes(value)
        ? null
        : 'dozvoljeno: debug, info, warn, error',
  },
];

/** Podaci o kljucu koji se smeju ispisati — nikad sama vrednost. */
export interface KeyShape {
  format: 'jwt' | 'sb-kljuc' | 'nepoznat';
  role: string | null;
  projectRef: string | null;
  length: number;
}

export function describeSupabaseKey(value: string): KeyShape {
  const shape: KeyShape = {
    format: 'nepoznat',
    role: null,
    projectRef: null,
    length: value.length,
  };

  if (value.startsWith('sb_publishable_') || value.startsWith('sb_secret_')) {
    shape.format = 'sb-kljuc';
    shape.role = value.startsWith('sb_secret_') ? 'secret' : 'publishable';
    return shape;
  }

  const payload = decodeJwtPayload(value);
  if (payload) {
    shape.format = 'jwt';
    shape.role = typeof payload['role'] === 'string' ? payload['role'] : null;
    shape.projectRef = typeof payload['ref'] === 'string' ? payload['ref'] : null;
  }
  return shape;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;

  try {
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    const parsed: unknown = JSON.parse(json);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function expectSupabaseKey(value: string, expectedRole: 'anon' | 'service_role'): string | null {
  const shape = describeSupabaseKey(value);

  if (shape.format === 'sb-kljuc') {
    const wanted = expectedRole === 'service_role' ? 'secret' : 'publishable';
    return shape.role === wanted
      ? null
      : `ocekivan "sb_${wanted}_" kljuc, a ovo je "${shape.role}"`;
  }

  if (shape.format !== 'jwt') return 'ne lici ni na JWT ni na noviji sb_ kljuc';
  if (shape.role !== expectedRole) {
    return `JWT nosi role="${shape.role ?? 'nepoznato'}", a ocekuje se "${expectedRole}" — kljucevi su verovatno zamenjeni`;
  }
  return null;
}

export function hasEnv(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Nedostaje env varijabla ${name}. Kopiraj .env.example u .env i popuni je (lokalno), ` +
        'ili je dodaj u GitHub Secrets / Vercel env (u produkciji). ' +
        'Proveri stanje sa `npm run pipeline -- doctor`.',
    );
  }
  return value;
}
