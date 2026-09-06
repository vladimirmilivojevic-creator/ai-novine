# Stanje projekta

> Ovaj fajl se ažurira na kraju **svake** faze. Sadrži šta je urađeno, koje su odluke donete i
> zašto, šta vlasnik treba da proveri, i status faze. Pun plan je u `docs/plan.md`.

**Poslednje ažuriranje:** 6. septembar 2026.
**Trenutno stanje:** Faza 3 gotova — 636 vesti u bazi sa 24 izvora kroz tri kanala, GitHub Secrets podešeni, zakazani ciklusi uključeni. Faza 4 sledeća.

## Pregled faza

| Faza | Naziv                                | Status              |
| ---- | ------------------------------------ | ------------------- |
| 0    | Priprema i kostur                    | ✅ Gotovo, potvrđeno |
| 1    | RSS discovery izveštaj               | ✅ Gotovo, čeka potvrdu |
| 2    | Engine 1 na 3 test izvora            | ✅ Gotovo, čeka potvrdu |
| 3    | Engine 1 na sve izvore               | ✅ Gotovo, čeka potvrdu |
| 4    | Klasterovanje i trending (Engine 2)  | 🔜 Sledeća          |
| 5    | AI generisanje teksta ⚠️ kritična kapija | ⬜ Čeka          |
| 6    | Ažuriranje umesto dupliranja         | ⬜ Čeka             |
| 7    | Telegram odobravanje                 | ⬜ Čeka             |
| 8    | Slike                                | ⬜ Čeka             |
| 9    | Frontend                             | ⬜ Čeka             |
| 10   | Pravne stranice, komentari, SEO      | ⬜ Čeka             |
| 11   | Deployment i nadzor                  | ⬜ Čeka             |

---

## Faza 0 — Priprema i kostur ✅

**Status:** gotovo, vlasnik potvrdio 6. septembra 2026.
**Commit:** `563dd72`

### Šta je urađeno

Ručno (vlasnik):

- Folder i GitHub repo preimenovani iz `" ai-novine"` u `"ai-novine"` (uklonjen vodeći razmak).
- Repo prebačen na **public** — uslov za neograničene besplatne GitHub Actions minute.

Kodom:

- npm workspaces monorepo: `packages/core`, `packages/db`, `apps/pipeline`.
- TypeScript 5.9 u strict režimu, ESLint 10 (flat config), Prettier, Vitest.
- `config/sources.json` — 26 izvora iz brief-a: ugao (provladin / kritički / mejnstrim /
  agencija), `enabled` prekidač, prazno polje `feeds` koje popunjava Faza 1, i beleške sa
  probnog merenja iz planske faze.
- `config/editorial.json` — kapije kvaliteta, dnevne kvote po kategoriji, pragovi klasterovanja,
  retention, model ID-jevi, pravila osetljivosti.
- `packages/core` — učitavanje konfiguracije kroz zod šeme, logger, tipovi domena.
- `packages/db` — Supabase klijent (service i public); šema i migracije dolaze u Fazi 2.
- `apps/pipeline` — CLI kostur: `config | discover | ingest | editorial | sweep`.
- `.github/workflows/ci.yml` — typecheck, lint, format i testovi na svaki push.
- `README.md` — pravna napomena iz sekcije 8 brief-a (interno, ne objavljuje se na sajtu).
- `docs/` — `brief.md` (premešten sa korena), `plan.md` (odobreni fazni plan), `progress.md`.
- 11 Vitest testova koji čuvaju pravila iz brief-a: kapije ≥3 izvora / ≥2 ugla, korektan
  User-Agent bez glumljenja browsera, poštovanje robots.txt, granica objava dnevno, retention.

### Odluke i razlozi

| Odluka                                      | Zašto                                                                                                                                                    |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript pinovan na **5.9**, ne 7          | TypeScript 7 (native port) je izašao, ali `typescript-eslint` ga još ne podržava (`peerDependencies: typescript >=4.8.4 <6.1.0`). Prelazi se kad alati stignu. |
| **Bez build koraka** — sve kroz `tsx`        | Manje pokretnih delova, kako brief traži. Nema `dist/`, nema sinhronizacije build izlaza; GitHub Actions izvršava `.ts` direktno.                          |
| `moduleResolution: bundler`, `module: preserve` | Izbegava `.js` ekstenzije u NodeNext stilu i konfuziju oko njih. Jednostavnije za održavanje.                                                          |
| Konfiguracija kroz **zod šeme**              | Greška u `config/*.json` puca odmah, sa čitljivom porukom na srpskom, umesto tiho kroz pipeline.                                                          |
| `* text=auto eol=lf` u `.gitattributes`      | Bez toga Prettier lokalno na Windows-u prijavljuje CRLF greške kojih na CI-ju (Linux) nema.                                                                |
| 6 kategorija: politika, ekonomija, društvo, sport, region, svet | Tačno kako brief traži u sekciji 5. Osetljivost je oznaka na članku, ne posebna kategorija.                                             |
| 26 izvora, ne 25                             | Brief nabraja 26 domena. Nijedan nije izbačen unapred — Faza 1 daje podatke, vlasnik odlučuje.                                                             |

### Šta je vlasnik proverio

- `npm run check` — prolazi (typecheck, lint, 11 testova).
- `npm run pipeline -- config` — ispisuje 26 izvora, 6 kategorija, model ID-jeve.
- GitHub Settings → Danger Zone: repo je **public**. ✅
- `README.md` pravna napomena: odgovara stvarnosti. ✅
- `config/sources.json`: lista izvora kompletna, ništa se ne izbacuje pre Faze 1. ✅

### Otvoreno / za kasnije

- Prelazak na TypeScript 7 kad `typescript-eslint` doda podršku.
- `apps/web` još ne postoji — pravi se u Fazi 9.

---

## Okruženje i ključevi ✅

**Status:** podešeno i provereno 6. septembra 2026.

`npm run pipeline -- doctor` proverava okruženje i ispisuje samo ✅/❌ — nijedna vrednost ključa se
ne ispisuje, samo osobine koje nisu tajna (format, uloga iz JWT-a, dužina).

Šta proverava:

- **Bezbednost:** da `.env` postoji, da je u `.gitignore`, da nikad nije ušao u git, i da
  `.env.example` ne sadrži prave vrednosti.
- **Env varijable:** prisustvo i oblik svake (Supabase JWT mora nositi očekivani `role`, Anthropic
  ključ počinje sa `sk-ant-`, Telegram token ima oblik `<broj>:<niz>`).
- **Konekcije:** Supabase anon i service ključ, Anthropic (`models.list` — besplatan GET, ne troši
  tokene), Telegram (`getMe`).

Rezultat prve provere: **18 od 18 stavki u redu.**

### Incident: prave vrednosti su bile upisane u `.env.example`

Vlasnik je ključeve prvo upisao u `.env.example`, koji **jeste** praćen gitom. Nije bilo commit-a
ni push-a, pa ništa nije procurelo. Vrednosti su premeštene u `.env`, `.env.example` vraćen na
placeholdere, a `doctor` je od tada zadužen da isti previd uhvati automatski.

### Otvoreno

- `TELEGRAM_WEBHOOK_SECRET` je trenutno predvidiv string. Pre nego što webhook izađe u produkciju
  (Faza 7 i 11), zameniti ga nasumičnim nizom od najmanje 32 znaka.
- Anon i service ključ su u starom JWT formatu (`eyJ…`). Supabase je uveo noviji format
  (`sb_publishable_…` / `sb_secret_…`); `doctor` prihvata oba, prelazak nije hitan.

---

## Faza 1 — RSS discovery izveštaj ✅

**Status:** gotovo, čeka potvrdu vlasnika (koje izvore izbacujemo).
**Izveštaj:** `reports/rss-discovery.md` (i `reports/rss-discovery.json` za mašinsku obradu).

### Šta je urađeno

- `npm run pipeline -- discover` proverava svih 26 domena: `robots.txt` → `<link rel="alternate">`
  u HTML-u početne strane → standardne RSS putanje (`/feed`, `/rss`, `/rss.xml`, `/feed/rss2`,
  `/atom.xml`, `/index.xml`, `/?feed=rss2`) → `sitemap.xml` i sitemap-ovi koje `robots.txt`
  prijavljuje, uključujući jedan nivo dece sitemap indeksa.
- Svaki kandidat se stvarno preuzima i parsira. Sajt koji na `/feed` vrati HTML stranu ne računa
  se kao RSS — a takvih je bilo šest.
- Zajednički HTTP sloj u `packages/core`: korektan User-Agent, timeout, najviše jedan zahtev u
  sekundi po domenu (redosled po domenu, paralelno između domena), gzip i `charset` dekodiranje.
- Poštovanje `robots.txt` preko `robots-parser`, sa kešom po originu.
- Parser feed-ova (RSS 2.0, Atom, RDF) u `packages/core/src/feed.ts` — koristi se ponovo u Fazi 2.
- Opcija `--apply` upisuje pronađene feed-ove u `config/sources.json`.
- 31 test ukupno (20 novih za feed parser, HTML ekstrakciju i izbor feed-ova).

### Rezultat

| Ishod | Broj | Izvori |
| --- | --- | --- |
| RSS radi | 16 | Pink, Kurir, Happy TV, Srbija Danas, N1, Nova, Danas, Vreme, Insajder, Južne vesti, KRIK, Cenzolovka, Telegraf, Mondo, B92, Beta |
| Bez RSS-a, ima news sitemap | 5 | Informer, Alo, Večernje novosti, Blic, Tanjug |
| Bez RSS-a i bez sitemap-a | 4 | Prva, BIRN, RTS, Euronews Srbija |
| Blokira botove | 1 | Politika |

Po uglovima: provladin 4 RSS + 3 sitemap + 1 scrape + 1 blokiran, kritički 8 RSS + 1 scrape,
mejnstrim 3 RSS + 1 sitemap + 2 scrape, agencije 1 RSS + 1 sitemap. Kapija „najmanje dva različita
ugla" ima pokriće u svakoj grupi.

### Odluke i razlozi

| Odluka | Zašto |
| --- | --- |
| News sitemap je ravnopravan izvor, ne nužno zlo | Uredan XML sa svežim člancima i vremenom objave. Bolji je od scraping-a i za Informer, Alo, Novosti, Blic i Tanjug rešava problem bez ijedne HTML heuristike. |
| Najviše 5 feed-ova po izvoru | Kurir nudi 22, Mondo 28 feed-ova (glavni plus po jedan za svaku rubriku). Svi zajedno su višestruko veći saobraćaj ka istom sajtu za skoro isti sadržaj. Bira se najplići URL (glavni feed), pa oni sa najviše stavki. |
| WordPress `/comments/feed/` se izbacuje | To su komentari čitalaca, ne vesti. Ušli su kod pet izvora dok filter nije dodat. |
| Politika se ne zaobilazi | Odbija i sam `robots.txt` sa HTTP 403. Probijanje Cloudflare zaštite je kršenje uslova korišćenja i ne radi se. |
| Tanjug NIJE blokiran | U planskoj fazi je vraćao 403; u ovoj proveri `robots.txt` radi i news sitemap sa 420 unosa je dostupan. Ostaje u igri. |
| Prazan news sitemap ne računa se kao pokriće | Vreme ima `sitemap-news.xml` sa nula unosa. |

### Tri greške nađene i popravljene tokom faze

1. **HTML autodiscovery je bio mrtav.** U regularni izraz se, kroz automatsku izmenu fajla,
   upisao pravi backspace bajt (0x08) umesto dva znaka `\b`. Funkcija je tiho vraćala praznu
   listu na svakom sajtu. Uhvatio ga je tek jedinični test sa fiksnim HTML uzorkom. Posle
   popravke Pink i Mondo dobijaju RSS koji ranije nije nađen.
2. **Zabranjeni URL je gutao dozvoljenu varijantu.** `robots.txt` sajta Vreme zabranjuje
   `/feed/`, ali dozvoljava `/feed`. Pošto se u evidenciji već proverenih URL-ova čuva putanja
   bez završne kose crte, zabranjeni URL je zauzimao mesto dozvoljenom i Vreme je ispadalo bez
   RSS-a. Provera `robots.txt` sada ide pre upisa u evidenciju.
3. **Gzipovani sitemap-ovi su čitani kao smeće.** Blic servira news sitemap kao `.gz`. HTTP sloj
   sada raspakuje gzip po magičnim bajtovima i poštuje `charset` iz zaglavlja.

### Šta vlasnik proverava

1. Pročita `reports/rss-discovery.md` — pre svega tabelu „Svi izvori".
2. Odluči šta sa četiri izvora bez RSS-a i bez sitemap-a (Prva, BIRN, RTS, Euronews Srbija):
   scraping po predlogu iz izveštaja, ili izbacivanje.
3. Odluči šta sa Politikom (blokira botove).
4. Pogleda `git diff config/sources.json` — 16 izvora je dobilo `feeds` polje.

---

## Faza 2 — Engine 1 na tri test izvora ✅

**Status:** gotovo, čeka potvrdu vlasnika (pregled tabele `raw_items` u Supabase Table Editor-u).
**Test izvori:** N1 i Danas (kritički ugao), Kurir (provladin ugao).

### Šta je urađeno

- **Šema u bazi** (`packages/db/migrations/`): `sources`, `fetch_state`, `raw_items`,
  `pipeline_runs`, plus `schema_migrations` koju vodi sam pokretač. RLS je uključen na svim
  tabelama, bez ijedne politike za anonimne posetioce — sajt ne može da čita sirove vesti, a
  pipeline može, jer `service_role` ključ zaobilazi RLS.
- **Pokretač migracija** (`npm run pipeline -- migrate`): primenjuje samo ono što nije primenjeno,
  svaku migraciju u sopstvenoj transakciji. Ako `SUPABASE_DB_URL` nije postavljen, ispisuje tačne
  korake za ručnu primenu kroz dashboard.
- **`ingest` komanda**: uslovni GET (ETag / Last-Modified) → parsiranje feeda → odbacivanje URL-ova
  koji su već u bazi → otvaranje stranice članka → izvlačenje teksta → upis. Prekidač gasi izvor
  posle tri uzastopna neuspeha.
- **Izvlačenje teksta u tri pokušaja**: Readability, pa `articleBody` iz JSON-LD podataka, pa tekst
  iz poznatih kontejnera članka (`div.post-content`, `.entry-content`, `[itemprop="articleBody"]`…).
  Uzima se prvi koji da najmanje 60 reči.
- **Deduplikacija na dva nivoa**: `url_hash` jedinstven globalno, `(source_id, content_hash)`
  jedinstven po izvoru.

### Rezultat dva ciklusa

| Mera | Vrednost |
| --- | --- |
| Redova u `raw_items` | 148 (N1 50, Kurir 50, Danas 48) |
| Način izvlačenja | 140 Readability, 7 kontejner, 1 samo feed |
| Medijana dužine teksta | 252–385 reči po izvoru |
| Grešaka | 0 |
| Trajanje ciklusa | 33–43 sekunde za tri izvora |

Drugi ciklus je uzeo sledećih 25 članaka po izvoru iz istog feeda — prvih 25 je prepoznao kao već
poznate i preskočio ih pre nego što je otvorio ijednu stranicu. To je dokaz da deduplikacija radi.

### Odluke i razlozi

| Odluka | Zašto |
| --- | --- |
| Provera „imamo li već ovaj URL" ide **pre** otvaranja stranice članka | Feed daje 50–100 stavki po ciklusu. Bez toga bi se svakih 20 minuta ponovo skidalo istih 50 stranica sa svakog portala. |
| Isti tekst sa **različitih** izvora se čuva | To je upravo signal za klasterovanje u Fazi 4. Duplikat je samo isti tekst sa **istog** izvora. |
| Ručni parser `postgresql://` veze | Lozinka sme da sadrži `@`, `/` i `?`. Standardni parseri preseku string na prvom takvom znaku i pokušaju vezu ka pogrešnom serveru. Parser traži **poslednji** `@` — radi i sa doslovnim `@` i sa `%40`. |
| Tri pokušaja izvlačenja teksta umesto samo Readability-ja | Na dva Danasova članka Readability je uzeo blok „povezane vesti" umesto tela članka — isti pogrešan tekst za dva različita URL-a. Prag od 60 reči ga je odbio, a rezervni put je izvukao pravi tekst. Sedam članaka od 148 danas prolazi baš tim putem. |
| Kratke vesti se čuvaju | Vest od 97 reči je stvarna vest. Odbacivanje po dužini radi se kasnije, u uredničkim kapijama Faze 5 (najmanje 350 reči za objavu), ne pri prikupljanju. |

### Otvoreno

- **SSL do baze ne proverava sertifikat.** Supabase pooler šalje lanac koji Node ne prepoznaje
  („self-signed certificate in certificate chain"), pa pokretač migracija prelazi na šifrovanu vezu
  bez provere identiteta servera i to javno upozori. Rešenje je preuzeti Supabase CA sertifikat i
  pinovati ga — uraditi pre produkcije (Faza 11).
- **Uslovni GET radi samo kod Danasa.** Kurir i N1 ne šalju `ETag` ni `Last-Modified`, pa se njihov
  feed preuzima svaki put. Feed je ~50 KB, trošak je zanemarljiv.
- **Sitne stavke ulaze u bazu** (npr. „Dnevnik u 19" sa 7 reči, kvizovi). Ne smetaju: kapije Faze 4
  i 5 traže najmanje tri izvora i 350 reči.
- Odluka o izvorima iz Faze 1 (Politika, Prva, BIRN, RTS, Euronews) i dalje čeka — blokira samo
  scraping deo Faze 3.

### Šta vlasnik proverava

1. Supabase dashboard → **Table Editor** → tabela `raw_items`. Treba da vidi 148 redova sa pravim
   naslovima, tekstom i vremenom objave.
2. Tabela `sources` → 26 redova, kolone `consecutive_failures` na 0 i `disabled_until` prazne.
3. Tabela `pipeline_runs` → dva reda sa `ok = true`.

---

## Faza 3 — Engine 1 na sve izvore ✅

**Status:** gotovo, čeka potvrdu vlasnika.

### Šta je urađeno

- **News sitemap kao ravnopravan kanal.** Pet izvora bez RSS-a (Informer, Alo, Večernje novosti,
  Blic, Tanjug) prikuplja se iz `news` sitemap-a — uredan XML sa adresom, naslovom i vremenom
  objave. Bolje od scraping-a HTML-a i ne traži nijednu heuristiku po sajtu.
- **Redosled kanala:** RSS prvi; sitemap ulazi kad izvor nema feed **ili kad feed tog ciklusa nije
  dao ništa**. Pad jednog kanala tako ne gasi izvor.
- **`sweep` komanda** briše sirove vesti starije od 10 dana i zapise o pokretanjima starije od 30
  (pragovi su u `config/editorial.json`). `--dry-run` prikazuje stanje bez brisanja.
- **Dva GitHub Actions workflow-a:** `ingest.yml` na `*/20`, `sweep.yml` dnevno u 3h. Oba imaju
  `concurrency` grupu, pa se dva ciklusa nikad ne preklapaju, i `workflow_dispatch` za ručno
  pokretanje.
- **Logovi su čitljiv tekst i u CI-ju.** JSON se dobija samo sa `LOG_FORMAT=json`.

### Rezultat punog ciklusa (21 izvor)

| Mera | Vrednost |
| --- | --- |
| Redova u `raw_items` | 418 |
| Izvora sa podacima | 21 (16 preko RSS-a, 5 preko sitemap-a) |
| Pun tekst izvučen | 411 od 418 |
| Grešaka | 5 (četiri HTTP 403 na Srbija Danas, jedan 404 na Telegrafu) |
| Trajanje | 87 sekundi za 21 izvor |

Po uglu: kritički 178, provladin 155, mejnstrim 60, agencije 25. Sva četiri ugla imaju pokriće,
što je uslov za kapiju „najmanje dva različita ugla" u Fazi 5.

### Odluke i razlozi

| Odluka | Zašto |
| --- | --- |
| News sitemap umesto scraping-a za pet izvora | Isti podatak, bez ijedne heuristike po sajtu i bez rizika da promena dizajna obori prikupljanje. |
| Link se prihvata i sa domena kanala, ne samo sa domena iz konfiguracije | Srbija Danas preusmerava `srbijadanas.com` na `sd.rs`. Poređenje samo sa konfiguracijom je odbacivalo sve njegove članke i izvor je padao u prekidač. |
| Greška na pojedinačnom članku ne ruši izvor | Portali povlače tekstove (404) i ponekad odbiju bota na pojedinim stranama (403). Takav članak se upiše sa naslovom i opisom iz feeda, ciklus ide dalje. |

### Odluka o pet izvora bez kanala (vlasnik, 6. septembra 2026)

| Izvor | Odluka | Kako je rešeno |
| --- | --- | --- |
| Politika | Izbačen | `"enabled": false`. Odbija i sam `robots.txt` sa HTTP 403; zaobilaženje Cloudflare zaštite bi bilo kršenje uslova korišćenja. |
| Prva | Izbačen | `"enabled": false`. Nema ni RSS ni sitemap, a provladin ugao pokrivaju drugi izvori. |
| BIRN | Uključen | `post-sitemap1.xml` sa 992 članka, 991 sa datumom izmene. Nije news sitemap, ali radi isti posao. |
| RTS | Uključen | Čitanje linkova sa četiri rubrike, sito je oblik adrese `/vesti/<rubrika>/<broj>/<slug>.html`. |
| Euronews Srbija | Uključen | Isto, oblik adrese `/<rubrika>/<podrubrika>/<broj>/<slug>/vest`. |

Izbačeni izvori se ne brišu iz `config/sources.json` — samo im je `enabled` na `false`, uz belešku
zašto i kako se vraćaju. Time istorija u bazi ostaje čitljiva.

### Treći kanal: čitanje linkova sa rubrika

Za RTS i Euronews nema ni RSS-a ni sitemap-a, pa se linkovi čitaju sa stranica rubrika. Odabir
članaka radi **regularni izraz nad putanjom adrese**, ne CSS selektor — oblik adrese članka je
mnogo stabilniji od strukture stranice, koja se menja sa svakim redizajnom. Na RTS-u je selektor
`article a, h2 a, h3 a` hvatao 36 od 122 članka; obrazac adrese hvata sve.

Redosled kanala je od najurednijeg ka najkrhkijem: **RSS → sitemap → čitanje rubrika.** Sledeći se
koristi samo ako prethodni nije dao ništa.

### Dve popravke iz ovog dela faze

1. **RTS nema nijednu mašinski čitljivu oznaku datuma** — ni `article:published_time`, ni JSON-LD,
   ni `<time datetime>`. Jedino postoji vidljiv datum na strani („nedelja, 06.09.2026, 09:07").
   Dodato je čitanje srpskog zapisa datuma kao poslednji izlaz, sa ogradom: prihvata se samo datum
   iz poslednjih 30 dana i ne iz budućnosti, da se ne uhvati datum iz teksta članka.
2. **Red bez teksta i sa naslovom kraćim od 15 znakova se ne upisuje.** Čitanje rubrika povuče i
   linkove tipa „Više" i „Foto", koji nisu vesti.

### Rezultat posle uključivanja sva tri kanala

| Mera | Vrednost |
| --- | --- |
| Redova u `raw_items` | 636 |
| Izvora sa podacima | 24 (16 RSS, 6 sitemap, 2 čitanje rubrika) |
| Pun tekst izvučen | 621 od 636 |
| Po uglu | kritički 233, provladin 224, mejnstrim 141, agencije 38 |
| Trajanje punog ciklusa | 55 sekundi za 24 izvora |

### Šta vlasnik radi i proverava

1. ✅ Tri GitHub Secrets dodata 6. septembra 2026 (`SUPABASE_URL`, `SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`). `SUPABASE_DB_URL` namerno nije tamo — migracije se ne pokreću iz
   Actions-a, pa lozinka baze ne mora da postoji na GitHub-u.
2. Actions tab → workflow „Prikupljanje vesti" → proverava da je zakazani run zelen.
3. Supabase Table Editor → `raw_items` raste ravnomerno kroz sve izvore.
