# Stanje projekta

> Ovaj fajl se ažurira na kraju **svake** faze. Sadrži šta je urađeno, koje su odluke donete i
> zašto, šta vlasnik treba da proveri, i status faze. Pun plan je u `docs/plan.md`.

**Poslednje ažuriranje:** 6. septembar 2026.
**Trenutno stanje:** Faza 8 gotova — svaki članak dobija naslovnu sliku nacrtanu kodom. Faza 9 (sajt) je sledeća.

## Pregled faza

| Faza | Naziv                                | Status              |
| ---- | ------------------------------------ | ------------------- |
| 0    | Priprema i kostur                    | ✅ Gotovo, potvrđeno |
| 1    | RSS discovery izveštaj               | ✅ Gotovo, čeka potvrdu |
| 2    | Engine 1 na 3 test izvora            | ✅ Gotovo, čeka potvrdu |
| 3    | Engine 1 na sve izvore               | ✅ Gotovo, čeka potvrdu |
| 4    | Klasterovanje i trending (Engine 2)  | ✅ Gotovo, čeka potvrdu |
| 5    | AI generisanje teksta ⚠️ kritična kapija | ✅ Gotovo, čeka potvrdu |
| 6    | Ažuriranje umesto dupliranja         | ✅ Gotovo, čeka potvrdu |
| 7    | Telegram odobravanje                 | ✅ Gotovo, provereno |
| 8    | Slike                                | 🔜 Sledeća          |
| 9    | Frontend                             | ⬜ Čeka             |
| 10   | Pravne stranice, komentari, SEO      | ⬜ Čeka             |
| 11   | Deployment i nadzor                  | ⬜ Čeka             |
| 12   | Drugi provajderi modela (možda)     | ⬜ Razmotreno, odloženo |

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

---

## Faza 4 — Klasterovanje i trending (Engine 2) ✅

**Status:** gotovo, čeka potvrdu vlasnika.
**Izveštaj za pregled:** `reports/teme-dana.md`

### Šta je urađeno

**Obrada srpskog teksta** (`packages/core/src/serbian.ts`) — tri stvari koje engleske biblioteke ne
rade:

- **Transliteracija ćirilice u latinicu.** RTS piše ćirilicom, ostali latinicom; bez ovoga bi ista
  vest bila dva različita teksta.
- **Skidanje kvačica.** U praksi se piše i „Vučić" i „Vucic".
- **Skidanje padežnih nastavaka.** „Vučića", „Vučiću", „Vučićem" i „Vučićevo" daju isti koren.
  Fiksno sečenje na prvih N znakova to ne postiže (razlika je baš na kraju), pa se skida najduži
  nastavak koji odgovara, i to samo ako koren ostane dovoljno dug. „Predsednik" i „predstavnik"
  tako ostaju različiti.

Uz to: srpske stop-reči (veznici, predlozi, i novinarske fraze tipa „izjavio", „saopštio") i grubo
prepoznavanje imena — nizovi reči sa velikim slovom usred rečenice.

**Grupisanje** (`apps/pipeline/src/cluster/`):

- TF-IDF nad korenima reči, naslov se broji trostruko, kosinusna sličnost.
- Konačna sličnost = 0.8 × tekst + 0.2 × zajednička imena. Imena mogu da spasu par koji je pisan
  različitim rečima, ali ne mogu sama da spoje dve nepovezane vesti.
- **Drugi prolaz spaja teme** čiji su centroidi bliski. Ista priča ume da uđe u dve teme kad su
  uglovi izveštavanja različiti („helikopteri gase požar" i „požar ne preti kućama").
- Inkrementalno: svaka tema pamti centroid u bazi, pa se u sledećem ciklusu nova vest poredi sa
  temom bez učitavanja svih njenih tekstova.

**Trending skor** = broj različitih izvora × raspon uglova × brzina rasta u poslednjih 6 sati ×
opadanje po vremenu od poslednjeg teksta (polovina na 12 sati). Bez ijednog spoljnog API-ja —
brief traži baš to (sekcija 4).

**Kapije kvaliteta** iz sekcije 9 brief-a su implementirane i vide se u izveštaju: tema ide na
pisanje samo ako je javljaju najmanje tri nezavisna izvora iz najmanje dva različita ugla.

### Pragovi su izmereni, ne pogođeni

Oba praga su podešena merenjem na 635 stvarnih članaka, 6. septembra 2026:

| Prag | Vrednost | Kako je izabran |
| --- | --- | --- |
| `similarityThreshold` (vest → tema) | 0.38 | Na 0.62 se ista priča razbijala na pet tema. Na 0.38 se spaja tačno. Ispod 0.35 počinje spajanje različitih događaja. |
| `mergeThreshold` (tema → tema) | 0.30 | Na 0.30 se tri teme o požaru na Suvoj planini spajaju u jednu, kao i dva izveštaja o istim izborima u Nemačkoj i dve vesti o istoj saobraćajnoj nesreći. |

Merenje je zabeleženo u `config/editorial.json`, da se sutra zna zašto brojevi izgledaju tako.

### Rezultat na 636 stvarnih vesti

- 635 vesti → **404 teme**, od toga 43 spojene u drugom prolazu.
- Najjača tema: **požar na Suvoj planini — 14 tekstova iz 12 izvora, sva četiri ugla.** Svih 14
  naslova je stvarno o tom požaru.
- Prvih deset tema prolazi kapije kvaliteta.
- Trajanje: 62 sekunde za ceo prozor od 36 sati.

### Poznata slabost

Jedno pogrešno spajanje na ovom uzorku: TV najava („NE PROPUSTITE AKTUELNOSTI NA HAPPY TV") spojena
je sa vremenskom prognozom, jer oba teksta govore o „večeras" i „Srbiji" bez konkretnog događaja.
Takav sadržaj ionako nije vest; ako se ponovi, rešenje je odbacivanje najava i promo tekstova pre
grupisanja, ne pomeranje praga.

### Šta vlasnik proverava

**Ovo je faza gde tvoje poznavanje srpskih vesti vredi više od bilo kog testa.**

1. Otvori `reports/teme-dana.md` i pročitaj prvih deset tema.
2. Za svaku pogledaj spisak naslova unutar teme: **da li svi zaista pripadaju istoj priči?**
3. Javi ako vidiš temu koja je pogrešno spojena, ili priču koja je razbijena na dve teme —
   po tome se podešavaju pragovi.

### Dopuna posle pregleda vlasnika (6. septembra 2026)

**Dve greške koje je vlasnik uhvatio, obe stvarne.**

#### 1. CI je padao crveno dok je lokalno bilo zeleno — vremenska zona

`parseSerbianDate` je sastavljala datum sa `new Date(godina, mesec, dan, sat, minut)`, a taj
konstruktor gradi vreme u zoni **mašine na kojoj kod radi**. Razvojni računar je Europe/Belgrade,
GitHub Actions runner je UTC — otuda razlika od tačno dva sata i pad testa u CI-ju.

Ovo nije bio problem testa nego proizvoda: srpski portal koji ispiše „09:07" misli na beogradsko
vreme, pa bi svaki članak sa RTS-a u produkciji (Actions i Vercel rade u UTC-u) dobio vreme objave
pomereno za sat ili dva.

Popravka: `packages/core/src/timezone.ts` čita odstupanje zone kroz `Intl` i pretvara beogradsko
zidno vreme u tačan trenutak, uz ispravno letnje računanje vremena (CET zimi, CEST leti). Zona se
sada navodi izričito i rezultat ne zavisi od mašine.

Tri zaštite da se ne vrati:

- test koji istu proveru vrti kroz četiri zone (`UTC`, `Europe/Belgrade`, `America/New_York`,
  `Asia/Tokyo`) i traži identičan rezultat,
- testovi datuma tvrde tačan UTC trenutak, ne „sat je 7",
- CI vrti ceo skup testova **dvaput**: jednom u UTC-u i jednom u `America/New_York`.

**Promena u načinu rada:** izveštaj o fazi od sada uključuje i status CI run-a na GitHub-u, ne samo
lokalni `npm run check`. Lokalno zeleno ne znači zeleno.

#### 2. Tema koja je spajala dve priče — „pregled dana" kao most

Vlasnik je u izveštaju uočio temu koja je mešala izraelske napade na jug Libana sa iranskim
tvrdnjama o pogođenom američkom nosaču aviona. Bio je u pravu, i uzrok je bio precizan:

RTS objavljuje **pregled dana sa Bliskog istoka** — jedan tekst koji pokriva više nepovezanih
događaja („ИРГЦ: Погодили смо носач авиона; владине снаге напале Хуте у Јемену"). Takav tekst se
delom poklapa sa više tema odjednom, pa je ušao u temu o Libanu i, pošto je bio prvi po vremenu,
dao joj svoj naslov.

Dve popravke:

| Šta | Zašto |
| --- | --- |
| **Naslov teme je tekst najbliži centroidu**, a ne prvi po vremenu | Naslov sada opisuje ono o čemu tema stvarno govori. Ovo popravlja i sve buduće slučajeve, ne samo ovaj. |
| **Pregledi dana se izostavljaju iz grupisanja** | Prepoznaju se po tački-zarezu koji razdvaja dve samostalne izjave. Ne ulaze u temu jer bi podigli broj izvora teme na koju se odnose samo delom, a u Fazi 5 bi model dobio izvorni tekst koji je pola o nečem drugom. |

Uživo blogovi (`UŽIVO:`, „minut po minut") se **ne** izbacuju — oni po pravilu prate jedan događaj,
pa ostaju u temi; samo ne mogu da budu njen naslov.

Rezultat: tema o Libanu ima 7 tekstova iz 5 izvora i svih sedam je stvarno o izraelskim napadima.
Iranska priča stoji odvojeno, kako i treba.

---

## Faza 5 — AI generisanje teksta ⚠️ kritična kapija 🔄

**Status:** kod je gotov i proveren; **poređenje modela čeka kredite na Anthropic nalogu.**

### Blokada koju vlasnik rešava

Anthropic ključ je ispravan, ali nalog nema kredita:

```
400 invalid_request_error: "Your credit balance is too low to access the Anthropic API."
```

Bez toga ne prolazi nijedan poziv modelu, pa ni poređenje Haiku ↔ Sonnet, koje je sama kapija ove
faze. Rešenje: `console.anthropic.com` → Plans & Billing → dodati sredstva.

`doctor` je dopunjen tako da ovo ubuduće hvata odmah: `models.list` prolazi i bez kredita, pa je
ključ izgledao ispravno. Sada se posebno proverava i naplativi deo API-ja.

### Šta je napravljeno

**Urednička pravila kao fajl, ne kao kod** (`config/editorial-prompt.md`, 16.500 znakova).
Sadrži sva pravila iz sekcije 5 brief-a i, što je jednako važno, **rađene primere**: dobro i loše
prepričavanje, kako se ne pominju izvori, ograda kod brojeva oko kojih nema slaganja, inicijali i
„osumnjičen" kod krivičnih tema, kada se dodaje prikaz „obe strane" a kada ne, i spisak čestih
grešaka u srpskom novinarstvu koje se ne ponavljaju.

Dužina prompta nije slučajna: **Haiku 4.5 kešira tek prefiks od 4096 tokena naviše.** Kraći prompt
se ne kešira — bez greške, samo tiho — a cela procena mesečnog troška počiva na tome da se
urednička pravila naplaćuju desetinom cene posle prvog poziva.

**Generisanje** (`apps/pipeline/src/generate/`):

- strukturisani izlaz kroz `messages.parse` i zod šemu — model ne vraća slobodan tekst nego
  proveren oblik (naslov, uvod, telo, kategorija, osetljivost, „obe strane", ključne reči, napomene),
- urednički prompt ide kao **keširan** sistem-prompt, materijal teme posle njega,
- izveštaji se modelu daju označeni **uglom, nikad imenom medija** — model mora da zna ugao da bi
  napisao „obe strane", a ime medija mu ne treba i ume da završi u tekstu, što je zabranjeno,
- trošak se računa po cenovniku i upisuje **po članku** u bazu, pa se mesečni račun čita, ne procenjuje.

**Izbor tema** (`select.ts`): kapije kvaliteta, dnevna granica, granica po ciklusu, i raspodela
jačeg modela najjačim temama dana. Brief izričito kaže da nema fiksnog broja članaka po ciklusu —
mera je kvalitet teme, ne kvota.

**Komande:**

- `npm run pipeline -- editorial --dry-run` — pokazuje koje bi teme dobile članak i kojim modelom,
  bez ijednog poziva modelu
- `npm run pipeline -- editorial` — piše članke i upisuje ih
- `npm run pipeline -- compare` — ista tema kroz oba modela, izveštaj jedan pored drugog

**Baza** (migracija 0004): `articles` i `article_revisions`. Članci se, za razliku od sirovih
vesti, ne brišu — mali su i oni su proizvod sistema. Osetljiv članak se upisuje kao
`pending_review` i čeka Telegram iz Faze 7; ostali ostaju `draft` dok sajt ne postoji.

### Probni izbor tema (bez poziva modelu)

```
 1. [claude-sonnet-5]   skor 214.31 · 16 tekstova iz 13 izvora — Požar na Suvoj planini
 2. [claude-sonnet-5]   skor 141.22 · 13 tekstova iz  9 izvora — Putin sa Vitkofom i Kušnerom
 3. [claude-sonnet-5]   skor 141.02 · 10 tekstova iz 10 izvora — Prijava za 6.000 dinara pomoći
 4. [claude-sonnet-5]   skor 100.00 · 10 tekstova iz  8 izvora — Odbojkašice Srbije za bronzu
 5. [claude-haiku-4-5]  skor  84.41 · 10 tekstova iz  8 izvora — Venčanje repera Cobija
 6. [claude-haiku-4-5]  skor  83.91 · 10 tekstova iz  9 izvora — Vučić o Marti Kos
```

Od 60 tema kandidata, 6 je izabrano, 54 odbijeno — najčešće zato što ih javlja premalo izvora ili
iz samo jednog ugla. To je kapija iz sekcije 9 brief-a i radi kako treba.

### Šta vlasnik radi

1. Dodaje kredite na Anthropic nalog (`console.anthropic.com` → Plans & Billing).
2. Javi mi, pa pokrećem `compare` — ista tema kroz Haiku 4.5 i Sonnet 5.
3. **Čita oba teksta i odlučuje.** Pitanje je jedno: da li tekst zvuči kao novinarski članak ili
   kao mašinski rerajt. Ako Haiku ne valja za srpski, prelazi se na Sonnet i trošak ide sa
   ~$21 na ~$45 mesečno — to je odluka vlasnika, ne moja.

### Poređenje modela — izmereno 6. septembra 2026

Krediti su dodati, poređenje je odrađeno na tri stvarne teme iz baze. Izveštaj sa punim tekstovima:
`reports/poredjenje-modela.md`.

#### Prvi krug

| Model | Dužina članaka | Ijekavica | Greške u imenima |
| --- | --- | --- | --- |
| Haiku 4.5 | 325, 374, 232 reči | „mjesta", „gdje", „posjetili", „Posjet" u dva od tri članka | „Vladimirm Putinom", „Volodimrom Zelenskim", „na Grami" umesto „na Gramadi" |
| Sonnet 5 | 407, 461, 366 reči | nema | nema |

#### Popravka prompta

U urednička pravila je dodata sekcija **3a: Jezik — ekavica, obavezno**, sa tabelom ijekavskih
oblika i njihovih ekavskih parnjaka, spiskom hrvatskih i bosanskih reči koje se ne koriste, i
pravilom da se imena prepisuju tačno onako kako stoje u izveštajima. Pojačano je i pravilo o
dužini: dužina je zahtev, ne preporuka.

#### Drugi krug, posle popravke

| Model | Dužina | Ijekavica | Kategorija |
| --- | --- | --- | --- |
| Haiku 4.5 | **302, 99, 225 reči** — sva tri ispod praga od 350 | rešena | pogrešna na jednoj temi (`drustvo` umesto `svet`) |
| Sonnet 5 | 431, 483, 336 reči | rešena | tačna |

Prompt je rešio ijekavicu kod oba modela. **Dužinu nije rešio kod Haiku modela.** Članak od 99
reči je pritom prekinut usred rečenice, sa nezatvorenim navodnikom — a izlaz je bio 439 tokena, pri
granici od 4000, dakle model nije odsečen nego je sam stao.

#### Trošak, izmeren

| Model | Prosek po članku | 25 članaka dnevno |
| --- | ---: | ---: |
| Haiku 4.5 | $0.011972 | **$8.98 mesečno** |
| Sonnet 5 | $0.041985 | **$31.49 mesečno** |

Keširanje uredničkog prompta radi kod oba modela (7.987 odnosno 10.351 tokena pročitano iz keša),
što je i bio uslov da ove cene stoje.

Probano je i snižavanje `effort` parametra na Sonnet modelu radi uštede — ispalo je skuplje
($0.061 naspram $0.036), jer je model napisao duži tekst. Ostaje `medium`.

#### Zaključak koji vlasnik potvrđuje

Haiku 4.5 nije u stanju da drži dužinu članka od 350 reči, koja je uslov iz sekcije 9 brief-a
(zaštita od „Scaled Content Abuse"). Sonnet 5 je drži, tačno kategorizuje i piše čistom ekavicom.

Preporuka: **Sonnet 5 za sve članke.** To znači ~$31 mesečno pri 25 članaka dnevno, umesto
procenjenih ~$21. Ako je to previše, jeftinije rešenje nije slabiji model nego **manje članaka**:
15 članaka dnevno sa Sonnet modelom je ~$19 mesečno.

Odluka je vlasnikova; dok je ne donese, `config/editorial.json` ostaje na Haiku modelu.

### Optimizacija troška Faze 5 — izmereno 6. septembra 2026

#### 1. Batch API — staje, i uvedeno je

Batch API daje **50% popusta na sve tokene**, keširanje se i dalje primenjuje, a odgovori stižu
asinhrono: većina paketa za manje od sat vremena, rok je 24 sata.

Pipeline nije uživo-razgovor nego cron, pa zakašnjenje ne smeta. Uvedeno je u **dva koraka**: jedno
pokretanje pokupi rezultate prethodnog paketa i pošalje novi. Posao tako nikad ne čeka odgovor
modela, a članci kasne jedan ciklus.

Šta se izgubilo: u paketu se od modela ne može odmah tražiti ispravka. Zato tema čiji je tekst
došao prekratak dobija oznaku `needs_flagship` i u sledećem paketu je piše jači model.

**Izmereno na stvarnim člancima:** Sonnet kroz paket **$0.0173 po članku**, naspram $0.0418
neposredno. Članci su 481, 534 i 587 reči — dužina se nije pokvarila.

#### 2. Da li izmerena cena drži vodu u produkciji

Drži, ali uz uslov koji je sada ugrađen u ritam poslova.

Keš uredničkog prompta traje pet minuta. Unutar jednog ciklusa članci se pišu jedan za drugim, pa
svi osim prvog čitaju iz keša. **Između ciklusa keš je hladan**, i prvi članak svakog ciklusa plaća
upis prompta: kod Haiku modela oko $0.012 više, kod Sonnet modela oko $0.020.

Posledica: **jedan ciklus sa pet članaka je jeftiniji od pet ciklusa sa po jednim.** Zato urednički
posao ne radi svakih sat vremena nego **na svaka četiri** (`20 */4 * * *`), sa najviše pet članaka
po ciklusu. Prikupljanje vesti i dalje radi na 20 minuta — ono ne zove model.

Izmereno na 814 sirovih vesti iz jednog dana: **65 tema prolazi kapije kvaliteta dnevno**. Ponuda je
dakle šest puta veća od dnevne granice, pa je broj članaka stvarno glavna poluga troška.

#### 3. Hibridni izbor modela i računica

Jači model dobija najjače teme dana; ostatak piše jeftiniji.

| Postavka | Sonnet/dan | Haiku/dan | Ciklusa/dan | Mesečno |
| --- | ---: | ---: | ---: | ---: |
| Neposredno, 10 članaka | 3 | 7 | 2 | $9.03 |
| Neposredno, 8 članaka | 2 | 6 | 2 | $7.32 |
| **Batch, 10 članaka (izabrano)** | **3** | **7** | **2** | **$4.20** |
| Batch, 12 članaka | 4 | 8 | 2 | $4.95 |

Računica po članku (topao keš): Haiku $0.0160 neposredno / $0.0080 kroz paket; Sonnet $0.0418 /
$0.0173. Trošak hladnog keša po ciklusu: $0.032 neposredno, $0.016 kroz paket.

Izabrano je **10 članaka dnevno, od toga 3 jačim modelom, kroz Batch API — oko $4.20 mesečno.**
Minimalna dužina članka od 350 reči nije dirana: to je zaštita iz sekcije 9 brief-a, ne stilska stvar.

#### 4. Haiku i dužina — rešeno strukturom, ne instrukcijom

Tekstualna instrukcija „piši između 350 i 900 reči" nije radila: Haiku je vraćao 99 do 302 reči.

Prvi pokušaj bio je tvrda granica u šemi — svaki pasus najmanje 400 znakova. To je **pogoršalo
stvar**: Haiku bi promašio jedan pasus za dvadesetak znakova i ceo članak bi propao, i posle
ispravke.

Rešenje koje radi je podela odgovornosti:

- **Šema drži strukturu:** telo je niz od četiri do devet pasusa, svaki najmanje 200 znakova. To
  sprečava jednorečenične pasuse i telo od jedne rečenice.
- **Kod drži uredničko pravilo:** posle odgovora se broje reči, i ako ih je manje od 350, od modela
  se traži dopuna sa tačnim brojem („članak ima 296 reči, a mora imati najmanje 350").
- **Ako ni dopuna ne pomogne**, temu preuzima jači model.

Rezultat na istim temama: **Haiku 3/3 uspešno, 392, 387 i 381 reč.** Ranije 302, 99 i 225.

#### 5. Kočnica budžeta

`editorial` pre svega ostalog sabira `cost_usd` svih članaka od prvog u mesecu. Kad zbir dostigne
`monthlyBudgetUsd` (postavljeno na 6 dolara, uz plan od 4.20), generisanje se preskače do prvog u
narednom mesecu. Bolje da nekog dana nema novih članaka nego da račun eksplodira zbog greške u kodu
ili dana sa neuobičajeno mnogo vesti.

#### 6. Drugi provajderi — razmotreno, odloženo

Gemini i OpenAI nude jeftinije modele koji bi mogli da zamene Haiku za deo članaka. Nije rađeno i
nije menjan ni jedan red koda u tom pravcu, iz tri razloga: hibrid sa Batch API-jem već staje u
budžet; drugi provajder znači drugi SDK, drugi oblik strukturisanog izlaza i drugo ponašanje na
srpskom, što traži novo merenje kvaliteta; i tri provajdera u istom pipeline-u su tri mesta gde
nešto može da otkaže.

Ostaje kao **Faza 12**, ako se pokaže potreba.

### Presek kompromisa zbog budžeta (6. septembra 2026)

Napravljen je `docs/tradeoffs.md`: svaki red kaže šta je sada, zašto, koja bi bila bolja opcija i
koliko košta, i da li je efekat **izmeren**, **procenjen** ili **nepoznat**. Uz to i put rasta na
četiri nivoa budžeta ($5, $50, $200, $1.000 mesečno).

Dva nalaza iz tog preseka menjaju sliku:

- **Supabase granica od 500 MB uopšte nije stvarna prepreka.** Izmereno: prosečna vest je 3.521
  bajt, najveći dan 810 vesti, dakle 2,7 MB dnevno. Retention od 10 dana troši **27 MB**. Bez
  brisanja bismo granicu dodirnuli tek posle oko 184 dana. Prozor se može podići na 60+ dana bez
  ijednog dinara, i to bi popravilo prepoznavanje priča koje se razvijaju.
- **Objavljujemo 15% onoga što bismo mogli.** Izmereno: 65 tema dnevno prolazi kapije kvaliteta,
  objavljuje se 10. Trideset članaka dnevno bi koštalo oko $12 mesečno.

U `CLAUDE.md` je dodato pravilo: svaki kompromis zbog budžeta upisuje se u `docs/tradeoffs.md` u
istom potezu, kao deo posla te faze.

---

## Faza 6 — Ažuriranje umesto dupliranja ✅

**Status:** gotovo, čeka potvrdu vlasnika.

### Problem koji je rešen

Do sada je nova vest o priči koja **već ima članak** otvarala novu temu, a nova tema bi dobila drugi,
skoro identičan članak. To je tačno ono što brief zabranjuje u sekciji 5 i ono što Google
„Scaled Content Abuse" politika kažnjava.

Uzrok je bio u jednom redu: teme sa statusom `covered` bile su isključene iz grupisanja, pa nova vest
nije imala gde da uđe.

### Kako sada radi

1. **Pokrivene teme ostaju u igri pri grupisanju.** Nova vest o već pokrivenoj priči ulazi u
   postojeću temu, ne otvara novu.
2. **Tema koja je dobila nove izveštaje postaje kandidat za dopunu**, ali samo ako ih donosi
   najmanje dva **različita** izvora. Prag postoji da se članak ne dira zbog jednog portala koji je
   prepakovao istu vest — dopuna košta koliko i pisanje.
3. **Dopunu piše isti model koji je napisao članak**, pa tekst ostaje ujednačen.
4. **Stara verzija ide u `article_revisions`**, nova u `articles`, broj verzije se podiže,
   `last_update_at` se upisuje. **Slug i URL ostaju isti** — link koji je negde podeljen i dalje
   vodi na najnoviju verziju.
5. **Trošak se sabira** kroz sve verzije, pa članak zna koliko je ukupno koštao.
6. Najviše pet dopuna po članku (`maxUpdatesPerArticle`), pa se priča smatra zaokruženom.

Urednička pravila su dobila sekciju **10a** o dopuni: šta se zadržava, gde se ugrađuje novo, kada se
menja naslov (samo ako više ne opisuje priču), i šta se ne radi — bez „kako smo ranije javili", bez
pasusa koji ponavlja ono što već piše.

### Provereno na stvarnoj priči

Članak **„Odbojkašice Srbije igraju za bronzu Evropskog prvenstva"** je posle pet novih izveštaja
postao **„Odbojkašice Srbije osvojile bronzanu medalju"** — verzija 2, 583 reči, sa beleškom o
promeni: *„Dodat konačan rezultat meča za bronzu (3:1 protiv Poljske), statistika susreta i
strelaca."* Stara verzija je u istoriji, URL nepromenjen.

Druga priča (dolazak američkih izaslanika u Kijev) dopunjena je sa 13 novih izveštaja iz 8 izvora,
na 867 reči.

### Dve popravke otkrivene tokom provere

1. **Prekratak pasus obarao je celu dopunu.** Model bi jednu rečenicu odvojio u svoj pasus i članak
   od 800 reči bi propao zbog preloma. Sada se prekratak pasus **spaja sa susednim** umesto da se
   odgovor odbaci. Prva dopuna koja je pala prošla je iz prvog pokušaja posle ove popravke.
2. **Dopune se nisu brojale u dnevnu granicu.** Sa šest ciklusa dnevno i dve dopune po ciklusu, to
   bi bilo dvanaest plaćenih poziva van plana — budžet bi tiho probijen. Sada dopuna troši isto
   mesto u dnevnoj granici kao i nov članak, i u neposrednom i u paketnom režimu.

### Šta vlasnik proverava

1. Supabase Table Editor → tabela `articles`, kolona `revision`: članak o odbojkašicama ima
   verziju 2.
2. Tabela `article_revisions` → tu je stara verzija istog članka, sa razlogom izmene.
3. Prati jednu priču koja se razvija kroz nekoliko ciklusa i proverava da nastaje **jedan članak
   koji raste**, a ne četiri skoro identična.

---

## Faza 7 — Telegram odobravanje osetljivih članaka ✅

**Status:** gotovo, čeka potvrdu vlasnika (pritisak dugmeta na telefonu).

### Kako radi

Osetljiv članak — krivični postupak, tragedija sa žrtvama, sudski proces, zdravlje imenovane osobe —
ne izlazi sam. Označi ga model još pri pisanju, članak dobija stanje `pending_review`, i onda ga bot
šalje na Telegram sa dva dugmeta.

Jedno pokretanje komande `review` radi tri stvari, tim redom:

1. **Pokupi odluke** koje je vlasnik doneo pritiskom na dugme u prethodnom ciklusu.
2. **Ugasi zahteve starije od dva sata.** Članak tada ostaje neobjavljen — **ćutanje nije
   odobrenje**, kako brief i traži.
3. **Pošalje nove** osetljive članke.

Odobren članak dobija stanje `published` i vreme objave; odbijen dobija `rejected` i ostaje u bazi,
jer je i odbijanje podatak. Poruci se posle odluke menja tekst, pa se u istoriji chata vidi šta je
odlučeno i kada.

### Odluka: bez webhook-a, za sada

Telegram nudi dva načina da bot sazna za pritisak dugmeta:

- **Webhook** — Telegram pozove naš sajt. Traži javnu adresu, koju sajt dobija tek u Fazi 11.
- **`getUpdates`** — bot sam pita ima li novih odgovora. Radi bez ijedne javne adrese.

Izabran je drugi, pa odobravanje **radi već sada**, uz jedinu cenu da odluka stigne u sledećem
ciklusu umesto istog trenutka. Webhook se dodaje u Fazi 11 kad postoji adresa; kod za obradu odluke
je isti, menja se samo kako odluka stiže.

### Zaštita

Odluka se prihvata **samo iz podešenog chata**. To je jedina prava zaštita ovog kanala: ko zna token
bota može da pošalje poruku, ali odgovor iz tuđeg chata se odbacuje i zabeleži u dnevniku.

Pomeraj pročitanih poruka čuva se u bazi (tabela `app_state`). Bez toga bi se isti pritisak dugmeta
obrađivao u svakom ciklusu.

### Provereno

Poslat je stvarni članak koji čeka odobrenje — o dolasku američkih izaslanika u Kijev, označen kao
osetljiv jer pominje poginule i povređene civile. Poruka je stigla na telefon sa naslovom, uvodom,
tekstom, razlogom označavanja i dva dugmeta.

16 novih testova pokriva sastavljanje poruke i čitanje odgovora: da naslov sa `<` i `&` ne obori
poruku, da predugačak tekst stane u Telegram granicu i bude presečen na kraju rečenice, da podatak
dugmeta stane u 64 bajta, i da se tuđi podaci dugmeta odbace.

### Ako Telegram nije podešen

Posao se **uredno preskače** uz upozorenje, umesto da obori ciklus. Članci onda samo ostaju u redu
za odobrenje dok se Telegram ne podesi.

### Šta vlasnik proverava

1. Otvori Telegram, poruku od `@AinovineBot`.
2. Pritisne **✅ Odobri** ili **❌ Odbij**.
3. Javi mi — pokrenuću `review` da pokupi odluku, pa ćemo zajedno videti da je stanje članka u bazi
   promenjeno i da se tekst poruke izmenio.

### Provera na telefonu i jedna popravka (7. septembra 2026)

Vlasnik je pritisnuo „Odobri". Ceo lanac je prošao: odluka pokupljena, članak prešao u
`published` sa vremenom objave, zahtev u redu za odobravanje označen kao `approved`, a pomeraj
pročitanih poruka upisan u bazu.

Usput su se videle dve stvari koje vredi zapisati:

**Pritisci dugmeta stižu sa zakašnjenjem, ali ne propadaju.** Prva provera je pokazala nula poruka
na čekanju kod Telegrama, pa je izgledalo da pritisak nije stigao. Nekoliko minuta kasnije stigla su
oba pritiska. Zaključak: Telegram čuva pritisak do 24 sata i on se ne gubi ako pipeline u tom
trenutku ne radi — samo se ne vidi odmah.

**Dva pritiska su primenila istu odluku dvaput.** Nije napravilo štetu (drugi pokušaj je naišao na
već objavljen članak), ali je pokazalo da nedostaje provera. Sada se odluka primenjuje samo ako
zahtev još čeka; ponovljen pritisak dobije odgovor „o ovom članku je već odlučeno".

Greška „query is too old" na starom pritisku je očekivana — Telegram dozvoljava potvrdu pritiska
samo kratko vreme. Odluka se svejedno upisuje; ne potvrđuje se samo animacija na dugmetu.

---

## Faza 8 — Naslovne slike ✅

*Završeno 7. septembra 2026.*

Svaki članak dobija sliku 1200×630 nacrtanu kodom: geometrija, boja rubrike i naslov. Nijedna
slika nije generisana modelom i nijedna ne prikazuje stvarnu osobu — brief, sekcija 8, to izričito
traži, a usput je to i jedini način da slika ne košta ništa.

### Kako radi

`satori` pretvara opis rasporeda u SVG, `@resvg/resvg-js` SVG u PNG. Oba rade lokalno, bez mreže
i bez naloga. PNG ide u Supabase Storage kantu `covers`, a adresa u kolonu `articles.cover_url`.

Šablona ima 18: šest rubrika × tri varijacije geometrije (`traka`, `mreza`, `blok`). Rubrika bira
boju i ton podloge, varijacija bira raspored. Zaglavlje, naslov i vodeni žig su svuda isti, pa se
sve slike prepoznaju kao isti list.

Varijacija se bira iz identifikatora članka (FNV-1a), ne nasumično. Isti članak zato uvek dobija
istu sliku, i pre nego što je ijedna sačuvana.

### Vodeni žig

Na svakoj slici, upečen u sam PNG: **„Tekst generisala veštačka inteligencija · AI Novine"**.
Nije prekrivka koja se skida stilom nego deo slike, pa preživi i deljenje na društvenim mrežama,
gde je često jedino što čitalac vidi pre nego što klikne.

### Slika prati naslov

Faza 6 sme da promeni naslov postojećeg članka. Bez zaštite bi slika zauvek nosila prvi naslov, pa
bi pregled linka na Fejsbuku govorio jedno a članak drugo. Zato se pamti `cover_at`: svaka slika
starija od poslednje dopune se precrta, na istu adresu (ime fajla je slug).

### Izmereno

| | |
| --- | ---: |
| Šablona | 18 |
| Vreme crtanja jedne slike | 0,25 s |
| Veličina jedne slike | 43–47 KB |
| Trošak po slici | $0 |
| Slika koje staje u besplatnih 1 GB | oko 22.000 |
| Pri 10 članaka dnevno | 1 GB traje preko 6 godina |

Pet stvarnih članaka iz baze je dobilo sliku i sve su javno dostupne (HTTP 200, `image/png`).
Ponovno pokretanje ne pravi ništa novo — komanda je idempotentna.

### Font

Inter (SIL Open Font License) je spakovan u repo, u `assets/fonts/`. Razlog je srpska latinica:
č, ć, ž, š i đ moraju postojati u fontu, inače satori ta slova preskoči i naslov izađe sa rupama.
Test crta svako od tih deset slova posebno i pada ako neko od njih nestane.

### Nova komanda

```
npm run pipeline -- covers --preview      # svih 18 šablona u reports/naslovnice/
npm run pipeline -- covers                # članci bez slike: nacrtaj i otpremi
npm run pipeline -- covers --dry-run      # nacrtaj, ali ne otpremaj i ne upisuj
```

Korak „Naslovne slike" je dodat u `editorial.yml`, posle pisanja. Namerno je zaseban: ako crtanje
padne, članak i dalje postoji — tekst je proizvod, slika je omot.

### Šta vlasnik proverava

Otvara 18 slika iz `reports/naslovnice/` i kaže da li vizuelni identitet drži. Ako neka boja ili
raspored ne valjaju, menja se `apps/pipeline/src/images/palette.ts`, jedna komanda precrta sve.
