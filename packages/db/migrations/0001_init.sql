-- 0001_init — osnovne tabele za Engine 1 (Faza 2).
--
-- Pokreni kroz `npm run pipeline -- migrate`, ili rucno u Supabase dashboard-u:
-- SQL Editor → New query → nalepi ovaj fajl → Run.
--
-- Sve tabele imaju ukljucen RLS bez ijedne politike za anonimne posetioce.
-- To znaci: sajt i browser ne mogu da procitaju nista odavde, a pipeline moze,
-- jer `service_role` kljuc zaobilazi RLS. Politike za javno citanje clanaka
-- dolaze u Fazi 9, uz tabelu `articles`.

-- ─────────────────────────────────────────────────────────────────────────────
-- sources — ogledalo config/sources.json u bazi, plus stanje prekidaca
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.sources (
  id                    text primary key,
  name                  text        not null,
  angle                 text        not null check (angle in ('provladin', 'kriticki', 'mejnstrim', 'agencija')),
  homepage              text        not null,
  enabled               boolean     not null default true,
  -- Prekidac iz brief-a, sekcija 3: tri uzastopna neuspeha gase izvor na 6 sati.
  consecutive_failures  integer     not null default 0,
  disabled_until        timestamptz,
  last_error            text,
  last_success_at       timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.sources is 'Izvori vesti; izvorna istina je config/sources.json, ovde se cuva stanje dohvatanja.';
comment on column public.sources.disabled_until is 'Dok je u buducnosti, izvor se preskace (prekidac posle 3 uzastopna neuspeha).';

-- ─────────────────────────────────────────────────────────────────────────────
-- fetch_state — uslovni GET po URL-u (ETag / Last-Modified)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.fetch_state (
  url               text primary key,
  source_id         text        references public.sources(id) on delete cascade,
  etag              text,
  last_modified     text,
  last_status       integer,
  last_fetched_at   timestamptz,
  last_changed_at   timestamptz,
  updated_at        timestamptz not null default now()
);

comment on table public.fetch_state is 'Pamti ETag i Last-Modified da se nepromenjeni feed ne preuzima ponovo.';

-- ─────────────────────────────────────────────────────────────────────────────
-- raw_items — sirovi clanci sa izvora; brisu se posle 10 dana (sweep)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.raw_items (
  id             uuid        primary key default gen_random_uuid(),
  source_id      text        not null references public.sources(id) on delete cascade,
  url            text        not null,
  canonical_url  text,
  -- sha256 normalizovanog URL-a: bez utm parametara, bez zavrsne kose crte, mala slova.
  url_hash       text        not null,
  -- sha256 normalizovanog naslova i teksta: hvata isti clanak objavljen na dva URL-a.
  content_hash   text        not null,
  title          text        not null,
  summary        text,
  content        text,
  word_count     integer     not null default 0,
  author         text,
  image_url      text,
  language       text,
  published_at   timestamptz,
  fetched_at     timestamptz not null default now(),
  -- readability = tekst izvucen sa stranice, feed = samo ono sto je feed dao
  extraction     text        not null default 'feed' check (extraction in ('readability', 'feed', 'none')),
  created_at     timestamptz not null default now()
);

-- Isti URL se nikad ne upisuje dvaput.
create unique index if not exists raw_items_url_hash_key on public.raw_items (url_hash);
-- Isti tekst sa istog izvora se ne upisuje dvaput (portal koji prepakuje svoj clanak).
-- Isti tekst sa RAZLICITIH izvora se cuva — to je upravo signal za klasterovanje.
create unique index if not exists raw_items_source_content_key on public.raw_items (source_id, content_hash);
create index if not exists raw_items_published_idx on public.raw_items (published_at desc nulls last);
create index if not exists raw_items_fetched_idx on public.raw_items (fetched_at desc);
create index if not exists raw_items_source_idx on public.raw_items (source_id, fetched_at desc);

comment on table public.raw_items is 'Sirove vesti sa portala. Sweep ih brise posle 10 dana (Supabase free tier je 500 MB).';

-- ─────────────────────────────────────────────────────────────────────────────
-- pipeline_runs — jedan red po pokretanju komande
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.pipeline_runs (
  id           uuid        primary key default gen_random_uuid(),
  command      text        not null check (command in ('discover', 'ingest', 'editorial', 'sweep')),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  ok           boolean,
  stats        jsonb       not null default '{}'::jsonb,
  errors       jsonb       not null default '[]'::jsonb
);

create index if not exists pipeline_runs_started_idx on public.pipeline_runs (started_at desc);

comment on table public.pipeline_runs is 'Dnevnik pokretanja pipeline-a; sweep ga cisti posle 30 dana.';

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — ukljucen svuda, bez politika za anonimne korisnike
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.sources        enable row level security;
alter table public.fetch_state    enable row level security;
alter table public.raw_items      enable row level security;
alter table public.pipeline_runs  enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at se odrzava sam
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sources_touch_updated_at on public.sources;
create trigger sources_touch_updated_at
  before update on public.sources
  for each row execute function public.touch_updated_at();

drop trigger if exists fetch_state_touch_updated_at on public.fetch_state;
create trigger fetch_state_touch_updated_at
  before update on public.fetch_state
  for each row execute function public.touch_updated_at();
