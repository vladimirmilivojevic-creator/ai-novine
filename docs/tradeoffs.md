# Šta je sada besplatno, šta bi bilo bolje, i koliko bi to koštalo

Ovaj dokument postoji da bi se na pitanje „šta konkretno kupuje veći budžet" moglo odgovoriti
brojkama, a ne rečima „bilo bi bolje".

**Kako čitati oznake pouzdanosti:**

| Oznaka | Značenje |
| --- | --- |
| 📏 **Izmereno** | Imamo stvaran broj iz ovog projekta, sa datumom merenja. |
| 📐 **Procena** | Nismo merili, ali računica ili cenovnik daju razuman red veličine. |
| ❓ **Nepoznato** | Ne znamo dok ne testiramo. Tako je i sa Haiku modelom izgledalo pre nego što smo ga stvarno uporedili sa Sonnet modelom — i ispalo je da razlika postoji i da je bitna. |

Cene trećih strana su sa njihovih cenovnika i **treba ih proveriti pre svake odluke** — menjaju se.

---

## 1. Trenutna ograničenja

### Prikupljanje vesti

| Šta je sada | Zašto | Bolja opcija i cena | Pouzdanost |
| --- | --- | --- | --- |
| **Politika se ne prati** | Sajt vraća HTTP 403 na svaki automatski zahtev, uključujući i `robots.txt`. Zaobilaženje Cloudflare zaštite se ne radi — to je kršenje uslova korišćenja. | Plaćeni servis za dohvatanje (ScraperAPI, ScrapingBee i slični, ulazni paketi oko **$49/mesec**), ili zvanično traženje pristupa od redakcije (besplatno, ali traži vreme i pregovor). | 📏 Izmereno 6.9.2026: 403 i na `/robots.txt`. Da li bi plaćeni servis prošao — 📐 procena, nije probano. |
| **Prva se ne prati** | Nema ni RSS ni sitemap; ostalo bi samo čitanje rubrika. Provladin ugao već pokriva osam izvora. | Čitanje rubrika, isto kao za RTS. Cena: $0, ali još jedan sajt čija promena dizajna nešto obara. | 📐 Procena da ugao ne fali. Nije mereno koliko tema promašimo bez Prve. |
| **RTS i Euronews idu preko čitanja rubrika** | Nemaju ni RSS ni sitemap, a plaćeni servis nije u budžetu. | Isto plaćeni servis, ili dogovor o pristupu podacima. | 📏 Izmereno: obrazac adrese hvata sve članke, CSS selektor je hvatao 36 od 122. Krhkost na redizajn: 📐 procena. |
| **Prikupljanje na 20 minuta, ne na 5** | Brief je tražio 5 minuta. GitHub Actions cron na besplatnom tier-u ne garantuje ni 20 — pokretanja kasne, ponekad i preko sat vremena. | Jeftin server sa pravim cron-om (Hetzner ili sličan VPS, oko **$5/mesec**) daje tačan ritam i od 5 minuta. | 📏 Izmereno 6.9.2026: prvi zakazani ciklus nije okinuo ni posle sat vremena od dodavanja. GitHub to i dokumentuje kao očekivano. |
| **Najviše 25 novih članaka po izvoru u ciklusu** | Zaštita od preopterećenja i od skoka u bazi. | Nema troška da se podigne; nije potrebno dok ponuda tema šestostruko premašuje ono što objavljujemo. | 📏 Izmereno: 810 vesti dnevno stiže i sa ovim ograničenjem. |

### Baza podataka

| Šta je sada | Zašto | Bolja opcija i cena | Pouzdanost |
| --- | --- | --- | --- |
| **Sirove vesti se brišu posle 10 dana** | Supabase besplatni tier ima 500 MB. | Supabase Pro, **$25/mesec**, 8 GB — ali **za ovo trenutno nema potrebe.** | 📏 Izmereno 6.9.2026: prosečna vest je 3.521 bajt, najveći dan 810 vesti = **2,7 MB dnevno**. Deset dana je **27 MB**, a granica je 500 MB. Bez brisanja bismo granicu dodirnuli tek **posle oko 184 dana**. Retention od 10 dana je dakle mnogo stroži nego što mora — može se podići na 60+ dana bez ijednog dinara. |
| **Nema rezervnih kopija ni vraćanja u tačku u vremenu** | Besplatni tier ih nema. | Supabase Pro (**$25/mesec**) donosi dnevne kopije i vraćanje u tačku u vremenu do 7 dana. | 📐 Procena rizika: generisani članci su nezamenljivi (sirove vesti se ionako brišu). Verovatnoća gubitka nije merena. |
| **Veza sa bazom ne proverava sertifikat servera** | Supabase pooler šalje lanac koji Node ne prepoznaje. Veza jeste šifrovana, ali identitet servera nije potvrđen. | Preuzeti Supabase CA sertifikat i pinovati ga — **$0**, samo posao. Planirano za Fazu 11. | 📏 Izmereno: greška „self-signed certificate in certificate chain" na svakoj migraciji. |

### Grupisanje vesti u teme

| Šta je sada | Zašto | Bolja opcija i cena | Pouzdanost |
| --- | --- | --- | --- |
| **Grupisanje bez AI-ja** (TF-IDF nad korenima reči) | Ovo je najveća ušteda u celom sistemu: 636 vesti grupisano za 62 sekunde, uz **nula tokena**. Da se svaka vest šalje modelu, trošak bi bio red veličine veći od svega ostalog. | Vektorska ugrađivanja (embeddings) preko namenskog servisa: red veličine **$0.30–1 mesečno** za naš obim. Nije skupo — ali uvodi drugog provajdera. | 📏 Izmereno: cena $0, vreme 62 s, pragovi podešeni na 635 stvarnih članaka. Da li bi embeddings bolje grupisali — ❓ nepoznato. Poznata greška postoji: TV najava je jednom spojena sa vremenskom prognozom. |
| **Bez Google Trends signala** | `pytrends` je neslužbena biblioteka i traži Python u projektu koji je inače ceo u TypeScript-u. Brief ga je i nazvao opcionim. | Zvanični Google Trends pristup ne postoji kao javan API. Alternativa su plaćeni SEO alati (Semrush, Ahrefs), **od oko $100/mesec naviše**. | ❓ Nepoznato koliko bi promenio izbor tema. Naš signal (učestalost kroz 24 izvora) je za srpske vesti verovatno jači, ali to nije mereno. |

### Pisanje članaka

| Šta je sada | Zašto | Bolja opcija i cena | Pouzdanost |
| --- | --- | --- | --- |
| **10 članaka dnevno** | Budžet. Ovo je glavna poluga troška. | Više članaka je linearno skuplje: svaki dodatni je oko **$0.008** (jeftiniji model) do **$0.017** (jači), kroz Batch API. Trideset članaka dnevno ≈ **$12/mesec**. | 📏 Izmereno 6.9.2026: **65 tema dnevno prolazi kapije kvaliteta, a objavljujemo 10.** Dakle objavljujemo oko 15% onoga što bismo mogli. |
| **Sedam članaka dnevno piše jeftiniji model** | Sonnet je 2,2 puta skuplji po članku. | Svi članci na Sonnet: **+$0.064 dnevno ≈ +$1.9/mesec** pri 10 članaka. Na 30 članaka dnevno razlika je oko **$8/mesec**. | 📏 Izmereno: Haiku $0.0080, Sonnet $0.0173 po članku kroz paket. Razlika u kvalitetu je takođe izmerena — vidi tabelu ispod. |
| **Najjači model (Opus) se ne koristi** | Cena je $5/$25 po milionu tokena, oko 2,5 puta više od Sonnet modela. | Opus za tri glavne priče dnevno: 📐 procena **oko +$0.10 dnevno ≈ $3/mesec**. | ❓ Nepoznato da li bi na srpskom bio primetno bolji od Sonnet modela. Tako je izgledalo i pitanje Haiku naspram Sonnet — dok nismo izmerili. |
| **Batch API: nema trenutne ispravke, članci kasne jedan ciklus** | Pola cene. | Neposredni pozivi: dvostruka cena, ali odgovor odmah i mogućnost da se od modela odmah traži dopuna. Pri 10 članaka dnevno razlika je oko **+$4/mesec**. | 📏 Izmereno: $0.0173 naspram $0.0418 po članku (Sonnet). Zakašnjenje: većina paketa gotova za manje od sat vremena, rok je 24 sata. |
| **Urednički ciklus na 4 sata, ne na sat** | Keš uredničkog prompta traje 5 minuta. Prvi članak svakog ciklusa plaća upis prompta u keš. | Češći ciklusi znače svežije članke i veći trošak: svaki dodatni ciklus je **+$0.016** (paket) do **+$0.032** (neposredno). Ciklus na sat umesto na četiri: 📐 procena **+$1.4/mesec**. | 📏 Izmereno: hladan keš košta +$0.012 (Haiku) i +$0.020 (Sonnet) po ciklusu. |
| **Najviše 8 izveštaja po temi ide modelu, po 1.600 znakova** | Ulazni tokeni se plaćaju. | Puni tekstovi svih izveštaja: 📐 procena da bi ulaz porastao dva do tri puta, dakle oko **+$0.01 po članku**. | ❓ Nepoznato da li bi više materijala dalo bolji članak. Nije testirano. |
| **Mesečna kočnica na $6** | Zaštita od greške u kodu i od dana sa neuobičajeno mnogo vesti. | Podizanje kočnice je stvar jedne linije u `config/editorial.json`. | 📏 Izmereno: plan je $4.20 mesečno pri 10 članaka dnevno. |

### Izmerena razlika u kvalitetu između modela

Ovo je jedina tabela u dokumentu gde je „bolje" stvarno izmereno, i vredi je pokazati investitoru
kao primer kako se odluke donose.

| Mera | Haiku 4.5 | Sonnet 5 |
| --- | --- | --- |
| Dužina članka, pre popravki | 99–302 reči (ispod praga) | 336–483 reči |
| Dužina posle strukturne popravke | 381–392 reči | 449–603 reči |
| Ijekavica u tekstu (pre pravila) | u 2 od 3 članka | ni u jednom |
| Greške u imenima | „Vladimirm Putinom", „na Grami" | nijedna |
| Tačna kategorija | promašena jednom od tri | uvek tačna |
| Cena po članku (paket) | $0.0080 | $0.0173 |

### Sajt i objavljivanje (planirano, Faze 9–11)

| Šta je sada | Zašto | Bolja opcija i cena | Pouzdanost |
| --- | --- | --- | --- |
| **Vercel Hobby** | Besplatno. | Hobby je formalno **za nekomercijalnu upotrebu**. Onog dana kad se pojave reklame ili plaćeni sadržaj, potreban je Vercel Pro, **$20 po korisniku mesečno**. | 📏 Izmereno kao činjenica iz uslova korišćenja. Kada tačno postaje obavezno — 📐 procena, zavisi od tumačenja. |
| **Slike se crtaju kodom, ne generišu AI-jem** | Nula troška po slici i nema pravnog rizika oko prikazivanja stvarnih ličnosti. | Generisanje slika modelom: 📐 procena **oko $0.04 po slici**, dakle oko $12 mesečno pri 10 članaka dnevno — uz pravni rizik koji brief izričito zabranjuje za imenovane osobe. | 📐 Procena cene; šablonske slike još nisu napravljene (Faza 8). |
| **Nema nadzora rada ni praćenja grešaka** | Besplatni tier-ovi postoje, ali nisu postavljeni. | UptimeRobot ima besplatan plan; Sentry besplatan plan pokriva mali obim, timski je **oko $26/mesec**. | 📐 Procena. Trenutno se greške vide samo u GitHub Actions dnevniku i u tabeli `pipeline_runs`. |
| **Repozitorijum je javan** | Uslov za neograničene besplatne GitHub Actions minute. | Privatan repozitorijum sa plaćenim minutima: GitHub Team je **$4 po korisniku mesečno** plus minuti. | 📏 Izmereno kao činjenica: javan repo = neograničeni minuti. Posledica: ceo kod i urednička pravila su javni. Tajne nisu — one su u GitHub Secrets. |

---

## 2. Put rasta

Redosled unutar svakog nivoa je redosled po kome bi se novac trošio.

### Nivo 1 — sadašnji, oko $5 mesečno

Trošak: Anthropic API oko **$4.20**, sve ostalo besplatno.

Šta se dobija: 10 članaka dnevno, 24 izvora, prikupljanje na 20 minuta (nominalno), sajt na
besplatnom hostingu.

**Nadogradnje koje ne koštaju ništa, a nisu urađene:**

1. Podići retention sirovih vesti sa 10 na 60 dana — 📏 izmereno da staje (27 MB naspram 500 MB).
   Duži prozor znači bolje prepoznavanje da se priča nastavlja.
2. Pinovati Supabase CA sertifikat — 📏 izmereno da veza sada nije potvrđena.
3. Postaviti besplatan nadzor rada (UptimeRobot) — 📐 procena da bi uhvatio ispade koje sada
   niko ne vidi do sledećeg pogleda u dnevnik.

### Nivo 2 — oko $50 mesečno

| Redosled | Stavka | Cena | Šta konkretno donosi | Pouzdanost |
| --- | --- | --- | --- | --- |
| 1 | **Više članaka: 30 dnevno umesto 10** | ~$12/mesec ukupno za AI | Objavljivali bismo oko 45% tema koje već prolaze kapije, umesto 15%. | 📏 Izmereno: 65 tema dnevno prolazi kapije; cena po članku poznata. |
| 2 | **Svi članci na jači model** | +$8/mesec pri 30 članaka | Uklanja poznate slabosti jeftinijeg modela (dužina, imena). | 📏 Izmereno na tri teme. |
| 3 | **Vercel Pro** | $20/mesec | Pravno čisto za komercijalnu upotrebu (reklame), veći limiti. | 📏 Cena sa cenovnika. |
| 4 | **Neposredni pozivi umesto paketa za glavne priče** | +$2–4/mesec | Glavne vesti izlaze odmah, ne u sledećem ciklusu. | 📏 Izmereno: razlika u ceni. Da li čitaocima to znači — ❓ nepoznato. |

Zbir: oko $42–44 mesečno.

### Nivo 3 — oko $200 mesečno

| Redosled | Stavka | Cena | Šta konkretno donosi | Pouzdanost |
| --- | --- | --- | --- | --- |
| 1 | **Sve iz nivoa 2** | ~$44 | | |
| 2 | **Supabase Pro** | $25/mesec | Rezervne kopije i vraćanje u tačku u vremenu, 8 GB, veći protok. | 📏 Cena sa cenovnika. |
| 3 | **Plaćeni servis za dohvatanje blokiranih sajtova** | ~$49/mesec | Politika, i svaki budući izvor iza Cloudflare zaštite. | 📐 Procena da bi prošao — nije probano. |
| 4 | **Jeftin server sa pravim cron-om** | ~$5/mesec | Prikupljanje na 5 minuta, kako brief i traži, bez kašnjenja GitHub rasporeda. | 📏 Izmereno da GitHub kasni. |
| 5 | **Više članaka: 60 dnevno** | ~$30/mesec za AI | Praktično sve teme koje prolaze kapije. | 📏 Izmereno: 65 tema dnevno. |
| 6 | **Praćenje grešaka (Sentry)** | ~$26/mesec | Greška u pipeline-u stiže kao obaveštenje, ne kao tišina. | 📐 Procena. |

Zbir: oko $180 mesečno.

### Nivo 4 — oko $1.000 mesečno

Na ovom nivou najveća stavka više nije softver.

| Redosled | Stavka | Cena | Šta konkretno donosi | Pouzdanost |
| --- | --- | --- | --- | --- |
| 1 | **Sve iz nivoa 3** | ~$180 | | |
| 2 | **Honorarni urednik, nekoliko sati dnevno** | 📐 procena $400–600/mesec | Ljudska provera pre objave. Ovo je jedina stavka koja stvarno rešava ono na šta Google „Scaled Content Abuse" politika cilja, i jedina koja pretvara sajt iz automata u medij. | ❓ Nepoznato koliko bi promenilo rangiranje — ali je jedini korak koji menja prirodu proizvoda. |
| 3 | **Najjači model za glavne priče** | ~$10–20/mesec | Tri do pet glavnih tema dnevno piše najjači model. | ❓ Nepoznato da li se razlika vidi na srpskom. Treba izmeriti isto kao Haiku naspram Sonnet. |
| 4 | **Vektorska ugrađivanja za grupisanje** | ~$1–5/mesec | Bolje prepoznavanje da dve vesti govore o istom događaju kad su pisane sasvim drugim rečima. | ❓ Nepoznato koliko bi popravilo — naš leksički pristup već radi dobro na izmerenom uzorku. |
| 5 | **Plaćeni SEO alat** | od ~$100/mesec | Praćenje pozicija i ključnih reči. | ❓ Nepoznato da li bi promenio izbor tema. |
| 6 | **Više izvora, uključujući regionalne** | ~$0 za same izvore | Širi zahvat. Trošak je u AI-ju, ne u prikupljanju. | 📐 Procena. |

---

## Šta bi se dogodilo bez ijednog dinara više

Vredi reći i ovo, jer je iskreno: sistem u sadašnjem obliku radi i objavljuje 10 članaka dnevno za
oko $4 mesečno. Ograničenja koja stvarno smetaju su dva, i nijedno se ne rešava novcem:

1. **Nema ljudske provere pre objave** osim za osetljive teme. To je ono na šta Google cilja, i to
   se ne kupuje serverom nego čovekom.
2. **Prikupljanje kasni** zbog besplatnog rasporeda. To se rešava serverom od pet dolara mesečno.

Sve ostalo je pitanje obima, ne mogućnosti.
