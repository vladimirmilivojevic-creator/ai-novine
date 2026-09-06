-- 0009_article_covers — naslovne slike clanaka (Faza 8).
--
-- Slika se ne cuva u bazi nego u Supabase Storage kanti `covers`; ovde stoji
-- samo adresa i koji je sablon iskoriscen. Sablon se pamti da bi se, ako se
-- vizuelni identitet promeni, znalo koje slike treba precrtati.

alter table public.articles
  add column if not exists cover_url     text,
  add column if not exists cover_variant text;

-- Komanda `covers` trazi clanke bez slike; indeks je delimican, pa je mali.
create index if not exists articles_without_cover_idx
  on public.articles (created_at desc)
  where cover_url is null;

comment on column public.articles.cover_url is
  'Javna adresa naslovne slike u Storage kanti covers.';
comment on column public.articles.cover_variant is
  'Rubrika/varijacija sablona kojim je slika nacrtana, npr. politika/traka.';
