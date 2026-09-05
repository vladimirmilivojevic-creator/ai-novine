# Stanje projekta

> Ovaj fajl se ažurira na kraju **svake** faze. Sadrži šta je urađeno, koje su odluke donete i
> zašto, šta vlasnik treba da proveri, i status faze. Pun plan je u `docs/plan.md`.

**Poslednje ažuriranje:** 6. septembar 2026.
**Trenutno stanje:** Faza 0 završena i potvrđena. Faza 1 u radu.

## Pregled faza

| Faza | Naziv                                | Status              |
| ---- | ------------------------------------ | ------------------- |
| 0    | Priprema i kostur                    | ✅ Gotovo, potvrđeno |
| 1    | RSS discovery izveštaj               | 🔄 U radu           |
| 2    | Engine 1 na 3 test izvora            | ⬜ Čeka             |
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

## Faza 1 — RSS discovery izveštaj 🔄

**Status:** u radu.

### Cilj

Za svih 26 domena iz `config/sources.json` proveriti da li postoji RSS feed i na kom URL-u:
standardne putanje (`/feed`, `/rss`, `/feed/rss2`, `/rss.xml`), `<link rel="alternate">` u HTML-u
početne strane, i `sitemap.xml`. Rezultat je markdown izveštaj: koji sajt ima RSS, koji nema,
koji blokira botove, i za svaki bez RSS-a predlog scraping fallback-a uz proveru `robots.txt`.

### Šta vlasnik proverava na kraju faze

Pročita izveštaj i kaže koje izvore izbacujemo. Politika i Tanjug su kandidati — u planskoj fazi
su vraćali HTTP 403 (Cloudflare) čak i na `/robots.txt`.
