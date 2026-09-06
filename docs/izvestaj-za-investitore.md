# AI Novine — šta je napravljeno i koliko je provereno

Ovaj dokument je pisan tako da ga razume neko ko se ne bavi programiranjem. Bez skraćenica i bez
stručnih izraza; gde je izraz neizbežan, odmah je objašnjen.

**Stanje na dan 7. septembra 2026.**

---

## 1. Šta AI Novine rade

Zamislite čoveka koji svakog jutra otvori dvadeset četiri srpska portala — i one bliske vlasti, i
one koji su prema njoj kritični, i novinske agencije. Pročita sve. Primeti da o istom događaju piše
dvanaest različitih portala, svaki malo drugačije. Sedne i napiše **jedan** tekst o tome, svojim
rečima, bez pristrasnosti, i pošteno kaže gde se izveštaji razilaze.

To je posao koji ovaj sistem radi sam, danonoćno, bez ijednog klika.

Radi u četiri koraka:

**Prvo, čita vesti.** Svakih nekoliko sati obiđe 24 portala i pokupi sve nove tekstove. Za svaki
zapamti naslov, tekst, vreme objave i odakle je. Trenutno je u bazi **2.498 vesti**. Sistem poštuje
pravila svakog sajta — nikad se ne predstavlja lažno i ne opterećuje ničiji server.

**Drugo, prepoznaje o čemu se priča.** Dvanaest tekstova o požaru na Suvoj planini nisu dvanaest
vesti nego jedna tema. Sistem ih sam prepozna i spoji, iako su pisani različitim rečima, a jedan od
njih čak ćirilicom. Zna da su „Vučić", „Vučića" i „Вучић" ista reč. Do sada je 2.498 vesti svrstao
u **1.340 tema**.

**Treće, bira šta zaslužuje članak.** Ovo je najvažnije pravilo celog sistema, i namerno je strogo.
Tema dobija članak samo ako:

- o njoj piše **najmanje tri različita portala**, i
- ti portali su **iz najmanje dva različita tabora** — jer tri lista bliska vlasti koji prenose isto
  saopštenje nisu vest, to je saopštenje.

Zbog tog pravila sistem odbaci veliku većinu tema. Od šezdeset pet tema dnevno koje prođu proveru,
objavi se deset — i to je namerna odluka, ne ograničenje.

**Četvrto, piše članak.** Veštačka inteligencija dobije sve prikupljene izveštaje i uputstvo od
sedamnaest stranica: piši svojim rečima, nikad ne prepisuj rečenicu, ne pominji nijedan medij po
imenu, kad se izveštaji ne slažu oko broja uzmi onaj koji navodi većina i to jasno kaži, a za
krivične teme koristi inicijale i reč „osumnjičen" dok ne padne presuda.

Kad se portali stvarno razilaze u tumačenju — jedni događaj predstavljaju kao uspeh, drugi kao
problem — članak dobija i prikaz **„obe strane"**: dva kratka pasusa, jedan iz svakog ugla. Nikad se
ne kaže koji portal šta misli; piše samo „zvanični ugao" i „kritički ugao".

### Dve stvari koje sistem radi, a koje se ne vide na prvi pogled

**Priča koja se razvija dobija jedan članak koji raste, a ne pet skoro istih.** Ako se vest promeni
— utakmica se odigra, broj povređenih se ispravi — sistem prepozna da o toj temi već postoji članak
i **dopuni ga** umesto da napiše novi. Adresa članka ostaje ista, a stara verzija se čuva.

Primer iz stvarnog rada: članak „Odbojkašice Srbije igraju za bronzu" postao je, kad je meč završen,
„Odbojkašice Srbije osvojile bronzanu medalju" — ista adresa, dopunjen tekst, sačuvana stara
verzija.

**Osetljive teme čekaju vaše odobrenje.** Članak o krivičnom postupku, nesreći sa žrtvama ili
sudskom procesu ne izlazi sam. Sistem ga pošalje na vaš telefon, preko Telegrama, sa dva dugmeta:
odobri ili odbij. Dok ne pritisnete dugme, članak stoji. Ako ne odgovorite u roku od dva sata,
ostaje neobjavljen — ćutanje se ne računa kao odobrenje.

### Koliko ovo košta

**Oko četiri dolara i dvadeset centi mesečno.** To je ceo trošak: plaćaju se samo pozivi veštačkoj
inteligenciji koja piše tekstove. Baza podataka, server, raspoređivanje poslova i alat za praćenje
izmena — sve to radi na besplatnim planovima.

Za poređenje: jedna kafa u centru Beograda košta više nego što ovaj sistem potroši za deset dana.

U sistem je ugrađena i **kočnica**: čim mesečni trošak dostigne šest dolara, pisanje se zaustavlja
do prvog u narednom mesecu. Bolje da nekog dana nema novih članaka nego da račun izmakne kontroli
zbog greške.

---

## 2. Koliko je ovo ozbiljno provereno

### Šta je „automatski test"

Kad programer nešto napravi, može da proveri da li radi na dva načina.

Prvi je da pokrene program i pogleda. To je kao kad kuvar proba jelo — radi za tu porciju, ali ako
sutra promeni recept, mora ponovo da proba sve, i lako će nešto zaboraviti.

Drugi način je **automatski test**: mali program koji proverava drugi program. Napiše se jednom, i
posle se pokreće sam, za dve sekunde, koliko god puta treba.

Konkretan primer iz ovog projekta. Napisano je pravilo: „Vučića", „Vučiću" i „Вучић" treba da se
prepoznaju kao ista reč. Test za to pita program upravo to, i uporedi odgovor sa očekivanim. Ako
neko sutra promeni način prepoznavanja reči i slučajno pokvari to pravilo, test odmah pukne i
promena se ne može objaviti dok se ne popravi.

Sistem trenutno ima **182 takve provere**, i sve se pokreću automatski pri svakoj izmeni koda.

### Zašto je to važnije nego što zvuči

Testovi ovde nisu formalnost. Kroz izradu su uhvatili greške koje niko ne bi primetio gledanjem
ekrana:

- **Pretraživanje RSS adresa bilo je potpuno mrtvo.** U jedan red koda se, prilikom automatske
  izmene fajla, upisao nevidljivi znak. Program nije prijavljivao grešku — samo je uvek vraćao
  prazan rezultat. Uhvatio ga je test, ne pregled koda.
- **Vreme objave bilo je pomereno za dva sata.** Program je vreme sa srpskih sajtova čitao po
  vremenskoj zoni računara na kome radi. Na razvojnom računaru je to slučajno bilo tačno, a na
  serveru bi svaki članak dobio pogrešno vreme. Test je pao samo na serveru — i time otkrio grešku
  koja bi inače tiho kvarila podatke.

### Kako je broj provera rastao

Brojevi su izvučeni iz istorije izmena projekta, faza po faza.

| Faza | Šta je faza donela | Broj provera |
| --- | --- | ---: |
| 0 | Kostur projekta i podešavanja | 11 |
| 1 | Pronalaženje izvora vesti | 31 |
| 2 | Baza podataka i prvo prikupljanje | 68 |
| 3 | Prikupljanje sa svih 24 izvora | 80 |
| 4 | Prepoznavanje tema | 109 |
| 4a | Popravke posle vašeg pregleda | 124 |
| 5 | Pisanje članaka | 147 |
| 5a | Smanjenje troška | 161 |
| 6 | Dopuna postojećih članaka | 166 |
| 7 | Odobravanje osetljivih članaka | 182 |
| 8 | Naslovne slike članaka | **206** |

Svaka izmena koda automatski pokreće svih 206 provera na tuđem računaru (GitHub), i to **dvaput** —
jednom u jednoj vremenskoj zoni, jednom u drugoj, upravo zbog one greške sa pomerenim vremenom.

---

## 3. Šta je koja faza donela, običnim jezikom

**Faza 0 — temelji.** Postavljen je kostur projekta: gde stoji koji fajl, kako se pokreće, kako se
proverava. Ništa se spolja ne vidi, ali bez toga se dalje ne može. Tu je i napisana pravna napomena
da naziv „AI Novine Redakcija" u impresumu ne predstavlja stvarnu pravnu zaštitu.

**Faza 1 — pronalaženje izvora.** Sistem je sam obišao 26 srpskih portala i za svaki utvrdio kako
mu se može pristupiti. Rezultat: 16 portala nudi uredan spisak vesti (takozvani RSS), 5 nudi drugi
oblik spiska, 4 zahtevaju čitanje same stranice, a Politika automatski odbija svaki pristup. Politika
je zato izostavljena — zaobilaženje te zaštite bi bilo kršenje njihovih uslova korišćenja.

**Faza 2 — baza i prvo prikupljanje.** Napravljena je baza podataka i prikupljene su prve vesti sa
tri portala. Tada je otkriveno da program s dva Danasova članka izvlači pogrešan tekst — hvatao je
blok „povezane vesti" umesto samog članka. Dodata su još dva načina izvlačenja teksta, pa sistem
danas uspešno pročita 621 od 636 članaka.

**Faza 3 — svi izvori.** Prikupljanje je prošireno na svih 24 aktivna portala kroz tri različita
načina pristupa. Dodato je i automatsko brisanje starih vesti i dva posla koji se pokreću sami.

**Faza 4 — prepoznavanje tema.** Ovo je srce sistema i **ne košta ništa** — grupisanje se radi
matematički, bez veštačke inteligencije. Da se svaka vest šalje veštačkoj inteligenciji, trošak bi
bio višestruko veći od svega ostalog. Ispravno prepoznavanje je provereno na 635 stvarnih članaka.
Vi ste pregledom uhvatili jednu temu koja je pogrešno spojila dve priče; uzrok je bio RTS-ov
„pregled dana" koji u jednom tekstu pokriva više događaja, i to je popravljeno.

**Faza 5 — pisanje.** Sistem je prvi put napisao članke. Upoređena su dva modela veštačke
inteligencije na istim temama: jeftiniji je pisao prekratke tekstove (i jedan od svega 99 reči,
prekinut usred rečenice) i mešao hrvatske oblike reči u srpski tekst. Skuplji nije imao te
probleme. Umesto da se odmah pređe na skuplji, pravila su prepravljena tako da i jeftiniji radi
posao — i sada oba pišu tekstove od 380 do 600 reči. Trošak je zatim prepolovljen prelaskom na
takozvanu paketnu obradu, gde se tekstovi naručuju unapred i stižu sa malim zakašnjenjem, ali za
pola cene.

**Faza 6 — dopuna umesto ponavljanja.** Priča koja se razvija sada dobija jedan članak koji raste.
Ovo nije samo lepše za čitaoca: Google od januara 2025. kažnjava sajtove koji masovno objavljuju
sličan sadržaj, i dopuna umesto ponavljanja je glavna odbrana od toga.

**Faza 7 — vaše odobrenje za osetljive teme.** Članak o krivičnom postupku ili nesreći sa žrtvama
sada stiže na vaš telefon pre objave, sa dugmadima „odobri" i „odbij". Rešeno je tako da radi i pre
nego što sajt uopšte postoji na internetu — bot sam proverava da li ste odgovorili, umesto da čeka
da ga neko pozove.

**Faza 8 — slike uz članke.** Svaki članak dobija svoju naslovnu sliku. Slike se **crtaju
programski** — boja rubrike, geometrijski oblik i naslov — a ne generišu veštačkom inteligencijom
i ne preuzimaju sa drugih sajtova. To znači tri stvari: ne koštaju ništa, ne mogu prikazati stvarnu
osobu u situaciji u kojoj nije bila, i nema pitanja čija je slika. Na svakoj piše **„Tekst
generisala veštačka inteligencija · AI Novine"**, i to upečeno u samu sliku, tako da natpis ostane
i kada neko sliku podeli na Fejsbuku bez otvaranja članka. Šablona ima 18, po tri za svaku od šest
rubrika, pa se članci međusobno razlikuju a sve slike i dalje izgledaju kao isti list.

---

## 4. Šta trenutno postoji, u brojkama

| | |
| --- | ---: |
| Portala koji se prate | 24 |
| Prikupljenih vesti u bazi | 2.498 |
| Prepoznatih tema | 1.340 |
| Napisanih članaka | 5 |
| Dopuna postojećih članaka | 2 |
| Dužina članaka | 374–867 reči |
| Ukupno potrošeno na veštačku inteligenciju do sada | $0,22 |
| Napravljenih naslovnih slika | 5 |
| Automatskih provera koje se stalno pokreću | 206 |

Mali broj članaka nije slabost sistema nego posledica toga što je do sada radio uglavnom probno.
Kada se pusti u redovan rad, piše deset članaka dnevno.

---

## 5. Šta još nije napravljeno

Projekat ima jedanaest faza; završeno je devet (0 do 8). Preostaje:

- **Faza 9** — sam sajt: naslovna strana, rubrike, stranica članka, prikaz „obe strane", pretraga.
- **Faza 10** — pravne stranice, komentari čitalaca i podešavanja za pretraživače.
- **Faza 11** — puštanje u rad na adresi ainovine.rs i dva dana posmatranja.

---

## 6. Iskrena slika ograničenja

Dokument `docs/tradeoffs.md` sadrži potpun spisak onoga što je urađeno jeftino i šta bi bilo bolje
uz veći budžet, sa jasnom oznakom da li je nešto **izmereno**, **procenjeno** ili **nepoznato dok se
ne isproba**. Dva ograničenja koja se najviše osećaju:

1. **Vesti stižu sporije nego što je planirano.** Traženo je da se portali obilaze svakih dvadeset
   minuta; besplatni raspoređivač u praksi to radi na svaka dva do tri sata (izmereno: razmaci od
   119, 128 i 177 minuta). Rešenje je server od oko pet dolara mesečno — to je najisplativija
   nadogradnja u celom projektu.

2. **Nema ljudske provere pre objave**, osim za osetljive teme. To se ne kupuje serverom nego
   čovekom, i to je jedina stavka koja bi sajt pretvorila iz automata u medij u punom smislu.
