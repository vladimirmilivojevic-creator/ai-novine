# Stanje projekta

> Ovaj fajl se ažurira na kraju **svake** faze. Sadrži šta je urađeno, koje su odluke donete i
> zašto, šta vlasnik treba da proveri, i status faze. Pun plan je u `docs/plan.md`.

**Poslednje ažuriranje:** 6. septembar 2026.
**Trenutno stanje:** Ključevi podešeni i provereni. Faza 2 u radu. Odluka o izvorima iz Faze 1 (Politika, Prva, BIRN, RTS, Euronews) još nije doneta — blokira Fazu 3, ne Fazu 2.

## Pregled faza

| Faza | Naziv                                | Status              |
| ---- | ------------------------------------ | ------------------- |
| 0    | Priprema i kostur                    | ✅ Gotovo, potvrđeno |
| 1    | RSS discovery izveštaj               | ✅ Gotovo, čeka potvrdu |
| 2    | Engine 1 na 3 test izvora            | 🔄 U radu           |
| 3    | Engine 1 na sve izvore               | ⬜ Čeka             |
| 4    | Klasterovanje i trending (Engine 2)  | ⬜ Čeka             |
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
