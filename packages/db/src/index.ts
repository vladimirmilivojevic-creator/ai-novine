/**
 * Supabase sloj. Sema, migracije i tipovi tabela dolaze u Fazi 2 — ovde je za
 * sada samo kreiranje klijenta, da se sve tajne citaju na jednom mestu.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Nedostaje env varijabla ${name}. Kopiraj .env.example u .env i popuni je (lokalno), ` +
        'ili je dodaj u GitHub Secrets / Vercel env (u produkciji).',
    );
  }
  return value;
}

/**
 * Klijent sa punim pravima — zaobilazi RLS. Koristi ga ISKLJUCIVO pipeline,
 * nikad kod koji se izvrsava u browseru.
 */
export function createServiceClient(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Klijent za citanje javnog sadrzaja (sajt). Ogranicen RLS pravilima. */
export function createPublicClient(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false },
  });
}
