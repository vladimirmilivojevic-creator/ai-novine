# Odloženo za kasnije

Svaki put kad se u nekoj fazi kaže „ovo sada ovako, a kasnije onako", stavka ulazi ovde. Ovo je
jedini spisak koji se pred kraj projekta mora **isprazniti ili svesno zatvoriti** — da nijedno
odlaganje ne postane neprijatno iznenađenje u Fazi 11.

Kolona **kada** kaže u kojoj se fazi stavka rešava. Kolona **ako se zaboravi** kaže šta se stvarno
dešava ako se ne uradi — bez toga je spisak samo lista želja.

**Stanje: 7. septembar 2026. · otvoreno 16 · zatvoreno 0**

---

## Obavezno pre puštanja u rad

Ovo su stavke bez kojih sajt ne sme da ide u produkciju.

| # | Stavka | Zašto je odloženo | Kada | Ako se zaboravi |
| --- | --- | --- | --- | --- |
| 1 | **Sertifikat baze se ne proverava** | Supabase pooler šalje lanac koji Node ne prepoznaje, pa migracije prelaze na šifrovanu vezu bez provere identiteta servera. | Faza 11 | Veza je šifrovana, ali se ne zna sa kim se razgovara. Rešenje: preuzeti Supabase CA sertifikat i pinovati ga. |
| 2 | **`TELEGRAM_WEBHOOK_SECRET` je predvidiv string** | Postavljen je ručno kao proba dok webhook nije postojao. | Faza 11, pre uključivanja webhook-a | Bilo ko ko pogodi adresu webhook-a mogao bi da šalje lažne odluke o objavljivanju. Zameniti nasumičnim nizom od najmanje 32 znaka. |
| 3 | **Nesetljivi članci ostaju `draft` i ne objavljuju se sami** | Sajt još ne postoji, pa nema gde da se objave. | Faza 9 | Sistem piše članke koje niko ne vidi. Kad sajt proradi, treba uključiti automatsko objavljivanje za neosetljive. |
| 4 | **Telegram odgovor stiže tek u sledećem ciklusu** | Webhook traži javnu adresu, koju sajt dobija tek u Fazi 11. | Faza 11 | Dugme na telefonu se vrti dok pipeline ne pokupi odgovor, pa izgleda kao da ništa nije kliknuto. Do tada je to objašnjeno u samoj poruci. |

## Poznati kompromisi koje treba svesno potvrditi

| # | Stavka | Zašto je odloženo | Kada | Ako se zaboravi |
| --- | --- | --- | --- | --- |
| 5 | **Zakazani poslovi kasne 2–3 sata umesto 20 minuta** | GitHub Actions raspored na besplatnom tier-u je „najbolji pokušaj". Izmereno: razmaci 119, 128 i 177 minuta. | Faza 11 ili ranije, ako se kupi server | Sajt objavljuje vesti sa dva sata zakašnjenja. Rešenje je server od oko $5 mesečno. |
| 6 | **GitHub gasi zakazane poslove posle 60 dana bez izmena u repo-u** | Pravilo GitHub-a, ne naša odluka. | Trajno, treba pamtiti | Posle dva meseca mirovanja sajt tiho prestane da radi. GitHub šalje e-poruku; poslovi se vraćaju jednim klikom. |
| 7 | **Retention sirovih vesti je 10 dana, iako staje 60+** | Postavljeno pre merenja, iz opreza. | Bilo kad, besplatno | Duži prozor bolje prepoznaje priče koje se razvijaju. Izmereno: 10 dana troši 27 MB od 500 MB. |
| 8 | **Vercel Hobby je za nekomercijalnu upotrebu** | Besplatno je i dovoljno dok nema reklama. | Kad se pojavi zarada | Prekršaj uslova korišćenja. Vercel Pro je $20 mesečno. |

## Sitnice koje ne blokiraju, ali se lako zaborave

| # | Stavka | Zašto je odloženo | Kada | Ako se zaboravi |
| --- | --- | --- | --- | --- |
| 9 | **Oznaka `needs_flagship` se ne skida posle uspešnog pisanja** | Nije smetalo u praksi. | Bilo kad | Tema koju je jednom promašio jeftiniji model zauvek ide skupljem, i kad to više nije potrebno. Mali višak troška. |
| 10 | **`article_batches`, `review_queue` i `app_state` se ne čiste** | Tabele rastu sporo. | Faza 11 | Redovi se gomilaju bez potrebe. Dodati u `sweep`. |
| 14 | **Slika odbijenog ili obrisanog članka ostaje u skladištu** | Skladište je veliko 1 GB, a slika je 45 KB. | Faza 11, uz stavku 10 | Fajlovi se gomilaju bez ijednog članka koji ih koristi. Pri 10 članaka dnevno to je 16 MB godišnje — smeta urednosti, ne prostoru. |
| 15 | **Slika se precrtava samo ako je dopuna mlađa od nedelju dana** | Prozor je postavljen da upit ostane mali. | Ako se pojavi priča koja živi duže | Članak dopunjen posle sedam dana zadrži staru sliku sa starim naslovom. Do sada nijedna priča nije živela toliko. |
| 16 | **`fflate 0.7.3` ima prijavljenu ranjivost, a ne može se podići** | `satori` ga zaključava na tačnu verziju; nametanje novije ostavi biblioteku bez zavisnosti i crtanje prestane da radi. | Kad `satori` objavi verziju sa novijim `fflate` | Ranjiva funkcija (`unzipSync`, čitanje ZIP arhiva) se u našem toku ne poziva — font je TTF iz našeg repozitorijuma, ne ulaz sa interneta. Proveriti pri svakom podizanju `satori`. |
| 11 | **Članak može preći 900 reči kroz dopune** | Gornja granica se ne proverava, samo donja. | Faza 9, uz sajt | Posle nekoliko dopuna članak postane predugačak za čitanje. |
| 12 | **Promo tekstovi i najave ulaze u grupisanje** | Jedna poznata greška: TV najava spojena sa vremenskom prognozom. | Ako se ponovi | Povremeno se pojavi tema koja nije vest. Rešenje je odbacivanje najava pre grupisanja, ne pomeranje pragova. |
| 13 | **Nema nadzora rada ni obaveštenja o greškama** | Besplatni alati postoje, ali nisu postavljeni. | Faza 11 | Ispad se vidi tek kad neko pogleda dnevnik. UptimeRobot ima besplatan plan. |

---

## Svesno odbačeno — ne vraća se bez novog razloga

Ovo nisu odlaganja nego odluke. Ovde stoje da se ne otvaraju ponovo bez potrebe.

| Stavka | Zašto je odbačeno |
| --- | --- |
| **Politika kao izvor** | Odbija svaki automatski pristup, uključujući `robots.txt`. Zaobilaženje te zaštite je kršenje uslova korišćenja i ne radi se. Otvara se samo ako redakcija da pristup. |
| **Prva kao izvor** | Nema ni RSS ni sitemap, a provladin ugao pokriva osam drugih izvora. |
| **Google Trends (`pytrends`)** | Neslužbena biblioteka, traži Python u projektu koji je ceo u TypeScript-u. Naš signal (učestalost kroz 24 izvora) je za srpske vesti verovatno jači. |
| **AI generisane slike** | Pravni rizik kod imenovanih javnih ličnosti, i trošak po slici. Brief to izričito zabranjuje. Faza 8 je umesto toga uvela 18 šablona crtanih kodom. |
| **Slike iz feed-ova izvora** | Sirove vesti nose adresu fotografije, ali fotografija je tuđe autorsko delo; preuzimanje bi bilo kršenje prava bez obzira što je adresa javna. |
| **Drugi provajderi modela (Gemini, OpenAI)** | Hibrid sa Batch API-jem već staje u budžet. Zabeleženo kao moguća Faza 12. |

---

## Kako se ovaj spisak koristi

- **Na kraju svake faze**: sve što je u toj fazi odloženo dodaje se ovde, u istom potezu.
- **Kad se stavka reši**: briše se iz tabele i upisuje u odeljak „zatvoreno" ispod, sa datumom.
  Ne ostavlja se precrtana — spisak mora da se čita za trideset sekundi.
- **Na početku Faze 11**: ceo spisak se prolazi red po red. Sve iz prve tabele mora biti rešeno;
  za sve ostalo vlasnik odlučuje da li ide u produkciju tako ili se rešava.

## Zatvoreno

*(još ništa — spisak je otvoren 7. septembra 2026)*
