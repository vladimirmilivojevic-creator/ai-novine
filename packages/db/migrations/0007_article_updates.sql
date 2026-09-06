-- 0007_article_updates — azuriranje postojeceg clanka umesto novog (Faza 6).
--
-- Brief, sekcija 5: ako je tema vec pokrivena pre nekoliko sati, clanak se
-- DOPUNJUJE, a ne pise iznova. To je istovremeno najvaznija SEO zastita
-- (sekcija 9) i odbrana kvaliteta — cetiri skoro identicna clanka o istoj
-- prici su tacno ono sto Google „Scaled Content Abuse" politika kaznjava.

alter table public.articles
  add column if not exists revision integer not null default 1,
  add column if not exists last_update_at timestamptz;

comment on column public.articles.revision is 'Broj verzije; 1 je prvo pisanje, svaka dopuna podize broj.';
comment on column public.articles.last_update_at is 'Kada je clanak poslednji put dopunjen novim izvestajima.';

-- Tema koja je pokrivena clankom i dalje prima nove vesti; te vesti pokrecu
-- dopunu. Indeks ubrzava trazenje takvih tema.
create index if not exists clusters_covered_idx
  on public.clusters (status, last_item_at desc)
  where article_id is not null;
