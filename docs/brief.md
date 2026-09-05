# AI NOVINE (ainovine.rs) — Projektni brief za Claude Code

## 0. Ko sam ja i kako da radiš sa mnom

Ja sam student IT-a. Znam da programiram, ali nisam ekspert za DevOps, deployment,
baze podataka u produkciji, ni za pravljenje ovakvih sistema od nule. Tretiraj me kao
pametnog junior programera kome treba objašnjenje SVAKOG koraka koji ja moram ručno
da uradim (kreiranje naloga, kopiranje API ključeva, DNS podešavanja, klikovi u
dashboard-ovima). Za sve to — pretpostavi da ne znam ništa i daj mi tačne korake
(gde da kliknem, šta da nalepim, gde).

Sve što TI možeš sam da uradiš (instalacija paketa, pisanje koda, git komande,
pokretanje test servera, pisanje testova, popravljanje grešaka) — radi sam, bez
čekanja na mene, osim kad ti treba moja odluka ili moj ključ/token.

**VAŽNO — kako da kreneš:** Ne piši kod odmah. Uđi u istraživačko/plansko
razmišljanje: pročitaj ovaj ceo brief, postavi mi pitanja ako nešto nije jasno, i
napravi mi detaljan fazni plan (arhitektura + redosled gradnje, faza po faza — vidi
sekciju 11) PRE nego što napišeš ijednu liniju koda. Sačekaj da ti ja potvrdim plan.
Posle svake faze iz plana — zastani, objasni šta si napravio, reci mi tačno šta
treba da testiram/proverim, i sačekaj moju potvrdu pre nego što nastaviš na sledeću
fazu. Ne pokušavaj da napraviš ceo sistem u jednom potezu.

## 1. Šta se pravi (proizvod, jednom rečenicom za investitore)

AI Novine je sajt koji svakih 5 minuta prati ~20-25 najvećih srpskih portala (svih
političkih boja), AI izdvaja koje vesti su bitne, piše originalan, neutralan članak
o svakoj (ne prepisuje, sam formuliše na osnovu prikupljenih informacija), i —
kad se izvori stvarno razilaze u tumačenju — nudi čitaocu i "obe strane" pregled.
Cilj je da bude čitljiviji i modernije dizajniran nego postojeći alati ovog tipa
(npr. Ground News), i da posle ~mesec dana uspešnog rada bude prezentovan
investitoru kao biznis.

## 2. Tvrda ograničenja

- **Budžet ~0.** Sve mora da radi na besplatnim tier-ovima gde god je moguće.
  Jedini prihvatljiv gotovinski trošak je Anthropic API pozivi za generisanje
  članaka (procena: $10-30/mesec sa Haiku 4.5 modelom za par desetina članaka
  dnevno — ovo je ODVOJENO od developerske Claude Code pretplate).
- Ne koristi nijedan plaćeni servis (scraping API, SEO alat, foto-agencija,
  plaćeni hosting tier) bez da me prvo pitaš i objasniš zašto je vredno para.
- Koristi najnovije, moderne, dobro održavane tehnologije i biblioteke — ne
  zastarele pristupe. Ali radije jednostavniju arhitekturu (manje pokretnih
  delova, jedan jezik gde je moguće) nego "cool" ali komplikovanu, jer sam
  početnik i moram sve ovo i sam da održavam posle.
- Ceo sistem mora da radi potpuno automatski (bez ručnog pokretanja) čim se
  postavi — cilj je 24/7 automatski pipeline od prvog dana produkcije.

## 3. Izvori vesti — Engine 1 (RSS/scraping monitor)

Prati sledeće portale na svakih 20 minuta. Ovo je POLAZNA lista — sastavljena iz
javnih istraživanja poverenja u medije u Srbiji (Rojtersov institut, CRTA, ANEM),
namerno šira od 20 da imam iz čega da biram. Ja ću sam da je finalizujem/menjam
kasnije direktno u konfiguracionom fajlu — napravi je lako izmenljivom (JSON/YAML
lista, ne zakucano u kod).

**Provladini/desni ugao:** Informer (informer.rs), Alo (alo.rs), Pink (pink.rs),
Kurir (kurir.rs), Politika (politika.rs), Novosti (novosti.rs), Happy (happy.rs),
Srbija Danas (srbijadanas.com), Prva (www.prva.rs)

**Kritički/opozicioni ugao:** N1 (n1info.rs), Nova.rs (nova.rs), Danas (danas.rs),
Vreme (vreme.com), Insajder (insajder.net), BIRN Srbija (birn.rs / balkaninsight.com
lokalni deo), Južne vesti (juznevesti.com), KRIK (krik.rs), Cenzolovka (cenzolovka.rs)

**Mejnstrim/manje jasno svrstani:** Blic (blic.rs), Telegraf (telegraf.rs),
Mondo (mondo.rs), B92 (b92.net), RTS (rts.rs), Euronews Srbija (euronews.rs)

**Agencije (činjenički sloj, manje tona):** Tanjug (tanjug.rs), Beta (beta.rs)

**Prvi konkretan zadatak (uradi ovo pre svega ostalog u ovoj fazi):** napiši
skriptu koja za svaki gornji domen proveri postoji li RSS feed (standardne putanje:
/feed, /rss, /feed/rss2, /rss.xml, i traženje `<link rel="alternate"
type="application/rss+xml">` u HTML-u početne strane, plus provera sitemap.xml).
Napravi mi izveštaj: koji sajt ima RSS (i na kom URL-u), a koji nema. Za one bez
RSS-a, predloži jednostavan HTML-scraping fallback (ali samo za taj sajt, sa
poštovanjem robots.txt i razumnim intervalom — ne agresivno; predstavi se
korektnim User-Agent-om, ne glumi pravi browser).

Samo srpski sajtovi za sada. Ako neki izvor blokira pristup (Cloudflare, IP ban) —
taj izvor se preskače tog ciklusa, log-uje se upozorenje, sistem nastavlja dalje
(ne sme da padne ceo pipeline zbog jednog izvora).

## 4. Trending engine — Engine 2

Cilj: otkriti o čemu se u datom trenutku najviše priča u Srbiji, da bi se to
iskoristilo u tekstu članaka (SEO), ali VIDI upozorenje u sekciji 9 pre nego što
ovo implementiraš agresivno.

- **Primarni, besplatan i pouzdan izvor:** analiza učestalosti ključnih reči i
  imena/entiteta among naslova i tekstova koje Engine 1 već skuplja iz 20+
  izvora. Ako se ista tema/ime pojavljuje kod mnogo različitih izvora u istom
  vremenskom prozoru — to JESTE trending signal, bez ikakvog spoljnog API-ja.
- **Sekundarno, best-effort:** koristi `pytrends` (Python, neslužbena Google
  Trends biblioteka, besplatna ali može povremeno da otkaže jer nije zvanična
  Google API) da obogatiš/potvrdiš signal za Srbiju. Tretiraj kao opcioni,
  ne-kritičan sloj — ako otkaže, pipeline nastavlja bez njega.
- Nemoj integrisati nijedan plaćen SEO/trending alat (SEMrush, Ahrefs, Exploding
  Topics i sl.).

## 5. AI logika sinteze i pisanja članaka

- AI ne pravi fiksan broj članaka po ciklusu. On procenjuje, na osnovu koliko
  izvora javlja istu temu, koliko se tema ponavlja kroz vreme, i trending
  signala — da li tema "zaslužuje" članak.
- **Ne pravi novi članak za razvoj već postojeće priče u kratkom vremenskom
  periodu** — ako je isti event/tema već pokrivena pre npr. 1-3 sata, AŽURIRAJ
  postojeći članak (dodaj pasus, promeni "poslednja izmena" vreme) umesto da
  praviš novi, skoro identičan članak. Ovo je važno i za kvalitet i za SEO
  (vidi sekciju 9).
- Podrazumevano: JEDAN neutralan članak, napisan svojim rečima na osnovu svih
  prikupljenih izvora o toj temi (nikad blisko parafraziranje jedne rečenice iz
  jednog izvora — stvarno prepričavanje, druga struktura, drugi redosled
  informacija).
- Kad se izvori STVARNO razilaze u tumačenju/uglu (ne u činjenicama, nego u
  tome kako se priča ispriča) — dodaj opcioni "Pogledaj obe strane" prikaz:
  dva panela, moderan i pregledan dizajn (bolji UX od Ground News — jasna
  tipografija, čitljivost na mobilnom, ne pretrpan). Panele NE etiketiraj
  imenom konkretnog izvora ("N1 kaže...") — koristi generičke oznake ugla,
  npr. "Zvanični/vladin ugao" i "Kritički/opozicioni ugao", ili slično.
  Ne pominji nigde u članku spisak izvora niti odakle je AI "inspirisan".
- Kad se izvori razilaze u KONKRETNOJ ČINJENICI (broj, cifra, citat) — koristi
  broj koji najviše izvora navodi, sa jasnom ogradom u tekstu (npr. "prema
  većini izvora, poginulo je oko 20 osoba"). Nikad ne izmišljaj tačan broj kad
  ne postoji konsenzus, i nikad ne izmišljaj citate koji nisu zaista negde
  izgovoreni.
- **Pravilo za krivične/optužujuće teme** (standardna novinarska praksa u
  Srbiji, ne pravna rupa): dok neko nije pravosnažno osuđen, koristi inicijale
  i godine ("M.J. (34)") umesto punog imena, i formulacije "osumnjičen je",
  "navodno" — nikad ne tvrdi krivicu kao činjenicu pre presude.
- Kategorije/rubrike: politika, ekonomija, društvo/hronika, sport, region, svet
  — svaka može imati sopstvenu učestalost objavljivanja (npr. sport ređe nego
  politika ako nema dovoljno materijala).

## 6. Slike

Cilj: praktično besplatno, bez pravnog rizika.

- **Podrazumevano rešenje: brendovane šablonske ilustracije generisane kodom**
  (ne AI generisane slike — to bi trošilo API tokene za svaki članak). Napravi
  set od ~15-20 SVG/HTML-to-image šablona (jedan po kategoriji/temi: politika,
  ekonomija, sport, hronika, svet, region + par varijacija), u doslednom
  vizuelnom identitetu (boje, tipografija, logo AI Novina). Generiši sliku
  "cover"-a programski (npr. `@vercel/og` ili `satori` biblioteka za
  Node/Next.js, ili slično) — nula API troška po slici.
- Kao dopunu za raznovrsnost, možeš da povučeš generičke tematske fotografije
  (ne vezane za konkretan event, samo ilustrativne) preko **besplatnih API-ja**
  kao Unsplash API ili Pexels API (oba imaju velikodušan besplatan tier za
  komercijalnu upotrebu bez kompleksnog licenciranja).
- **NE generiši fotorealistične AI slike konkretnih, imenovanih javnih
  ličnosti** (predsednik, ministri, poznate osobe) — to je poseban pravni/etički
  rizik nezavisno od budžeta. Za teme koje uključuju konkretne osobe, koristi
  generičku ilustraciju kategorije, ne pokušaj da "nacrtaš" tu osobu.

## 7. Ljudska provera osetljivih tema (Telegram bot)

- Pre automatskog objavljivanja članka koji spada u osetljive kategorije
  (krivični postupci, imenovane optužbe, tragedije/žrtve, sudski postupci,
  zdravstvene teme vezane za konkretne osobe) — pošalji mi draft članka na
  Telegram (koristeći Telegram Bot API, besplatno) sa dugmićima "Odobri" /
  "Odbij" (inline keyboard). Članak se objavljuje TEK nakon što odobrim. Ako
  odbijem ili ne odgovorim u razumnom roku (npr. 2h), članak ostaje kao draft,
  ne objavljuje se automatski.
- Ne-osetljive teme (sport, vremenska prognoza, opšta ekonomija i sl.) idu
  direktno u objavu bez čekanja na mene.

## 8. Transparentnost i pravne stranice (OVO JE OBAVEZNO, ne opciono)

- Na SVAKOM članku, SVAKOJ slici (vidljiv vodeni žig ili natpis), i footeru
  sajta mora jasno da piše da je sadržaj generisan veštačkom inteligencijom.
- Napravi posebnu stranicu "Kako AI Novine rade" — detaljno, ljudskim jezikom,
  objašnjava metodologiju: koji izvori se prate, kako se biraju teme, kako se
  piše članak, šta znači "obe strane" prikaz, kako se prijavljuje greška.
- Napravi stranicu Politika privatnosti (jer sajt ima komentare = obrađuje
  lične podatke komentatora — email/IP), Uslovi korišćenja, i Uređivačka
  politika/Metodologija (može se spojiti sa "Kako AI Novine rade").
- U Impresumu, javno na sajtu, kao urednik/redakcija piše "AI Novine
  Redakcija" (ne moje lično ime) — ovo je moja svesna odluka za test fazu.
  **Ostavi mi u README.md fajlu projekta (ne na sajtu, samo interno u repo-u)
  jasnu napomenu da ovo NE predstavlja stvarnu pravnu zaštitu — ja ostajem
  pravno odgovoran kao vlasnik domena/hostinga/naloga bez obzira šta piše u
  javnom impresumu, i da ću to razmotriti ozbiljnije ako/kad dođe investitor
  ili ako sajt poraste.**

## 9. SEO — VAŽNO upozorenje koje mora da utiče na arhitekturu

Google od januara 2025. ima politiku "Scaled Content Abuse" — sajtovi koji
masovno generišu sadržaj bez dodate vrednosti/ljudske dorade dobijaju najnižu
ocenu kvaliteta i mogu biti kažnjeni (de-indeksirani). Ovo NE znači da AI
sadržaj ne može da rangira — može, ako ima stvarnu vrednost. Praktične mere
koje MORAJU da postoje u sistemu:

- Pravilo iz sekcije 5 (ažuriraj postojeći članak umesto dupliranja) — ovo je
  ključna zaštita.
- Minimalna dužina/kvalitet članka pre objave (ne "tanak" rerajt od 2 rečenice).
- Stranica "Kako AI Novine rade" iz sekcije 8 sama po sebi je pozitivan signal
  (transparentnost, E-E-A-T).
- Koristi trending reči (Engine 2) da INFORMIŠEŠ o čemu da se piše, ne da ih
  na silu ubacuješ u tekst gde nemaju smisla — veštačko "keyword stuffing" je
  upravo ono što Google kažnjava.

## 10. Komentari

Uključi komentare na članke (obična, jednostavna implementacija — ne mora
poseban servis treće strane koji nešto naplaćuje). Dodaj osnovnu zaštitu od
spama (honeypot polje + rate limit po IP je dovoljno za početak, ne treba
plaćeni anti-spam servis).

## 11. Predloženi tehnički stek i faze (ti finalizuj u plan fazi)

Moj predlog kao polazna tačka — slobodno promeni ako imaš bolju ideju za
POČETNIKA i BESPLATNO:

- **Repo:** GitHub, JAVAN (public) — daje neograničene besplatne GitHub Actions
  minute, što pokreće ceo pipeline na cron rasporedu (*/5 * * * *).
- **Jezik:** po mogućstvu TypeScript end-to-end (Next.js frontend + Node.js
  skripte za pipeline) da ne žongliram dva jezika kao početnik — ali ako
  proceniš da je Python bolji za RSS/tekst-parsing deo, obrazloži i predloži.
- **Baza:** Supabase ili Neon (free tier Postgres) — Supabase ima grafički
  interfejs za pregled tabela što mi je kao početniku korisno.
- **Frontend hosting:** Vercel (free tier), Next.js, kasnije povezan domen
  ainovine.rs.
- **AI generisanje:** Anthropic API, model Haiku 4.5 kao podrazumevani (najjeftiniji za masovnu produkciju); razmisli da li nekoliko "glavnih" priča dnevno vredi generisati boljim modelom radi kvaliteta za investitorsku prezentaciju.
- **Telegram:** Telegram Bot API (besplatno).
- **Slike:** kod-generisani template-i (sekcija 6), bez API troška.

**Predloženi redosled faza:**

1. Plan i arhitektura (bez koda) — ovaj dokument + tvoje istraživanje kodne baze
2. RSS discovery skripta (sekcija 3) + osnovni scraping/RSS engine za 2-3 test
   izvora, provera da radi
3. Skaliranje Engine 1 na ceo spisak izvora + baza podataka za sirove vesti
4. Trending Engine 2 (unutrašnja analiza učestalosti + pytrends)
5. AI generation pipeline (osnovna verzija, tekst samo, bez slika/Telegrama)
   — testiraj kvalitet članaka pre nego što ideš dalje
6. Telegram bot za odobravanje osetljivih tema
7. Image pipeline (šabloni)
8. Frontend (Next.js): lista članaka, stranica članka, "obe strane" prikaz,
   pretraga, kategorije
9. Pravne/transparentne stranice + komentari + osnovni SEO (meta tagovi,
   sitemap, robots.txt)
10. Deployment: GitHub Actions cron + Vercel + DNS za ainovine.rs, end-to-end
    test 24-48h da vidim da sve radi samo
11. (Kasnije, posle uspešnog meseca) — društvene mreže, mobilna aplikacija

Posle svake faze: zastani, objasni šta je urađeno, reci mi tačno šta da
proverim/testiram, i sačekaj potvrdu.

## 12. Van obima za sada (svesno odloženo)

- Formalna registracija u Registar medija — ne za MVP fazu.
- Zvanično pravno lice (firma/preduzetnik) — ne za sada.
- Društvene mreže i mobilna aplikacija — posle uspešnog meseca na sajtu.
- Strane vesti/portali — samo Srbija za sada.
