-- 0004_articles — generisani clanci (Faza 5).
--
-- Clanci se, za razliku od sirovih vesti, NE brisu. Mali su, i oni su proizvod
-- sistema. Sirove vesti iz kojih su nastali nestaju posle 10 dana; clanak i
-- podatak o tome koliko je kostao ostaju.

create table if not exists public.articles (
  id             uuid        primary key default gen_random_uuid(),
  cluster_id     uuid        references public.clusters(id) on delete set null,
  slug           text        not null unique,
  title          text        not null,
  lead           text        not null,
  body           text        not null,
  category       text        not null
                 check (category in ('politika', 'ekonomija', 'drustvo', 'sport', 'region', 'svet')),
  status         text        not null default 'draft'
                 check (status in ('draft', 'pending_review', 'published', 'rejected')),
  -- Osetljiv clanak ceka ljudsko odobrenje (brief, sekcija 7). U Fazi 5 se samo
  -- oznacava; Telegram dolazi u Fazi 7.
  sensitive      boolean     not null default false,
  sensitivity_reason text,
  -- Prikaz „obe strane" — dva panela sa generickim oznakama ugla, nikad sa
  -- imenom medija (brief, sekcija 5).
  both_sides     jsonb,
  sources_diverge boolean    not null default false,
  keywords       text[]      not null default '{}',
  notes          text[]      not null default '{}',
  word_count     integer     not null default 0,
  model          text        not null,
  -- Potroseni tokeni i procenjen trosak u dolarima, po clanku.
  usage          jsonb       not null default '{}'::jsonb,
  cost_usd       numeric(10, 6) not null default 0,
  published_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists articles_status_idx    on public.articles (status, published_at desc);
create index if not exists articles_category_idx  on public.articles (category, published_at desc);
create index if not exists articles_cluster_idx   on public.articles (cluster_id);
create index if not exists articles_created_idx   on public.articles (created_at desc);

comment on table public.articles is 'Generisani clanci. Ne brisu se — sirove vesti nestaju, clanci ostaju.';
comment on column public.articles.cost_usd is 'Procenjen trosak poziva modela, radi pracenja mesecnog racuna.';

-- Izmene clanka: Faza 6 dopunjava postojeci clanak umesto da pravi novi.
create table if not exists public.article_revisions (
  id          uuid        primary key default gen_random_uuid(),
  article_id  uuid        not null references public.articles(id) on delete cascade,
  revision    integer     not null,
  title       text        not null,
  lead        text        not null,
  body        text        not null,
  reason      text,
  model       text,
  usage       jsonb       not null default '{}'::jsonb,
  cost_usd    numeric(10, 6) not null default 0,
  created_at  timestamptz not null default now(),
  unique (article_id, revision)
);

create index if not exists article_revisions_article_idx on public.article_revisions (article_id, revision desc);

comment on table public.article_revisions is 'Istorija izmena clanka (Faza 6 — azuriranje umesto dupliranja).';

alter table public.articles          enable row level security;
alter table public.article_revisions enable row level security;

drop trigger if exists articles_touch_updated_at on public.articles;
create trigger articles_touch_updated_at
  before update on public.articles
  for each row execute function public.touch_updated_at();
