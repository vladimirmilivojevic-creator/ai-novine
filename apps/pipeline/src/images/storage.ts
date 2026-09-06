import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Čuvanje naslovnih slika u Supabase Storage.
 *
 * Slika ne ide u bazu kao red nego u fajl-skladište, jer baza ima 500 MB a
 * skladište 1 GB, i jer sajt (Faza 9) sliku traži preko adrese, ne upitom.
 * Izmereno: jedna slika je oko 45 KB, deset članaka dnevno je 450 KB dnevno,
 * pa 1 GB traje preko dve godine.
 */

export const COVER_BUCKET = 'covers';

/** Ime fajla je slug članka — čitljivo u adresi i stabilno kroz dopune. */
export function coverPath(slug: string): string {
  return `${slug}.png`;
}

/**
 * Pravi kantu ako ne postoji. Poziva se pri svakom pokretanju jer je jeftino, a
 * čuva od toga da prvi članak posle nove baze ostane bez slike.
 */
export async function ensureCoverBucket(client: SupabaseClient): Promise<void> {
  const { data } = await client.storage.getBucket(COVER_BUCKET);
  if (data) return;

  const { error } = await client.storage.createBucket(COVER_BUCKET, {
    public: true,
    fileSizeLimit: '2MB',
    allowedMimeTypes: ['image/png'],
  });

  // Dva paralelna pokretanja mogu da naprave kantu istovremeno; drugi dobije
  // gresku da vec postoji, sto nije problem.
  if (error && !/exists/i.test(error.message)) {
    throw new Error(`Pravljenje kante ${COVER_BUCKET} nije proslo: ${error.message}`);
  }
}

/**
 * Otprema sliku i vraća javnu adresu.
 *
 * `upsert` je uključen namerno: ponovno crtanje iste slike (recimo posle
 * izmene šablona) treba da prepiše staru, a ne da napravi drugu adresu.
 */
export async function uploadCover(
  client: SupabaseClient,
  slug: string,
  png: Buffer,
): Promise<string> {
  const path = coverPath(slug);

  const { error } = await client.storage
    .from(COVER_BUCKET)
    .upload(path, png, { contentType: 'image/png', upsert: true, cacheControl: '31536000' });
  if (error) throw new Error(`Otpremanje slike ${path} nije proslo: ${error.message}`);

  const { data } = client.storage.from(COVER_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
