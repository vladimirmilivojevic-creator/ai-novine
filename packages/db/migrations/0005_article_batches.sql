-- 0005_article_batches — asinhroni paketi zahteva ka modelu (Batch API).
--
-- Batch API daje 50% popusta na sve tokene, ali odgovori stizu asinhrono —
-- vecina paketa za manje od sat vremena, najvise 24 sata. Pipeline zato radi u
-- dva koraka: jedan ciklus posalje paket i zavrsi, sledeci pokupi rezultate.
-- Cron na sat vremena time nikad ne ceka.

create table if not exists public.article_batches (
  id             uuid        primary key default gen_random_uuid(),
  -- Identifikator paketa kod Anthropic-a.
  batch_id       text        not null unique,
  model          text        not null,
  status         text        not null default 'submitted'
                 check (status in ('submitted', 'collected', 'failed', 'canceled')),
  request_count  integer     not null default 0,
  -- custom_id → cluster_id, da se odgovor vrati na svoju temu.
  cluster_map    jsonb       not null default '{}'::jsonb,
  submitted_at   timestamptz not null default now(),
  collected_at   timestamptz,
  succeeded      integer     not null default 0,
  failed         integer     not null default 0,
  cost_usd       numeric(10, 6) not null default 0,
  errors         jsonb       not null default '[]'::jsonb
);

create index if not exists article_batches_status_idx on public.article_batches (status, submitted_at);

comment on table public.article_batches is 'Poslati paketi zahteva ka modelu; sledeci ciklus pokupi rezultate.';

alter table public.article_batches enable row level security;
