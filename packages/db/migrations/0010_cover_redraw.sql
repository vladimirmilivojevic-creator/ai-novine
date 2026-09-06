-- 0010_cover_redraw — kad se clanak dopuni, slika mora da isprati naslov.
--
-- Faza 6 dopunjava postojeci clanak i sme da mu promeni naslov. Bez ovoga bi
-- slika zauvek nosila prvi naslov, pa bi pregled linka na drustvenim mrezama
-- govorio jedno a clanak drugo.
--
-- Pamti se kada je slika nacrtana; komanda `covers` precrta svaku sliku starijU
-- od poslednje dopune. Ime fajla je slug, pa adresa ostaje ista.

alter table public.articles
  add column if not exists cover_at timestamptz;

comment on column public.articles.cover_at is
  'Kada je naslovna slika nacrtana; starija od last_update_at znaci da se precrtava.';
