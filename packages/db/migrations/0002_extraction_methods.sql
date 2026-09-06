-- 0002_extraction_methods — prosiruje dozvoljene nacine izvlacenja teksta.
--
-- Readability ume da promasi telo clanka i uzme blok „povezane vesti".
-- Zato ingest sada ima jos dva pokusaja: `articleBody` iz JSON-LD podataka i
-- tekst iz poznatih kontejnera clanka. Kolona pamti koji je pokusaj uspeo,
-- da se po izvorima vidi gde Readability ne radi posao.

alter table public.raw_items
  drop constraint if exists raw_items_extraction_check;

alter table public.raw_items
  add constraint raw_items_extraction_check
  check (extraction in ('readability', 'jsonld', 'container', 'feed', 'none'));
