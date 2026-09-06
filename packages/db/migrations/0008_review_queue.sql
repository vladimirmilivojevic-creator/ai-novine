-- 0008_review_queue — ljudsko odobravanje osetljivih clanaka (Faza 7).
--
-- Brief, sekcija 7: clanak o krivicnom postupku, tragediji sa zrtvama ili
-- sudskom procesu ne izlazi sam. Bot ga salje vlasniku na Telegram sa dugmadima
-- „Odobri" i „Odbij". Ako vlasnik ne odgovori u razumnom roku, clanak ostaje
-- draft — cutanje NIJE odobrenje.

create table if not exists public.review_queue (
  id                  uuid        primary key default gen_random_uuid(),
  article_id          uuid        not null references public.articles(id) on delete cascade,
  -- Poruka u Telegramu; po njoj se kasnije menja tekst i sklanjaju dugmad.
  chat_id             text        not null,
  message_id          bigint,
  status              text        not null default 'pending'
                      check (status in ('pending', 'approved', 'rejected', 'expired', 'failed')),
  sent_at             timestamptz not null default now(),
  decided_at          timestamptz,
  -- Ko je pritisnuo dugme; cuva se radi traga, ne radi provere.
  decided_by          text,
  error               text,
  unique (article_id)
);

create index if not exists review_queue_status_idx on public.review_queue (status, sent_at);

comment on table public.review_queue is 'Osetljivi clanci poslati vlasniku na odobrenje preko Telegrama.';

-- Mali kljuc-vrednost za stanje koje nema svoju tabelu. Prvi korisnik je
-- pomeraj Telegram poruka: bez njega bi se isti odgovori citali u krug.
create table if not exists public.app_state (
  key         text        primary key,
  value       jsonb       not null,
  updated_at  timestamptz not null default now()
);

comment on table public.app_state is 'Sitno stanje pipeline-a; npr. pomeraj poslednje procitane Telegram poruke.';

alter table public.review_queue enable row level security;
alter table public.app_state    enable row level security;

drop trigger if exists app_state_touch_updated_at on public.app_state;
create trigger app_state_touch_updated_at
  before update on public.app_state
  for each row execute function public.touch_updated_at();
