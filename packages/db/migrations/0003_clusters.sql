-- 0003_clusters — teme (Engine 2, Faza 4).
--
-- Klaster je grupa sirovih vesti o istom dogadjaju. Grupisanje je leksicko,
-- bez ijednog AI poziva — model se poziva tek na temu koja prodje kapije
-- kvaliteta, sto je najveca usteda u celom sistemu.

create table if not exists public.clusters (
  id                uuid        primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- Vreme prvog i poslednjeg teksta u temi; koristi se za brzinu rasta.
  first_item_at     timestamptz,
  last_item_at      timestamptz,
  size              integer     not null default 0,
  distinct_sources  integer     not null default 0,
  angles            text[]      not null default '{}',
  keywords          text[]      not null default '{}',
  entities          text[]      not null default '{}',
  -- Centroid teme: koren reci → tezina. Sluzi da se u sledecem ciklusu nova
  -- vest uporedi sa temom bez ucitavanja svih njenih tekstova.
  centroid          jsonb       not null default '{}'::jsonb,
  trending_score    numeric     not null default 0,
  title_sample      text,
  status            text        not null default 'open'
                    check (status in ('open', 'covered', 'rejected')),
  article_id        uuid
);

create index if not exists clusters_updated_idx  on public.clusters (updated_at desc);
create index if not exists clusters_trending_idx on public.clusters (trending_score desc);
create index if not exists clusters_status_idx   on public.clusters (status, last_item_at desc);

comment on table public.clusters is 'Teme: grupe sirovih vesti o istom dogadjaju.';
comment on column public.clusters.centroid is 'Prosecni TF-IDF vektor teme, za poredjenje u sledecem ciklusu.';

create table if not exists public.cluster_items (
  cluster_id   uuid        not null references public.clusters(id)  on delete cascade,
  raw_item_id  uuid        not null references public.raw_items(id) on delete cascade,
  similarity   numeric,
  added_at     timestamptz not null default now(),
  primary key (cluster_id, raw_item_id)
);

create index if not exists cluster_items_item_idx on public.cluster_items (raw_item_id);

comment on table public.cluster_items is 'Veza tema ↔ sirova vest. Brisanjem sirove vesti (sweep) veza nestaje sama.';

alter table public.clusters      enable row level security;
alter table public.cluster_items enable row level security;

drop trigger if exists clusters_touch_updated_at on public.clusters;
create trigger clusters_touch_updated_at
  before update on public.clusters
  for each row execute function public.touch_updated_at();
