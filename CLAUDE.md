# AI Novine — uputstvo za Claude Code sesije

## ⚠️ Prvo pročitaj `docs/progress.md`

**Pre bilo kakvog rada u ovom repozitorijumu, pročitaj `docs/progress.md`.** Taj fajl je jedini
izvor istine o tome dokle se stiglo: koje su faze završene, koje su odluke donete i zašto, i koji
je sledeći korak na redu. Bez njega ćeš ponoviti posao ili raditi pogrešnu fazu.

Puni plan projekta je u `docs/plan.md`, originalni zahtev vlasnika u `docs/brief.md`, a presek
kompromisa zbog budžeta u `docs/tradeoffs.md`.

## Šta je ovo

Sajt (`ainovine.rs`) koji prati ~26 srpskih portala svih političkih boja, grupiše vesti u teme,
piše originalne neutralne članke o onima koje to zaslužuju, i nudi prikaz „obe strane" kada se
izvori stvarno razilaze u tumačenju. Sve automatski, 24/7, na besplatnim tier-ovima.

Sadržaj generiše veštačka inteligencija i to je javno označeno svuda na sajtu.

## Stek

TypeScript svuda (bez Pythona), npm workspaces, Node 22. Supabase (Postgres) za bazu,
Next.js 15 na Vercel-u za sajt, GitHub Actions cron za pipeline, Anthropic API za pisanje
članaka. Bez build koraka — sve se izvršava kroz `tsx` direktno iz `.ts` fajlova.

```
config/       sources.json (izvori), editorial.json (pragovi, kvote) i editorial-prompt.md
              (urednička pravila koja idu modelu) — vlasnik ih menja rukom
packages/core tipovi, logger, učitavanje konfiguracije kroz zod šeme
packages/db   Supabase klijent, šema i migracije
apps/pipeline Node CLI: config | discover | ingest | editorial | sweep
apps/web      Next.js sajt (Faza 9)
```

## Komande

```bash
npm run check               # typecheck + lint + testovi — pokreni pre svakog commit-a
npm run typecheck           # tsc --noEmit
npm run lint                # eslint
npm run format              # prettier --write
npm run test                # vitest
npm run pipeline -- config  # proverava config/ fajlove
npm run pipeline -- <cmd>   # discover | ingest | editorial | sweep
```

## Pravila rada u ovom projektu

- **Radi fazu po fazu.** Posle svake faze: ažuriraj `docs/progress.md`, objasni šta je urađeno,
  reci vlasniku tačno šta da proveri, i sačekaj njegovu potvrdu pre sledeće faze.
- **Vlasnik je student IT-a, ne DevOps ekspert.** Za svaki korak koji on radi ručno (nalozi, API
  ključevi, DNS, klikovi po dashboard-ovima) daj tačne korake: gde da klikne, šta da nalepi, gde.
  Sve što se može uraditi kodom — uradi sam, bez čekanja.
- **Repo je javan.** Nijedan ključ, token ni tajna ne sme da uđe u kod ili u git. Tajne žive u
  `.env` (lokalno), GitHub Secrets i Vercel env varijablama.
- **Budžet je ~0.** Jedini prihvatljiv trošak su Anthropic API pozivi. Nijedan plaćeni servis bez
  eksplicitne dozvole vlasnika.
- **Svaki kompromis zbog budžeta ide u `docs/tradeoffs.md` istog trenutka.** Kad god se u nekoj
  fazi nešto odluči zato što je besplatni tier tako tražio, ili zato što bolja opcija košta — taj
  red se upisuje odmah, kao deo posla te faze, ne kao zadatak za kasnije. U redu mora da stoji:
  šta je sada, zašto, koja bi bila bolja opcija i koliko okvirno košta, i da li je efekat
  **izmeren** (imamo broj iz ovog projekta), **procenjen** (računica ili cenovnik) ili
  **nepoznat** (treba testirati). Ne piši „bilo bi bolje" bez broja ili bez oznake da je nepoznato.
  Taj dokument vlasnik koristi u razgovoru sa investitorom, pa nagađanje predstavljeno kao činjenica
  tamo pravi stvarnu štetu.
- **Konfiguracija ne ide u kod.** Izvori, pragovi i kvote se menjaju u `config/*.json`.
- **Ne zaobilazi Cloudflare ni robots.txt.** Izvor koji blokira botove se preskače i loguje.
- **Ne guši izvore.** Jedan zahtev u sekundi po domenu, korektan User-Agent `AINovineBot/1.0`,
  bez glumljenja browsera.
- **Jedan izvor ne sme da obori pipeline.** Svaki dohvat je nezavisan; tri uzastopna neuspeha gase
  izvor na 6 sati i ciklus ide dalje.
- **Kapije kvaliteta pre AI poziva.** Klaster ide u generisanje samo ako ga javljaju najmanje 3
  nezavisna izvora iz najmanje 2 različita ugla i nije već pokriven postojećim člankom. Ovo je
  odbrana od Google „Scaled Content Abuse" politike i ne sme se olabaviti bez razgovora.
- **Ažuriraj postojeći članak umesto pravljenja skoro istog novog.**

## Jezik

Kod, imena promenljivih i komentari — engleski gde je uobičajeno, srpski gde je komentar
objašnjenje za vlasnika. Sav sadržaj namenjen vlasniku i čitaocima sajta — srpski.
Commit poruke — srpski, `feat:` / `fix:` prefiks na engleskom.
