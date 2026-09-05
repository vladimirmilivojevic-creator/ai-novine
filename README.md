# AI Novine (`ainovine.rs`)

Automatizovan sistem koji prati ~25 srpskih portala svih političkih boja, grupiše vesti u teme,
piše originalne neutralne članke o onima koje to zaslužuju, i — kada se izvori stvarno razilaze
u tumačenju — nudi čitaocu prikaz „obe strane".

Ceo sadržaj sajta generiše veštačka inteligencija. To je javno označeno na svakom članku, na
svakoj slici i u podnožju sajta.

---

## ⚠️ Pravna napomena (interno, ne objavljuje se na sajtu)

U impresumu sajta kao redakcija piše **„AI Novine Redakcija"**. To je svesna odluka za test fazu,
ali **ne predstavlja stvarnu pravnu zaštitu**.

Vlasnik domena, hostinga, Supabase i Anthropic naloga ostaje pravno odgovoran za sve što sistem
objavi — bez obzira na to šta piše u javnom impresumu. Ime redakcije nije pravno lice i ne prima
odgovornost ni za klevetu, ni za netačnu informaciju, ni za obradu ličnih podataka komentatora.

Konkretno, odgovornost obuhvata:

- **Sadržaj članaka.** Ako AI objavi netačnu ili štetnu tvrdnju o imenovanoj osobi, tužba ide
  vlasniku domena. Zato postoji pravilo o inicijalima i formulaciji „osumnjičen je" za krivične
  teme (sekcija 5 brief-a) i ljudsko odobravanje osetljivih tema preko Telegrama (sekcija 7).
- **Lične podatke komentatora.** Sajt prima komentare, dakle obrađuje lične podatke i mora imati
  Politiku privatnosti koja odgovara stvarnom ponašanju sistema.
- **Autorska prava izvora.** Sistem prepričava svojim rečima i ne objavljuje tuđe tekstove, ali
  granica je stvar procene i rizik ne nestaje.

Ovo treba ozbiljno razmotriti (pravno lice, registracija u Registar medija, savet advokata)
pre nego što sajt poraste ili pre razgovora sa investitorom.

---

## Kako sistem radi (kratko)

```
25 portala ──► Engine 1 (RSS/scraping) ──► raw_items ──► Engine 2 (klasterovanje bez AI-ja)
                                                              │
                                                              ▼
                                                        kapije kvaliteta
                                             (≥3 izvora, ≥2 ugla, nije već pokriveno)
                                                              │
                                                              ▼
                                      Anthropic API ──► članak ──► [osetljivo? ──► Telegram]
                                                              │
                                                              ▼
                                                    Supabase ──► Next.js sajt
```

Ključna odluka: **grupisanje vesti u teme radi se leksički, bez AI-ja** (normalizacija
ćirilica→latinica, srpske stop-reči, TF-IDF nad karakterskim n-gramima, kosinusna sličnost).
AI se poziva tek kada tema prođe kapije kvaliteta — dakle nekoliko desetina puta dnevno, umesto
hiljadama. To je razlog zašto ceo sistem staje u ~$20-25 mesečno.

Pipeline nikada ne piše u git — piše u Supabase. Sajt čita iz Supabase. Padne li jedno, drugo
nastavlja da radi.

## Struktura repozitorijuma

```
config/
  sources.json        ← lista izvora; ovde se menja, ne u kodu
  editorial.json      ← pragovi, dnevne kvote, kategorije, retention
packages/
  core/               ← tipovi, logger, učitavanje i provera konfiguracije
  db/                 ← Supabase klijent (šema i migracije stižu u Fazi 2)
apps/
  pipeline/           ← Node CLI: config | discover | ingest | editorial | sweep
  web/                ← Next.js sajt (Faza 9)
.github/workflows/
  ci.yml              ← typecheck, lint, format, testovi na svaki push
```

## Pokretanje

```bash
npm install                 # jednom
npm run pipeline -- config  # proverava da li su config fajlovi ispravni
npm run check               # typecheck + lint + testovi
```

Ostale komande (`discover`, `ingest`, `editorial`, `sweep`) postoje kao kostur i javljaju u kojoj
fazi stižu.

## Tajne i ključevi

Kopiraj `.env.example` u `.env` i popuni ga. `.env` je u `.gitignore` i **nikad ne sme da uđe u
repozitorijum** — repo je javan.

`SUPABASE_SERVICE_ROLE_KEY` zaobilazi sva bezbednosna pravila baze. Živi samo na tri mesta:
u tvom lokalnom `.env`, u GitHub Secrets i u Vercel env varijablama.

## Tehnologije

TypeScript svuda (bez Pythona), npm workspaces, Node 22. Supabase (Postgres) za bazu,
Next.js 15 na Vercel-u za sajt, GitHub Actions za cron. Anthropic API za pisanje članaka —
Haiku 4.5 podrazumevano, Sonnet 5 za nekoliko glavnih priča dnevno.

Sve osim Anthropic API-ja radi na besplatnim tier-ovima.

## Licenca

MIT — vidi `LICENSE`.
