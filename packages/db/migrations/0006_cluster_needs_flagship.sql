-- 0006_cluster_needs_flagship — tema koju jeftiniji model nije uspeo da napise.
--
-- U neposrednom pozivu se od modela odmah trazi dopuna teksta. U asinhronom
-- paketu to nije moguce — odgovor stize kad stigne. Zato se tema koja je dosla
-- kraca od praga oznacava, pa je u sledecem paketu preuzima jaci model.

alter table public.clusters
  add column if not exists needs_flagship boolean not null default false;

comment on column public.clusters.needs_flagship is
  'Jeftiniji model nije dostigao potrebnu duzinu; sledeci pokusaj ide jacim modelom.';
