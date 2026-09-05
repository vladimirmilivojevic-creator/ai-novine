# AI Novine (ainovine.rs) — arhitektura i fazni plan

## Kontekst

Repozitorijum je trenutno prazan (samo `LICENSE`, `.gitattributes` i sam brief). Gradi se od nule sistem koji: prati ~20-25 srpskih portala, klasteruje vesti u teme, AI odlučuje koja tema zaslužuje članak, piše originalan neutralan tekst, po potrebi nudi "obe strane", generiše cover sliku bez API troška, traži ljudsko odobrenje za osetljive teme preko Telegrama, i objavljuje na Next.js sajt — sve automatski, 24/7, na besplatnim tier-ovima. Jedini planirani gotovinski trošak su Anthropic API pozivi.

Cilj posle mesec dana rada: prezentacija investitoru.

### Šta je već provereno na terenu (read-only, u ovoj sesiji)

Testirao sam standardne RSS putanje i HTML autodiscovery na 20 domena iz brief-a. Rezultat koji oblikuje plan:

| Status | Izvori |
|---|---|
| RSS radi odmah | Kurir, N1, Nova, Danas, Telegraf, Vreme, KRIK, Pink, Insajder, RTS |
| Nema autodiscovery — treba sitemap/scraping | Informer, Blic, Euronews Srbija |
| **HTTP 403 (Cloudflare bot-block, i na `/robots.txt`)** | **Politika, Tanjug** |

Zaključak: RSS pokriva otprilike polovinu izvora bez muke, scraping fallback treba za manjinu, a dva izvora aktivno blokiraju botove. Faza 1 pravi pun izveštaj za svih 25.

### Odluke koje si već doneo

| Pitanje | Odluka |
|---|---|
| Ime repo-a | Obrisati vodeći razmak iz lokalnog foldera; GitHub repo i sve ostalo ostaje isto |
| AI model | Haiku 4.5 kao podrazumevani, Sonnet 5 za 3-5 glavnih priča dnevno; poređenje kvaliteta u Fazi 5 |
| Nalozi | Domen `ainovine.rs`, Anthropic API ključ, Supabase i Vercel — sve već postoji |
| Ritam | Prikupljanje svakih 20 min, AI uređivanje svakih 60 min |

### Odluke koje sam ja doneo (i zašto)

**TypeScript end-to-end, bez Pythona.** Brief to preferira, i brief sam kaže da je `pytrends` opcioni, ne-kritičan sloj. Primarni trending signal je ionako interna analiza učestalosti kroz 25 izvora — to je jači signal za srpske vesti nego Google Trends, i ne zavisi od neslužbene biblioteke koju Google povremeno blokira. `pytrends` ostaje kao opcioni dodatak posle Faze 11, ako se ispostavi da fali.

**Klasterovanje vesti bez AI-ja.** Ovo je najveća ušteda u celom sistemu. Grupisanje 500-1500 dnevnih članaka u teme radi se leksički (normalizacija ćirilica→latinica, srpske stop-reči, TF-IDF nad karakterskim 4-gramima, kosinusna sličnost, plus preklapanje imenovanih entiteta). Nula tokena. AI se poziva tek kada klaster prođe kroz kapije kvaliteta — dakle 20-30 puta dnevno umesto hiljadama.

**Jedan AI poziv po članku, ne dva.** Poziv vraća strukturisani JSON koji sadrži i metapodatke (kategorija, osetljivost, da li se izvori stvarno razilaze) i sam tekst. Dva poziva bi duplirala trošak ulaznih tokena bez dobitka, jer draft ionako pišemo pre nego što ga pošaljemo na odobrenje.

**Prompt caching na uredničkom sistem-promptu.** Stilski vodič, pravila iz sekcije 5, pravilo o inicijalima, definicije kategorija i format "obe strane" su stabilan tekst od nekoliko hiljada tokena koji ide uz svaki poziv. Keširanjem se taj deo naplaćuje ~10% posle prvog poziva.

**Procena troška sa ovim ritmom:** ~25 članaka dnevno Haiku (~$0.02 svaki) + ~4 Sonnet (~$0.05 svaki) ≈ **$0.70/dan ≈ $21/mesec**, i manje kad caching proradi. Unutar tvoje procene.

---

## Arhitektura

Jedan monorepo, npm workspaces, jedan jezik.

```
ai-novine/
  config/
    sources.json          ← ti menjaš ovde, ne u kodu
    editorial.json        ← pragovi, dnevne kvote, kategorije
  packages/
    core/                 ← srpska normalizacija teksta, tipovi, logger
    db/                   ← Supabase klijent, tipovi, SQL migracije
  apps/
    pipeline/             ← Node CLI: discover | ingest | editorial | sweep
    web/                  ← Next.js 15 App Router
  .github/workflows/
    ingest.yml            ← cron */20
    editorial.yml         ← cron 0 * * * *
    sweep.yml             ← dnevno
  README.md               ← uključuje pravnu napomenu iz sekcije 8
```

Pipeline nikad ne piše u git — piše u Supabase. Sajt čita iz Supabase. Ta razdvojenost znači da rušenje jednog ne ruši drugo.

### Baza (Supabase Postgres)

Ključne tabele: `sources`, `raw_items`, `clusters`, `articles`, `article_revisions`, `comments`, `review_queue`, `pipeline_runs`.

Dve stvari koje moraju biti tako od početka:

- **Retention.** Supabase besplatni tier ima 500 MB. Puni tekst 1000+ članaka dnevno pojede to za nedelje. `sweep` briše `raw_items` starije od 10 dana. Generisani članci ostaju zauvek — oni su mali.
- **RLS (Row Level Security).** Anonimni posetilac sme samo `INSERT` u `comments` i `SELECT` objavljenih članaka i vidljivih komentara. `service_role` ključ postoji isključivo u GitHub Secrets i Vercel env — nikad u kodu, jer je repo javan.

### Otpornost (brief, sekcija 3: jedan izvor ne sme da obori pipeline)

Svaki izvor se dohvata nezavisno, sa uslovnim GET-om (ETag / If-Modified-Since), poštovanjem `robots.txt` preko `robots-parser`, ograničenjem od 1 zahteva u sekundi po domenu, i korektnim User-Agent-om `AINovineBot/1.0 (+https://ainovine.rs/kako-radimo)` — bez glumljenja browsera. Tri uzastopna neuspeha gase izvor na 6 sati (`disabled_until`) i loguju upozorenje. Ciklus ide dalje.

### Kapije kvaliteta pre AI poziva (brief, sekcija 9 — Scaled Content Abuse)

Klaster ide u generisanje samo ako:

1. javljaju ga **najmanje 3 nezavisna izvora**,
2. dolazi iz **najmanje 2 različita ugla** (3 provladina izvora koja prenose isto saopštenje nisu vest, to je saopštenje),
3. nije već pokriven postojećim člankom (inače ide na ažuriranje, ne na novi članak),
4. dnevna kvota za tu kategoriju nije potrošena.

Plus tvrda gornja granica objava dnevno. Sajt koji izbaci 200 članaka dnevno izgleda kao farma sadržaja bez obzira na kvalitet teksta.

### Ažuriranje umesto dupliranja (sekcija 5 i 9)

Kad klaster koji već ima članak dobije nove izvore ili novi ključni entitet unutar 6 sati, sistem generiše **izmenu** postojećeg članka: dodaje pasus, osvežava uvod, upisuje u `article_revisions`, menja `updated_at`. Slug i URL ostaju isti. Ovo je istovremeno najvažnija SEO zaštita i najvažnija odbrana kvaliteta.

---

## Faze

Posle svake faze staje se, objašnjava šta je urađeno, i čeka tvoja potvrda.

### Faza 0 — Priprema i kostur

Ti radiš ručno: zatvoriš Claude Code, preimenuješ folder iz `" ai-novine"` u `"ai-novine"`, otvoriš Claude Code ponovo u novom folderu. (Ne mogu da preimenujem folder u kome trenutno radim.) Zatim proveriš da je GitHub repo **javan** — to je uslov za neograničene besplatne Actions minute.

Ja radim: npm workspaces kostur, TypeScript config, ESLint/Prettier, `config/sources.json` sa svih 25 izvora iz brief-a, `.env.example`, `.gitignore`, i `README.md` sa pravnom napomenom koju brief traži u sekciji 8 (da "AI Novine Redakcija" u impresumu **ne predstavlja stvarnu pravnu zaštitu** i da ostaješ pravno odgovoran kao vlasnik domena i naloga).

Ti proveravaš: `npm install` prolazi, folder se zove kako treba.

### Faza 1 — RSS discovery izveštaj

Brief-om traženi prvi konkretan zadatak. Skripta `pipeline discover` za svih 25 domena proverava `/feed`, `/rss`, `/feed/rss2`, `/rss.xml`, `<link rel="alternate">` u HTML-u, i `sitemap.xml`. Ispisuje markdown izveštaj: koji sajt ima RSS i na kom URL-u, koji nema, koji blokira, i za svaki bez RSS-a predlog scraping fallback-a sa proverom `robots.txt`.

Ti proveravaš: pročitaš izveštaj i kažeš mi koje izvore izbacujemo (Politika i Tanjug su kandidati, blokiraju botove).

### Faza 2 — Engine 1 na 3 test izvora

Puna putanja od jednog izvora do baze, ali na malom uzorku (N1, Danas, Kurir — pokrivaju dva različita ugla). Supabase šema i migracije, dohvatanje, ekstrakcija teksta (`@mozilla/readability` + `linkedom`), deduplikacija po URL-u i hash-u sadržaja, upis. Uslovni GET i circuit breaker već ovde.

Ti proveravaš: otvoriš Supabase Table Editor i vidiš popunjenu tabelu `raw_items` sa stvarnim vestima.

### Faza 3 — Engine 1 na sve izvore

Skaliranje na finalnu listu, scraping adapteri za izvore bez RSS-a, retention brisanje, `pipeline_runs` logovanje, prvi GitHub Actions workflow (`*/20`).

Ti proveravaš: Actions tab pokazuje zelene run-ove; baza raste ravnomerno; nijedan izvor ne obara ciklus.

### Faza 4 — Klasterovanje i trending (Engine 2)

Srpska normalizacija teksta (transliteracija ćirilica↔latinica, stop-reči, stemovanje), TF-IDF nad karakterskim n-gramima, kosinusna sličnost, ekstrakcija entiteta, inkrementalno klasterovanje. Trending skor: broj različitih izvora × raspon uglova × brzina rasta u vremenskom prozoru.

Ti proveravaš: dam ti ispis top 10 klastera za tekući dan sa naslovima unutar svakog — ti kažeš da li grupisanje ima smisla za nekog ko prati srpske vesti. Ovo je faza gde tvoje poznavanje domena vredi više od mog.

### Faza 5 — AI generisanje teksta ⚠️ kritična kapija

Anthropic SDK, urednički sistem-prompt sa svim pravilima iz sekcije 5 (originalno prepričavanje, konsenzus brojevi sa ogradom, inicijali i "osumnjičen" za krivične teme, generičke oznake ugla bez imenovanja izvora), strukturisani izlaz, prompt caching, kapije kvaliteta, kategorizacija, "obe strane" panel, detekcija osetljivosti (samo se markira, Telegram dolazi u Fazi 7).

**Isti klaster puštam kroz Haiku 4.5 i Sonnet 5 i dajem ti oba teksta jedan pored drugog.** Ti čitaš srpski i odlučuješ. Ako Haiku ne valja za srpski, prelazimo na Sonnet za sve i trošak ide na ~$45/mesec — to je tvoja odluka, ne moja.

Ti proveravaš: čitaš 5-10 generisanih članaka. Da li zvuče kao novinarski tekst ili kao mašinski rerajt? Ovo je kapija — ne idemo dalje dok tekst ne valja.

### Faza 6 — Ažuriranje umesto dupliranja

Logika iz sekcije 5/9: prepoznavanje da klaster već ima članak, generisanje dodatka umesto novog teksta, revizije, `updated_at`.

Ti proveravaš: pratiš jednu priču koja se razvija kroz nekoliko ciklusa i vidiš da nastaje jedan članak koji raste, a ne četiri skoro identična.

### Faza 7 — Telegram odobravanje

Bot preko `@BotFather` (dajem ti klikove — ovo je jedini nalog koji još nemaš), webhook na Next.js rutu sa proverom tajnog tokena, inline dugmad Odobri/Odbij, `sweep` automatski gasi zahteve starije od 2 sata u trajni draft.

Ti proveravaš: osetljiv članak stigne na tvoj telefon, klikneš Odobri, status u bazi se promeni.

### Faza 8 — Slike

`satori` + `@resvg/resvg-js` renderuju SVG šablone u PNG u pipeline-u, PNG ide u Supabase Storage (1 GB besplatno). 6 kategorija × 3 varijacije = 18 šablona u doslednom vizuelnom identitetu. Izbor šablona je determinističan po ID-u članka, pa isti članak uvek ima istu sliku. Vodeni žig "Tekst generisala veštačka inteligencija · AI Novine" je upečen u sliku, kako sekcija 8 traži. Font sa srpskim dijakriticima (č ć ž š đ) se pakuje u repo.

Nikakvo AI generisanje slika, nikakvo crtanje imenovanih javnih ličnosti — sekcija 6.

Ti proveravaš: gledaš 18 generisanih cover-a i kažeš da li vizuelni identitet drži.

### Faza 9 — Frontend

Next.js 15 App Router, React 19, Tailwind v4. Server komponente čitaju Supabase direktno. Naslovna, kategorije, stranica članka, "obe strane" prikaz kao dva panela, pretraga (Postgres full-text + trigram, jer Postgres nema srpsku FTS konfiguraciju). Mobile-first — brief traži bolji UX od Ground News, a Ground News je na telefonu pretrpan.

Ti proveravaš: `npm run dev`, klikaš po sajtu, otvaraš na telefonu.

### Faza 10 — Pravne stranice, komentari, SEO

Stranice "Kako AI Novine rade", Politika privatnosti, Uslovi korišćenja, Impresum. Oznaka AI generisanog sadržaja na svakom članku i u footeru. Komentari preko Server Action-a sa honeypot poljem i rate limitom u samom Postgres-u (bez dodatnog servisa) — IP se čuva kao salted hash, ne kao IP, jer inače Politika privatnosti ne stoji. `sitemap.ts`, `robots.ts`, JSON-LD `NewsArticle`, OG tagovi, canonical, `noindex` na tanke i draft članke.

Ti proveravaš: čitaš pravne stranice i kažeš da li te predstavljaju tačno; ostavljaš test komentar; proveravaš da li spam zaštita drži.

### Faza 11 — Deployment i nadzor

Vercel povezan sa repo-om, env varijable, DNS za `ainovine.rs` (dajem ti tačne zapise koje unosiš kod registrara), GitHub Secrets, Telegram webhook na produkcijski URL, sva tri workflow-a uključena. Zatim 48h posmatranja.

Ti proveravaš: sajt radi na domenu; ujutru zatekneš nove članke koje niko nije pokrenuo ručno.

---

## Verifikacija

Automatski, kroz sve faze: Vitest jedinični testovi za normalizaciju srpskog teksta, klasterovanje, kapije kvaliteta i deduplikaciju (to su delovi gde tiha greška najviše košta). Integracioni test pipeline-a nad snimljenim HTTP odgovorima, bez pogađanja pravih portala. `tsc --noEmit` i lint u CI-ju na svaki push.

Ručno, na kraju: pusti `pipeline ingest` pa `pipeline editorial` lokalno, otvori Supabase i vidi članke, pokreni `npm run dev` i pročitaj ih na sajtu. Posle Faze 11, prva prava provera je da 48 sati ne diraš ništa i vidiš šta se samo objavilo.

---

## Rizici koje treba da znaš unapred

**GitHub Actions cron kasni.** Traženih 20 minuta u praksi bude 20-40 pod opterećenjem. Ne mogu to da popravim — to je poznato ponašanje besplatnog tier-a. Takođe, GitHub gasi zakazane workflow-e posle 60 dana bez aktivnosti u repo-u i pošalje email; treba ih ručno uključiti nazad.

**Vercel Hobby je formalno za nekomercijalnu upotrebu.** Dok nema reklama, u redu. Onog trenutka kad monetizuješ, Vercel traži Pro ($20/mesec). Za investitorsku prezentaciju je Hobby dovoljan, ali računaj na to kao poznat budući trošak.

**Kvalitet srpskog iz Haiku modela je otvoreno pitanje.** Merimo ga u Fazi 5, ne pretpostavljamo.

**Politika i Tanjug blokiraju botove.** Zaobilaženje Cloudflare zaštite neću raditi — to je narušavanje uslova korišćenja tih sajtova. Ako ih hoćeš, opcija je zvanično tražiti pristup od njih.

**Scaled Content Abuse ostaje rizik i sa svim merama.** Kapije kvaliteta, ažuriranje umesto dupliranja i stranica o metodologiji su prava odbrana, ali Google ne daje garancije nikome.

**Pravna odgovornost.** Impresum sa "AI Novine Redakcija" ne menja činjenicu da si ti vlasnik domena, hostinga i naloga. Ovo ide u README, kako brief traži.
