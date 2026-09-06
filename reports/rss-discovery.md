# RSS discovery izveštaj

**Datum provere:** 6. 9. 2026. 13:11:58
**Provereno izvora:** 26

Izveštaj generiše `npm run pipeline -- discover`. Provera ide redom: `robots.txt`, pa `<link rel="alternate">` u HTML-u početne strane, pa standardne RSS putanje (`/feed`, `/rss`, `/rss.xml`, `/feed/rss2` i varijante), pa `sitemap.xml`. Svaki feed se i preuzima i parsira — sajt koji na `/feed` vrati HTML stranu ne računa se kao RSS.

## Zbirno

| Ishod | Broj izvora |
| --- | --- |
| RSS radi | 16 |
| Bez RSS-a, ali ima news sitemap | 5 |
| Bez RSS-a — treba scraping | 4 |
| Blokira botove | 1 |

## Svi izvori

| Izvor | Ugao | Ishod | Najbolji feed | Stavki | Najnovija vest |
| --- | --- | --- | --- | --- | --- |
| Informer | provladin | Bez RSS-a, ali ima news sitemap | — | — | — |
| Alo | provladin | Bez RSS-a, ali ima news sitemap | — | — | — |
| Pink | provladin | RSS radi | `https://pink.rs/rss-feed` | 50 | pre 1 h |
| Kurir | provladin | RSS radi | `https://www.kurir.rs/rss` | 100 | pre 17 min |
| Politika | provladin | Blokira botove | — | — | — |
| Vecernje novosti | provladin | Bez RSS-a, ali ima news sitemap | — | — | — |
| Happy TV | provladin | RSS radi | `https://happytv.rs/feed/` | 40 | pre 6 min |
| Srbija Danas | provladin | RSS radi | `https://www.sd.rs/rss.xml` | 100 | pre 7 min |
| Prva | provladin | Bez RSS-a — treba scraping | — | — | — |
| N1 | kriticki | RSS radi | `https://n1info.rs/feed/` | 50 | pre 3 min |
| Nova.rs | kriticki | RSS radi | `https://nova.rs/feed/` | 50 | pre 3 min |
| Danas | kriticki | RSS radi | `https://www.danas.rs/feed/` | 50 | pre 10 min |
| Vreme | kriticki | RSS radi | `https://vreme.com/feed/` | 12 | pre 48 min |
| Insajder | kriticki | RSS radi | `https://insajder.net/feed.xml` | 100 | pre 24 min |
| BIRN Srbija | kriticki | Bez RSS-a — treba scraping | — | — | — |
| Juzne vesti | kriticki | RSS radi | `https://www.juznevesti.com/feed/` | 10 | pre 41 min |
| KRIK | kriticki | RSS radi | `https://www.krik.rs/feed/` | 10 | pre 2 dana |
| Cenzolovka | kriticki | RSS radi | `https://www.cenzolovka.rs/feed/` | 20 | pre 44 h |
| Blic | mejnstrim | Bez RSS-a, ali ima news sitemap | — | — | — |
| Telegraf | mejnstrim | RSS radi | `https://www.telegraf.rs/rss` | 20 | pre 2 min |
| Mondo | mejnstrim | RSS radi | `https://mondo.rs/rss/629/Naslovna` | 100 | pre 7 min |
| B92 | mejnstrim | RSS radi | `https://www.b92.net/rss/latest` | 20 | pre 7 min |
| RTS | mejnstrim | Bez RSS-a — treba scraping | — | — | — |
| Euronews Srbija | mejnstrim | Bez RSS-a — treba scraping | — | — | — |
| Tanjug | agencija | Bez RSS-a, ali ima news sitemap | — | — | — |
| Beta | agencija | RSS radi | `https://beta.rs/rss` | 10 | pre 13 min |

## Izvori sa ispravnim RSS-om

### Pink

Početna: https://pink.rs · robots.txt: dostupan

| Feed | Tip | Pronađen preko | Stavki | Najnovija vest | U config |
| --- | --- | --- | --- | --- | --- |
| `https://pink.rs/rss-feed` | atom | html | 50 | pre 1 h | da |

### Kurir

Početna: https://www.kurir.rs · robots.txt: dostupan

| Feed | Tip | Pronađen preko | Stavki | Najnovija vest | U config |
| --- | --- | --- | --- | --- | --- |
| `https://www.kurir.rs/rss` | rss | html | 100 | pre 17 min | da |
| `https://www.kurir.rs/rss/najnovije-vesti` | rss | html | 100 | pre 7 min | da |
| `https://www.kurir.rs/rss/vesti` | rss | html | 100 | pre 21 min | da |
| `https://www.kurir.rs/rss/vesti/politika` | rss | html | 100 | pre 21 min | — |
| `https://www.kurir.rs/rss/vesti/drustvo` | rss | html | 100 | pre 21 min | — |
| `https://www.kurir.rs/rss/vesti/srbija` | rss | html | 100 | pre 8 h | — |
| `https://www.kurir.rs/rss/vesti/beograd` | rss | html | 100 | pre 5 h | — |
| `https://www.kurir.rs/rss/stars` | rss | html | 100 | pre 7 min | da |
| `https://www.kurir.rs/rss/sport` | rss | html | 100 | pre 11 min | da |
| `https://www.kurir.rs/rss/sport/fudbal` | rss | html | 100 | pre 11 min | — |
| `https://www.kurir.rs/rss/sport/kosarka` | rss | html | 100 | pre 24 min | — |
| `https://www.kurir.rs/rss/sport/tenis` | rss | html | 100 | pre 27 min | — |
| `https://www.kurir.rs/rss/crna-hronika` | rss | html | 100 | pre 17 min | — |
| `https://www.kurir.rs/rss/region` | rss | html | 100 | pre 12 min | — |
| `https://www.kurir.rs/rss/planeta` | rss | html | 100 | pre 1 h | — |
| `https://www.kurir.rs/rss/zabava` | rss | html | 100 | pre 25 min | — |
| `https://www.kurir.rs/rss/zabava/kultura` | rss | html | 100 | pre 2 h | — |
| `https://www.kurir.rs/rss/zabava/pop-kultura` | rss | html | 100 | pre 25 min | — |
| `https://www.kurir.rs/rss/zabava/zena` | rss | html | 100 | pre 7 h | — |
| `https://www.kurir.rs/rss/zabava/tech` | rss | html | 8 | pre 7 dana | — |
| `https://www.kurir.rs/rss/biznis` | rss | html | 100 | pre 14 min | — |
| `https://www.kurir.rs/rss/zdravlje` | rss | html | 100 | pre 29 min | — |

> Sajt nudi 22 feed-ova (glavni plus po jedan za svaku rubriku). U `config/sources.json` ulazi 5 — dohvatati sve značilo bi višestruko veći saobraćaj ka istom sajtu za skoro isti sadržaj.

### Happy TV

Početna: https://happytv.rs · robots.txt: dostupan

| Feed | Tip | Pronađen preko | Stavki | Najnovija vest | U config |
| --- | --- | --- | --- | --- | --- |
| `https://happytv.rs/feed/` | rss | html | 40 | pre 6 min | da |
| `https://happytv.rs/comments/feed/` | rss | html | 40 | pre 5 dana | — |

> Sajt nudi 2 feed-ova (glavni plus po jedan za svaku rubriku). U `config/sources.json` ulazi 1 — dohvatati sve značilo bi višestruko veći saobraćaj ka istom sajtu za skoro isti sadržaj.

### Srbija Danas

Početna: https://www.srbijadanas.com · robots.txt: dostupan

| Feed | Tip | Pronađen preko | Stavki | Najnovija vest | U config |
| --- | --- | --- | --- | --- | --- |
| `https://www.sd.rs/rss.xml` | rss | html | 100 | pre 7 min | da |

### N1

Početna: https://n1info.rs · robots.txt: dostupan

| Feed | Tip | Pronađen preko | Stavki | Najnovija vest | U config |
| --- | --- | --- | --- | --- | --- |
| `https://n1info.rs/feed/` | rss | putanja | 50 | pre 3 min | da |

### Nova.rs

Početna: https://nova.rs · robots.txt: dostupan

| Feed | Tip | Pronađen preko | Stavki | Najnovija vest | U config |
| --- | --- | --- | --- | --- | --- |
| `https://nova.rs/feed/` | rss | putanja | 50 | pre 3 min | da |

### Danas

Početna: https://www.danas.rs · robots.txt: dostupan

| Feed | Tip | Pronađen preko | Stavki | Najnovija vest | U config |
| --- | --- | --- | --- | --- | --- |
| `https://www.danas.rs/feed/` | rss | html | 50 | pre 10 min | da |
| `https://www.danas.rs/comments/feed/` | rss | html | 50 | pre 21 min | — |

> Sajt nudi 2 feed-ova (glavni plus po jedan za svaku rubriku). U `config/sources.json` ulazi 1 — dohvatati sve značilo bi višestruko veći saobraćaj ka istom sajtu za skoro isti sadržaj.

### Vreme

Početna: https://vreme.com · robots.txt: dostupan

| Feed | Tip | Pronađen preko | Stavki | Najnovija vest | U config |
| --- | --- | --- | --- | --- | --- |
| `https://vreme.com/feed/` | rss | putanja | 12 | pre 48 min | da |

### Insajder

Početna: https://insajder.net · robots.txt: dostupan

| Feed | Tip | Pronađen preko | Stavki | Najnovija vest | U config |
| --- | --- | --- | --- | --- | --- |
| `https://insajder.net/feed.xml` | rss | html | 100 | pre 24 min | da |
| `https://insajder.net/feed` | rss | putanja | 100 | pre 55 min | da |

### Juzne vesti

Početna: https://www.juznevesti.com · robots.txt: dostupan

| Feed | Tip | Pronađen preko | Stavki | Najnovija vest | U config |
| --- | --- | --- | --- | --- | --- |
| `https://www.juznevesti.com/feed/` | rss | html | 10 | pre 41 min | da |
| `https://www.juznevesti.com/comments/feed/` | rss | html | 10 | pre 1 h | — |

> Sajt nudi 2 feed-ova (glavni plus po jedan za svaku rubriku). U `config/sources.json` ulazi 1 — dohvatati sve značilo bi višestruko veći saobraćaj ka istom sajtu za skoro isti sadržaj.

### KRIK

Početna: https://www.krik.rs · robots.txt: dostupan

| Feed | Tip | Pronađen preko | Stavki | Najnovija vest | U config |
| --- | --- | --- | --- | --- | --- |
| `https://www.krik.rs/feed/` | rss | html | 10 | pre 2 dana | da |
| `https://www.krik.rs/comments/feed/` | rss | html | 10 | pre 2097 dana | — |

> Sajt nudi 2 feed-ova (glavni plus po jedan za svaku rubriku). U `config/sources.json` ulazi 1 — dohvatati sve značilo bi višestruko veći saobraćaj ka istom sajtu za skoro isti sadržaj.

### Cenzolovka

Početna: https://www.cenzolovka.rs · robots.txt: dostupan

| Feed | Tip | Pronađen preko | Stavki | Najnovija vest | U config |
| --- | --- | --- | --- | --- | --- |
| `https://www.cenzolovka.rs/feed/` | rss | html | 20 | pre 44 h | da |
| `https://www.cenzolovka.rs/comments/feed/` | rss | html | 20 | pre 1108 dana | — |

> Sajt nudi 2 feed-ova (glavni plus po jedan za svaku rubriku). U `config/sources.json` ulazi 1 — dohvatati sve značilo bi višestruko veći saobraćaj ka istom sajtu za skoro isti sadržaj.

### Telegraf

Početna: https://www.telegraf.rs · robots.txt: dostupan

| Feed | Tip | Pronađen preko | Stavki | Najnovija vest | U config |
| --- | --- | --- | --- | --- | --- |
| `https://www.telegraf.rs/rss` | rss | putanja | 20 | pre 2 min | da |

### Mondo

Početna: https://mondo.rs · robots.txt: dostupan

| Feed | Tip | Pronađen preko | Stavki | Najnovija vest | U config |
| --- | --- | --- | --- | --- | --- |
| `https://mondo.rs/rss/629/Naslovna` | rss | html | 100 | pre 7 min | da |
| `https://mondo.rs/rss/644/Sport` | rss | html | 100 | pre 12 min | da |
| `https://mondo.rs/rss/646/Sport/Fudbal` | rss | html | 100 | pre 12 min | — |
| `https://mondo.rs/rss/652/Sport/Kosarka` | rss | html | 100 | pre 2 h | — |
| `https://mondo.rs/rss/657/Sport/Tenis` | rss | html | 100 | pre 3 h | — |
| `https://mondo.rs/rss/660/Sport/Ostali-sportovi` | rss | html | 100 | pre 2 h | — |
| `https://mondo.rs/rss/631/Info` | rss | html | 100 | pre 7 min | da |
| `https://mondo.rs/rss/640/Info/Drustvo` | rss | html | 100 | pre 27 min | — |
| `https://mondo.rs/rss/11427/Info/Politika` | rss | html | 100 | pre 3 h | — |
| `https://mondo.rs/rss/641/Info/Crna-hronika` | rss | html | 100 | pre 1 h | — |
| `https://mondo.rs/rss/642/Info/Ekonomija` | rss | html | 100 | pre 4 h | — |
| `https://mondo.rs/rss/637/Info/Srbija` | rss | html | 100 | pre 6 dana | — |
| `https://mondo.rs/rss/639/Info/Beograd` | rss | html | 100 | pre 19 h | — |
| `https://mondo.rs/rss/638/Info/Svet` | rss | html | 100 | pre 58 min | — |
| `https://mondo.rs/rss/643/Info/EX-YU` | rss | html | 100 | pre 7 min | — |
| `https://mondo.rs/rss/11312/Info/Novi-Sad-na-Mondu` | rss | html | 100 | pre 20 dana | — |
| `https://mondo.rs/rss/663/Zabava` | rss | html | 100 | pre 7 min | da |
| `https://mondo.rs/rss/665/Zabava/Zvezde-i-tracevi` | rss | html | 100 | pre 7 min | — |
| `https://mondo.rs/rss/671/Zabava/TV` | rss | html | 100 | pre 16 h | — |
| `https://mondo.rs/rss/673/Zabava/Film` | rss | html | 100 | pre 39 h | — |
| `https://mondo.rs/rss/674/Zabava/Muzika` | rss | html | 100 | pre 6 h | — |
| `https://mondo.rs/rss/675/Zabava/Zanimljivosti` | rss | html | 100 | pre 15 dana | — |
| `https://mondo.rs/rss/676/Zabava/Kultura` | rss | html | 100 | pre 18 h | — |
| `https://mondo.rs/rss/678/Magazin` | rss | html | 100 | pre 1 h | da |
| `https://mondo.rs/rss/680/Magazin/Ljubav` | rss | html | 100 | pre 5 dana | — |
| `https://mondo.rs/rss/681/Magazin/Stil` | rss | html | 100 | pre 1 h | — |
| `https://mondo.rs/rss/685/Magazin/Zdravlje` | rss | html | 100 | pre 30 h | — |
| `https://mondo.rs/rss/822/Horoskop` | rss | html | 100 | pre 6 h | — |

> Sajt nudi 28 feed-ova (glavni plus po jedan za svaku rubriku). U `config/sources.json` ulazi 5 — dohvatati sve značilo bi višestruko veći saobraćaj ka istom sajtu za skoro isti sadržaj.

### B92

Početna: https://www.b92.net · robots.txt: dostupan

| Feed | Tip | Pronađen preko | Stavki | Najnovija vest | U config |
| --- | --- | --- | --- | --- | --- |
| `https://www.b92.net/rss/latest` | rss | putanja | 20 | pre 7 min | da |
| `https://www.b92.net/rss/b92` | rss | putanja | 20 | pre 7 min | da |

### Beta

Početna: https://beta.rs · robots.txt: dostupan

| Feed | Tip | Pronađen preko | Stavki | Najnovija vest | U config |
| --- | --- | --- | --- | --- | --- |
| `https://beta.rs/rss` | rss | putanja | 10 | pre 13 min | da |

## Izvori bez RSS-a — predlog fallback-a

Za svaki od ovih izvora predlog je: krenuti od rubrika koje se najčešće pojavljuju na početnoj strani, uzimati linkove na članke iz njih, i tekst vaditi sa same stranice članka. Sve uz poštovanje `robots.txt`, jedan zahtev u sekundi i korektan User-Agent.

### Prva

Početna: https://www.prva.rs · robots.txt: dostupan

Najčešće rubrike na početnoj strani:

| Rubrika | Linkova | Primer |
| --- | --- | --- |
| `/zivot` | 78 | https://www.prva.rs/zivot/astro/20037/najdetaljniji-nedeljni-horoskop-od-7-do-13-septembra-koga-ceka-buran-ljubavni-period-ko-je-umoran-od-svega-a-ko-ce-imati-napade-gladi/vest |
| `/formati` | 75 | https://www.prva.rs/formati/emisija |
| `/video` | 36 | https://www.prva.rs/video/jutro/117524/da-li-je-letnjim-vrelinama-kraj |
| `/showbiz` | 18 | https://www.prva.rs/showbiz/vesti/19913/premijere-domacih-serija-i-najgledaniji-svetski-tv-sou-ove-jeseni-na-prvoj/vest |
| `/horoskop` | 12 | https://www.prva.rs/horoskop/ovan |
| `/stranica` | 9 | https://www.prva.rs/stranica/1/prva |

Predlog za `config/sources.json`:

```json
{
  "listingUrls": [
    "https://www.prva.rs/zivot/",
    "https://www.prva.rs/formati/",
    "https://www.prva.rs/video/"
  ],
  "itemLinkSelector": "article a[href], h2 a[href], h3 a[href]",
  "linkPattern": "^/(zivot|formati|video)/",
  "maxLinksPerRun": 30
}
```

### BIRN Srbija

Početna: https://birn.rs · robots.txt: dostupan

**Sitemap-ovi pronađeni** (obični, ne news):

- `https://birn.rs/sitemaps.xml` — indeks, 4 unosa
- `https://birn.rs/post-sitemap1.xml` — urlset, 992 unosa
- `https://birn.rs/post_tag-sitemap1.xml` — urlset, 36 unosa
- `https://birn.rs/page-sitemap1.xml` — urlset, 29 unosa
- `https://birn.rs/sitemaps.xml` — indeks, 4 unosa
- `https://birn.rs/sitemaps.xml` — indeks, 4 unosa

Najčešće rubrike na početnoj strani:

| Rubrika | Linkova | Primer |
| --- | --- | --- |
| `/novinar` | 21 | https://birn.rs/novinar/sasa-dragojlo/ |
| `/kategorija` | 13 | https://birn.rs/kategorija/odbrana/ |
| `/u-fokusu` | 6 | https://birn.rs/u-fokusu/digitalna-prava/ |
| `/vrsta-clanka` | 4 | https://birn.rs/vrsta-clanka/vesti/ |
| `/projekat` | 1 | https://birn.rs/projekat/kako-se-planiraju-i-izvode-javna-ulaganja/ |

Predlog za `config/sources.json`:

```json
{
  "listingUrls": [
    "https://birn.rs/novinar/",
    "https://birn.rs/kategorija/",
    "https://birn.rs/u-fokusu/"
  ],
  "itemLinkSelector": "article a[href], h2 a[href], h3 a[href]",
  "linkPattern": "^/(novinar|kategorija|u-fokusu)/",
  "maxLinksPerRun": 30
}
```

### RTS

Početna: https://www.rts.rs · robots.txt: dostupan

Najčešće rubrike na početnoj strani:

| Rubrika | Linkova | Primer |
| --- | --- | --- |
| `/magazin` | 120 | https://www.rts.rs/magazin/zivot.html |
| `/vesti` | 116 | https://www.rts.rs/vesti/politika.html |
| `/sport` | 73 | https://www.rts.rs/sport/fudbal.html |
| `/rts` | 54 | https://www.rts.rs/rts/muzicka-produkcija.html |
| `/tv` | 34 | https://www.rts.rs/tv/rts1.html |
| `/radio` | 30 | https://www.rts.rs/radio/radio-beograd-1.html |

Predlog za `config/sources.json`:

```json
{
  "listingUrls": [
    "https://www.rts.rs/magazin/",
    "https://www.rts.rs/vesti/",
    "https://www.rts.rs/sport/"
  ],
  "itemLinkSelector": "article a[href], h2 a[href], h3 a[href]",
  "linkPattern": "^/(magazin|vesti|sport)/",
  "maxLinksPerRun": 30
}
```

### Euronews Srbija

Početna: https://www.euronews.rs · robots.txt: dostupan

Najčešće rubrike na početnoj strani:

| Rubrika | Linkova | Primer |
| --- | --- | --- |
| `/srbija` | 129 | https://www.euronews.rs/srbija/politika |
| `/magazin` | 116 | https://www.euronews.rs/magazin/zivot |
| `/evropa` | 65 | https://www.euronews.rs/evropa/vesti |
| `/svet` | 65 | https://www.euronews.rs/svet/fokus |
| `/biznis` | 61 | https://www.euronews.rs/biznis/biznis-vesti |
| `/putovanja` | 23 | https://www.euronews.rs/putovanja/novosti |

Predlog za `config/sources.json`:

```json
{
  "listingUrls": [
    "https://www.euronews.rs/srbija/",
    "https://www.euronews.rs/magazin/",
    "https://www.euronews.rs/evropa/"
  ],
  "itemLinkSelector": "article a[href], h2 a[href], h3 a[href]",
  "linkPattern": "^/(srbija|magazin|evropa)/",
  "maxLinksPerRun": 30
}
```

### Informer

Početna: https://informer.rs · robots.txt: dostupan

**Ima news sitemap** — to je bolje od scraping-a: uredan XML sa svežim člancima.

- `https://informer.rs/sitemap/news.xml` (1000 unosa)

Najčešće rubrike na početnoj strani:

| Rubrika | Linkova | Primer |
| --- | --- | --- |
| `/politika` | 50 | https://informer.rs/politika/vesti/1148191/vucic-blokaderi-tompson-koncerti |
| `/magazin` | 34 | https://informer.rs/magazin/recepti |
| `/dzet-set` | 31 | https://informer.rs/dzet-set/estrada/1148189/milena-stamenkovic-deka-rodjendan-porodica |
| `/planeta` | 28 | https://informer.rs/planeta/vesti/1148188/kijev-stiv-vitkof-dzerar-kusner-evropa |
| `/drustvo` | 26 | https://informer.rs/drustvo/srbija/1148182/pozar-suva-planina-vatrogasci |
| `/hronika` | 20 | https://informer.rs/hronika/region/1148180/pucnjava-crna-gora-podgorica-teretana |

Predlog za `config/sources.json`:

```json
{
  "listingUrls": [
    "https://informer.rs/politika/",
    "https://informer.rs/magazin/",
    "https://informer.rs/dzet-set/"
  ],
  "itemLinkSelector": "article a[href], h2 a[href], h3 a[href]",
  "linkPattern": "^/(politika|magazin|dzet-set)/",
  "maxLinksPerRun": 30
}
```

### Alo

Početna: https://www.alo.rs · robots.txt: dostupan

**Ima news sitemap** — to je bolje od scraping-a: uredan XML sa svežim člancima.

- `https://www.alo.rs/sitemap/google-news-sitemap.xml` (442 unosa)

Najčešće rubrike na početnoj strani:

| Rubrika | Linkova | Primer |
| --- | --- | --- |
| `/vesti` | 51 | https://www.alo.rs/vesti/drustvo.html |
| `/razonoda` | 28 | https://www.alo.rs/razonoda/istorija.html |
| `/vip` | 25 | https://www.alo.rs/vip/estrada.html |
| `/biz` | 22 | https://www.alo.rs/biz/novac.html |
| `/hronika` | 15 | https://www.alo.rs/hronika/nesrece.html |
| `/sport-mobile` | 10 | https://www.alo.rs/sport-mobile/fudbal/16935465/trener-milana-opleo-po-srbinu-umislja-da-je-desetka.html |

Predlog za `config/sources.json`:

```json
{
  "listingUrls": [
    "https://www.alo.rs/vesti/",
    "https://www.alo.rs/razonoda/",
    "https://www.alo.rs/vip/"
  ],
  "itemLinkSelector": "article a[href], h2 a[href], h3 a[href]",
  "linkPattern": "^/(vesti|razonoda|vip)/",
  "maxLinksPerRun": 30
}
```

### Vecernje novosti

Početna: https://www.novosti.rs · robots.txt: dostupan

**Ima news sitemap** — to je bolje od scraping-a: uredan XML sa svežim člancima.

- `https://www.novosti.rs/sitemaps/xml/news` (343 unosa)

Najčešće rubrike na početnoj strani:

| Rubrika | Linkova | Primer |
| --- | --- | --- |
| `/vesti` | 215 | https://www.novosti.rs/vesti/politika |
| `/sport` | 142 | https://www.novosti.rs/sport/fudbal |
| `/planeta` | 100 | https://www.novosti.rs/planeta/svet |
| `/drustvo` | 66 | https://www.novosti.rs/drustvo/vesti |
| `/hronika` | 53 | https://www.novosti.rs/hronika/zlocin |
| `/ekonomija` | 53 | https://www.novosti.rs/ekonomija/vesti |

Predlog za `config/sources.json`:

```json
{
  "listingUrls": [
    "https://www.novosti.rs/vesti/",
    "https://www.novosti.rs/sport/",
    "https://www.novosti.rs/planeta/"
  ],
  "itemLinkSelector": "article a[href], h2 a[href], h3 a[href]",
  "linkPattern": "^/(vesti|sport|planeta)/",
  "maxLinksPerRun": 30
}
```

### Blic

Početna: https://www.blic.rs · robots.txt: dostupan

**Ima news sitemap** — to je bolje od scraping-a: uredan XML sa svežim člancima.

- `https://www.blic.rs/sitemap-stories-news-news.xml.gz` (516 unosa)

Najčešće rubrike na početnoj strani:

| Rubrika | Linkova | Primer |
| --- | --- | --- |
| `/vesti` | 51 | https://www.blic.rs/vesti/politika |
| `/biznis` | 35 | https://www.blic.rs/biznis/vesti/vucic-obilazi-zapadnobackom-okrugu/yqcg9xb |
| `/zabava` | 32 | https://www.blic.rs/zabava/kuca-u-krcedinu-vila-na-dedinju-tri-stana-u-beogradu-imovina-naseg-pevaca/l9rzbhe |
| `/video-strana` | 16 | https://www.blic.rs/video-strana/vucic-magnetna-rezonanca-u-somboru-u-najkracem-roku/0l9bnQlx?playlistId=cSR1hD8z |
| `/zdravlje` | 10 | https://www.blic.rs/zdravlje/zdravstvena-stanja/trovanje-hranom-moze-izazvati-dugotrajni-sindrom-nervoznih-creva-ovo-su-simptomi/2cp1bl6 |
| `/slobodno-vreme` | 10 | https://www.blic.rs/slobodno-vreme/najskuplja-napustena-kuca-na-balkanu-vredi-pravo-bogatstvo-a-15-godina-propada/kxebgxy |

Predlog za `config/sources.json`:

```json
{
  "listingUrls": [
    "https://www.blic.rs/vesti/",
    "https://www.blic.rs/biznis/",
    "https://www.blic.rs/zabava/"
  ],
  "itemLinkSelector": "article a[href], h2 a[href], h3 a[href]",
  "linkPattern": "^/(vesti|biznis|zabava)/",
  "maxLinksPerRun": 30
}
```

### Tanjug

Početna: https://www.tanjug.rs · robots.txt: dostupan

**Ima news sitemap** — to je bolje od scraping-a: uredan XML sa svežim člancima.

- `https://www.tanjug.rs/sitemap/news.xml` (385 unosa)

Najčešće rubrike na početnoj strani:

| Rubrika | Linkova | Primer |
| --- | --- | --- |
| `/srbija` | 60 | https://www.tanjug.rs/srbija/politika |
| `/svet` | 50 | https://www.tanjug.rs/svet/politika |
| `/ekonomija` | 35 | https://www.tanjug.rs/ekonomija/srbija |
| `/sport` | 25 | https://www.tanjug.rs/sport/fudbal |
| `/region` | 22 | https://www.tanjug.rs/region/politika |
| `/kultura` | 19 | https://www.tanjug.rs/kultura/art |

Predlog za `config/sources.json`:

```json
{
  "listingUrls": [
    "https://www.tanjug.rs/srbija/",
    "https://www.tanjug.rs/svet/",
    "https://www.tanjug.rs/ekonomija/"
  ],
  "itemLinkSelector": "article a[href], h2 a[href], h3 a[href]",
  "linkPattern": "^/(srbija|svet|ekonomija)/",
  "maxLinksPerRun": 30
}
```

## Izvori koji blokiraju botove

Ovi sajtovi odbijaju automatske zahteve (Cloudflare ili slična zaštita). Zaobilaženje te zaštite je kršenje njihovih uslova korišćenja i ne radi se. Realne opcije su: izbaciti izvor, ili im zvanično napisati i tražiti pristup.

- **Politika** (https://www.politika.rs) — robots.txt: blokiran (HTTP 403)
  - Sajt odbija i sam robots.txt sa HTTP 403 — aktivno blokira botove. Ne dohvatamo dalje; zaobilazenje te zastite bilo bi krsenje uslova koriscenja.

## Dnevnik provera

Sve isprobane putanje, izvor po izvor.

<details>
<summary>Informer — 8 provera</summary>

- `https://informer.rs/feed` → HTTP 404
- `https://informer.rs/rss` → HTTP 200 ali sadrzaj nije feed (verovatno obicna HTML strana)
- `https://informer.rs/rss.xml` → HTTP 404
- `https://informer.rs/feed/rss2` → HTTP 404
- `https://informer.rs/atom.xml` → HTTP 404
- `https://informer.rs/index.xml` → HTTP 404
- `https://informer.rs/?feed=rss2` → HTTP 200 ali sadrzaj nije feed (verovatno obicna HTML strana)
- `https://informer.rs/sitemap/news.xml` → sitemap (urlset, news, 1000 unosa)

</details>

<details>
<summary>Alo — 10 provera</summary>

- `https://rss.html/` → greska — Mrezna greska: fetch failed (getaddrinfo ENOTFOUND rss.html)
- `https://www.alo.rs/feed` → HTTP 404
- `https://www.alo.rs/rss` → HTTP 404
- `https://www.alo.rs/rss.xml` → HTTP 404
- `https://www.alo.rs/feed/rss2` → HTTP 404
- `https://www.alo.rs/atom.xml` → HTTP 404
- `https://www.alo.rs/index.xml` → HTTP 404
- `https://www.alo.rs/?feed=rss2` → HTTP 200 ali sadrzaj nije feed (verovatno obicna HTML strana)
- `https://www.alo.rs/sitemap/sitemap-index.xml` → sitemap (indeks, 69 unosa)
- `https://www.alo.rs/sitemap/google-news-sitemap.xml` → sitemap (urlset, news, 442 unosa)

</details>

<details>
<summary>Pink — 6 provera</summary>

- `https://pink.rs/rss-feed` → feed (atom, 50 stavki)
- `https://pink.rs/feed` → HTTP 200 ali sadrzaj nije feed (verovatno obicna HTML strana)
- `https://pink.rs/rss.xml` → HTTP 404
- `https://pink.rs/atom.xml` → HTTP 404
- `https://pink.rs/index.xml` → HTTP 404
- `https://pink.rs/?feed=rss2` → HTTP 200 ali sadrzaj nije feed (verovatno obicna HTML strana)

</details>

<details>
<summary>Kurir — 24 provera</summary>

- `https://www.kurir.rs/rss` → feed (rss, 100 stavki)
- `https://www.kurir.rs/rss/najnovije-vesti` → feed (rss, 100 stavki)
- `https://www.kurir.rs/rss/vesti` → feed (rss, 100 stavki)
- `https://www.kurir.rs/rss/vesti/politika` → feed (rss, 100 stavki)
- `https://www.kurir.rs/rss/vesti/drustvo` → feed (rss, 100 stavki)
- `https://www.kurir.rs/rss/vesti/srbija` → feed (rss, 100 stavki)
- `https://www.kurir.rs/rss/vesti/beograd` → feed (rss, 100 stavki)
- `https://www.kurir.rs/rss/stars` → feed (rss, 100 stavki)
- `https://www.kurir.rs/rss/sport` → feed (rss, 100 stavki)
- `https://www.kurir.rs/rss/sport/fudbal` → feed (rss, 100 stavki)
- `https://www.kurir.rs/rss/sport/kosarka` → feed (rss, 100 stavki)
- `https://www.kurir.rs/rss/sport/tenis` → feed (rss, 100 stavki)
- `https://www.kurir.rs/rss/crna-hronika` → feed (rss, 100 stavki)
- `https://www.kurir.rs/rss/region` → feed (rss, 100 stavki)
- `https://www.kurir.rs/rss/planeta` → feed (rss, 100 stavki)
- `https://www.kurir.rs/rss/zabava` → feed (rss, 100 stavki)
- `https://www.kurir.rs/rss/zabava/kultura` → feed (rss, 100 stavki)
- `https://www.kurir.rs/rss/zabava/pop-kultura` → feed (rss, 100 stavki)
- `https://www.kurir.rs/rss/zabava/zena` → feed (rss, 100 stavki)
- `https://www.kurir.rs/rss/zabava/tech` → feed (rss, 8 stavki)
- `https://www.kurir.rs/rss/biznis` → feed (rss, 100 stavki)
- `https://www.kurir.rs/rss/zdravlje` → feed (rss, 100 stavki)
- `https://www.kurir.rs/sitemaps-v2/index.xml` → sitemap (indeks, 29 unosa)
- `https://www.kurir.rs/sitemaps-v2/news.xml` → sitemap (urlset, news, 676 unosa)

</details>

<details>
<summary>Politika — 0 provera</summary>


</details>

<details>
<summary>Vecernje novosti — 8 provera</summary>

- `https://www.novosti.rs/feed` → HTTP 404
- `https://www.novosti.rs/rss` → HTTP 200 ali sadrzaj nije feed (verovatno obicna HTML strana)
- `https://www.novosti.rs/rss.xml` → HTTP 404
- `https://www.novosti.rs/feed/rss2` → HTTP 404
- `https://www.novosti.rs/atom.xml` → HTTP 404
- `https://www.novosti.rs/index.xml` → HTTP 404
- `https://www.novosti.rs/?feed=rss2` → HTTP 200 ali sadrzaj nije feed (verovatno obicna HTML strana)
- `https://www.novosti.rs/sitemaps/xml/news` → sitemap (urlset, news, 343 unosa)

</details>

<details>
<summary>Happy TV — 8 provera</summary>

- `https://happytv.rs/feed/` → feed (rss, 40 stavki)
- `https://happytv.rs/comments/feed/` → feed (rss, 40 stavki)
- `https://happytv.rs/rss.xml` → HTTP 404
- `https://happytv.rs/atom.xml` → HTTP 404
- `https://happytv.rs/index.xml` → HTTP 404
- `https://happytv.rs/sitemap_index.xml` → sitemap (indeks, 476 unosa)
- `https://happytv.rs/post-sitemap.xml` → sitemap (urlset, 1000 unosa)
- `https://happytv.rs/post-sitemap2.xml` → sitemap (urlset, 1000 unosa)

</details>

<details>
<summary>Srbija Danas — 10 provera</summary>

- `https://www.sd.rs/rss.xml` → feed (rss, 100 stavki)
- `https://www.srbijadanas.com/feed` → HTTP 403
- `https://www.srbijadanas.com/rss` → HTTP 404
- `https://www.srbijadanas.com/feed/rss2` → HTTP 404
- `https://www.srbijadanas.com/atom.xml` → HTTP 404
- `https://www.srbijadanas.com/index.xml` → HTTP 404
- `https://www.srbijadanas.com/?feed=rss2` → HTTP 200 ali sadrzaj nije feed (verovatno obicna HTML strana)
- `https://www.sd.rs/sitemap/index.xml` → sitemap (indeks, 153 unosa)
- `https://www.sd.rs/googlenews.xml` → sitemap (urlset, news, 474 unosa)
- `https://www.sd.rs/sitemap/latest` → sitemap (urlset, 97 unosa)

</details>

<details>
<summary>Prva — 11 provera</summary>

- `https://www.prva.rs/feed` → HTTP 404
- `https://www.prva.rs/rss` → HTTP 200 ali sadrzaj nije feed (verovatno obicna HTML strana)
- `https://www.prva.rs/rss.xml` → HTTP 404
- `https://www.prva.rs/feed/rss2` → HTTP 404
- `https://www.prva.rs/atom.xml` → HTTP 404
- `https://www.prva.rs/index.xml` → HTTP 404
- `https://www.prva.rs/?feed=rss2` → HTTP 200 ali sadrzaj nije feed (verovatno obicna HTML strana)
- `https://www.prva.rs/sitemap.xml` → HTTP 404
- `https://www.prva.rs/sitemap_index.xml` → HTTP 404
- `https://www.prva.rs/sitemap-news.xml` → HTTP 404
- `https://www.prva.rs/news-sitemap.xml` → HTTP 404

</details>

<details>
<summary>N1 — 10 provera</summary>

- `https://n1info.rs/feed` → feed (rss, 50 stavki)
- `https://n1info.rs/rss` → HTTP 404
- `https://n1info.rs/rss.xml` → HTTP 404
- `https://n1info.rs/feed/rss2` → HTTP 404
- `https://n1info.rs/atom.xml` → HTTP 404
- `https://n1info.rs/index.xml` → HTTP 404
- `https://n1info.rs/?feed=rss2` → HTTP 200 ali sadrzaj nije feed (verovatno obicna HTML strana)
- `https://n1info.rs/sitemap/sitemap_news_1.xml` → sitemap (urlset, news, 252 unosa)
- `https://n1info.rs/sitemap/sitemap_category_1.xml` → sitemap (urlset, 92 unosa)
- `https://n1info.rs/sitemap/sitemap_post_1.xml` → sitemap (urlset, 1000 unosa)

</details>

<details>
<summary>Nova.rs — 10 provera</summary>

- `https://nova.rs/feed` → feed (rss, 50 stavki)
- `https://nova.rs/rss` → HTTP 404
- `https://nova.rs/rss.xml` → HTTP 404
- `https://nova.rs/feed/rss2` → HTTP 404
- `https://nova.rs/atom.xml` → HTTP 404
- `https://nova.rs/index.xml` → HTTP 404
- `https://nova.rs/?feed=rss2` → HTTP 200 ali sadrzaj nije feed (verovatno obicna HTML strana)
- `https://nova.rs/sitemap/sitemap_news_1.xml` → sitemap (urlset, news, 324 unosa)
- `https://nova.rs/sitemap/sitemap_category_1.xml` → sitemap (urlset, 92 unosa)
- `https://nova.rs/sitemap/sitemap_post_1.xml` → sitemap (urlset, 1000 unosa)

</details>

<details>
<summary>Danas — 5 provera</summary>

- `https://www.danas.rs/feed/` → feed (rss, 50 stavki)
- `https://www.danas.rs/comments/feed/` → feed (rss, 50 stavki)
- `https://www.danas.rs/rss.xml` → HTTP 404
- `https://www.danas.rs/atom.xml` → HTTP 404
- `https://www.danas.rs/index.xml` → HTTP 404

</details>

<details>
<summary>Vreme — 7 provera</summary>

- `https://vreme.com/feed/` → preskoceno — robots.txt zabranjuje
- `https://vreme.com/feed` → feed (rss, 12 stavki)
- `https://vreme.com/rss.xml` → HTTP 200 ali sadrzaj nije feed (verovatno obicna HTML strana)
- `https://vreme.com/feed/rss2` → preskoceno — robots.txt zabranjuje
- `https://vreme.com/sitemaps.xml` → sitemap (indeks, 110 unosa)
- `https://vreme.com/post-sitemap1.xml` → sitemap (urlset, 1001 unosa)
- `https://vreme.com/post-sitemap2.xml` → sitemap (urlset, 1000 unosa)

</details>

<details>
<summary>Insajder — 10 provera</summary>

- `https://insajder.net/feed.xml` → feed (rss, 100 stavki)
- `https://insajder.net/feed` → feed (rss, 100 stavki)
- `https://insajder.net/rss` → HTTP 404
- `https://insajder.net/rss.xml` → HTTP 404
- `https://insajder.net/feed/rss2` → HTTP 404
- `https://insajder.net/atom.xml` → HTTP 404
- `https://insajder.net/index.xml` → HTTP 404
- `https://insajder.net/?feed=rss2` → HTTP 200 ali sadrzaj nije feed (verovatno obicna HTML strana)
- `https://insajder.net/sitemap.xml` → sitemap (indeks, 996 unosa)
- `https://insajder.net/news-sitemap.xml` → sitemap (urlset, news, 128 unosa)

</details>

<details>
<summary>BIRN Srbija — 12 provera</summary>

- `https://birn.rs/feed` → HTTP 200 ali sadrzaj nije feed (verovatno obicna HTML strana)
- `https://birn.rs/rss.xml` → HTTP 404
- `https://birn.rs/atom.xml` → HTTP 404
- `https://birn.rs/index.xml` → HTTP 404
- `https://birn.rs/sitemaps.xml` → sitemap (indeks, 4 unosa)
- `https://birn.rs/post-sitemap1.xml` → sitemap (urlset, 992 unosa)
- `https://birn.rs/post_tag-sitemap1.xml` → sitemap (urlset, 36 unosa)
- `https://birn.rs/page-sitemap1.xml` → sitemap (urlset, 29 unosa)
- `https://birn.rs/sitemap.xml` → sitemap (indeks, 4 unosa)
- `https://birn.rs/sitemap_index.xml` → sitemap (indeks, 4 unosa)
- `https://birn.rs/sitemap-news.xml` → HTTP 404
- `https://birn.rs/news-sitemap.xml` → HTTP 404

</details>

<details>
<summary>Juzne vesti — 8 provera</summary>

- `https://www.juznevesti.com/feed/` → feed (rss, 10 stavki)
- `https://www.juznevesti.com/comments/feed/` → feed (rss, 10 stavki)
- `https://www.juznevesti.com/rss.xml` → HTTP 404
- `https://www.juznevesti.com/atom.xml` → HTTP 404
- `https://www.juznevesti.com/index.xml` → HTTP 404
- `https://www.juznevesti.com/sitemap_index.xml` → sitemap (indeks, 157 unosa)
- `https://www.juznevesti.com/post-sitemap1.xml` → sitemap (urlset, 1001 unosa)
- `https://www.juznevesti.com/post-sitemap2.xml` → sitemap (urlset, 1000 unosa)

</details>

<details>
<summary>KRIK — 8 provera</summary>

- `https://www.krik.rs/feed/` → feed (rss, 10 stavki)
- `https://www.krik.rs/comments/feed/` → feed (rss, 10 stavki)
- `https://www.krik.rs/rss.xml` → HTTP 404
- `https://www.krik.rs/atom.xml` → HTTP 404
- `https://www.krik.rs/index.xml` → HTTP 404
- `https://www.krik.rs/sitemap_index.xml` → sitemap (indeks, 17 unosa)
- `https://www.krik.rs/post-sitemap.xml` → sitemap (urlset, 1000 unosa)
- `https://www.krik.rs/post-sitemap2.xml` → sitemap (urlset, 1000 unosa)

</details>

<details>
<summary>Cenzolovka — 8 provera</summary>

- `https://www.cenzolovka.rs/feed/` → feed (rss, 20 stavki)
- `https://www.cenzolovka.rs/comments/feed/` → feed (rss, 20 stavki)
- `https://www.cenzolovka.rs/rss.xml` → HTTP 404
- `https://www.cenzolovka.rs/atom.xml` → HTTP 404
- `https://www.cenzolovka.rs/index.xml` → HTTP 404
- `https://www.cenzolovka.rs/sitemap_index.xml` → sitemap (indeks, 46 unosa)
- `https://www.cenzolovka.rs/post-sitemap.xml` → sitemap (urlset, 1001 unosa)
- `https://www.cenzolovka.rs/post-sitemap2.xml` → sitemap (urlset, 1000 unosa)

</details>

<details>
<summary>Blic — 13 provera</summary>

- `https://www.blic.rs/feed` → HTTP 404
- `https://www.blic.rs/rss` → HTTP 200 ali sadrzaj nije feed (verovatno obicna HTML strana)
- `https://www.blic.rs/rss.xml` → HTTP 404
- `https://www.blic.rs/feed/rss2` → HTTP 404
- `https://www.blic.rs/atom.xml` → HTTP 404
- `https://www.blic.rs/index.xml` → HTTP 404
- `https://www.blic.rs/?feed=rss2` → HTTP 200 ali sadrzaj nije feed (verovatno obicna HTML strana)
- `https://www.blic.rs/sitemap-stories-latest-index.xml.gz` → sitemap (indeks, 1 unosa)
- `https://www.blic.rs/sitemap-stories-latest-latest.xml.gz` → sitemap (urlset, 131 unosa)
- `https://www.blic.rs/sitemap-stories-by-month-index.xml.gz` → sitemap (indeks, 319 unosa)
- `https://www.blic.rs/sitemap-stories-by-month-2026-9.xml.gz` → sitemap (urlset, 1257 unosa)
- `https://www.blic.rs/sitemap-stories-by-month-2026-8.xml.gz` → sitemap (urlset, 9016 unosa)
- `https://www.blic.rs/sitemap-stories-news-news.xml.gz` → sitemap (urlset, news, 516 unosa)

</details>

<details>
<summary>Telegraf — 10 provera</summary>

- `https://www.telegraf.rs/feed` → HTTP 404
- `https://www.telegraf.rs/rss` → feed (rss, 20 stavki)
- `https://www.telegraf.rs/rss.xml` → HTTP 404
- `https://www.telegraf.rs/feed/rss2` → HTTP 404
- `https://www.telegraf.rs/atom.xml` → HTTP 404
- `https://www.telegraf.rs/index.xml` → HTTP 404
- `https://www.telegraf.rs/?feed=rss2` → HTTP 200 ali sadrzaj nije feed (verovatno obicna HTML strana)
- `https://www.telegraf.rs/xml/sitemap/latest` → sitemap (urlset, 152 unosa)
- `https://www.telegraf.rs/xml/sitemap` → sitemap (indeks, 88 unosa)
- `https://www.telegraf.rs/xml/news` → sitemap (urlset, news, 659 unosa)

</details>

<details>
<summary>Mondo — 30 provera</summary>

- `https://mondo.rs/rss/629/Naslovna` → feed (rss, 100 stavki)
- `https://mondo.rs/rss/644/Sport` → feed (rss, 100 stavki)
- `https://mondo.rs/rss/646/Sport/Fudbal` → feed (rss, 100 stavki)
- `https://mondo.rs/rss/652/Sport/Kosarka` → feed (rss, 100 stavki)
- `https://mondo.rs/rss/657/Sport/Tenis` → feed (rss, 100 stavki)
- `https://mondo.rs/rss/660/Sport/Ostali-sportovi` → feed (rss, 100 stavki)
- `https://mondo.rs/rss/631/Info` → feed (rss, 100 stavki)
- `https://mondo.rs/rss/640/Info/Drustvo` → feed (rss, 100 stavki)
- `https://mondo.rs/rss/11427/Info/Politika` → feed (rss, 100 stavki)
- `https://mondo.rs/rss/641/Info/Crna-hronika` → feed (rss, 100 stavki)
- `https://mondo.rs/rss/642/Info/Ekonomija` → feed (rss, 100 stavki)
- `https://mondo.rs/rss/637/Info/Srbija` → feed (rss, 100 stavki)
- `https://mondo.rs/rss/639/Info/Beograd` → feed (rss, 100 stavki)
- `https://mondo.rs/rss/638/Info/Svet` → feed (rss, 100 stavki)
- `https://mondo.rs/rss/643/Info/EX-YU` → feed (rss, 100 stavki)
- `https://mondo.rs/rss/11312/Info/Novi-Sad-na-Mondu` → feed (rss, 100 stavki)
- `https://mondo.rs/rss/663/Zabava` → feed (rss, 100 stavki)
- `https://mondo.rs/rss/665/Zabava/Zvezde-i-tracevi` → feed (rss, 100 stavki)
- `https://mondo.rs/rss/671/Zabava/TV` → feed (rss, 100 stavki)
- `https://mondo.rs/rss/673/Zabava/Film` → feed (rss, 100 stavki)
- `https://mondo.rs/rss/674/Zabava/Muzika` → feed (rss, 100 stavki)
- `https://mondo.rs/rss/675/Zabava/Zanimljivosti` → feed (rss, 100 stavki)
- `https://mondo.rs/rss/676/Zabava/Kultura` → feed (rss, 100 stavki)
- `https://mondo.rs/rss/678/Magazin` → feed (rss, 100 stavki)
- `https://mondo.rs/rss/680/Magazin/Ljubav` → feed (rss, 100 stavki)
- `https://mondo.rs/rss/681/Magazin/Stil` → feed (rss, 100 stavki)
- `https://mondo.rs/rss/685/Magazin/Zdravlje` → feed (rss, 100 stavki)
- `https://mondo.rs/rss/822/Horoskop` → feed (rss, 100 stavki)
- `https://mondo.rs/sitemaps/index.xml` → sitemap (indeks, 29 unosa)
- `https://mondo.rs/sitemaps/news-sitemap.xml` → sitemap (urlset, news, 318 unosa)

</details>

<details>
<summary>B92 — 5 provera</summary>

- `https://www.b92.net/feed` → feed (rss, 20 stavki)
- `https://www.b92.net/rss` → HTTP 200 ali sadrzaj nije feed (verovatno obicna HTML strana)
- `https://www.b92.net/rss.xml` → feed (rss, 20 stavki)
- `https://www.b92.net/feed/rss2` → HTTP 404
- `https://www.b92.net/?feed=rss2` → HTTP 200 ali sadrzaj nije feed (verovatno obicna HTML strana)

</details>

<details>
<summary>RTS — 12 provera</summary>

- `https://rss.html/` → greska — Mrezna greska: fetch failed (getaddrinfo ENOTFOUND rss.html)
- `https://www.rts.rs/feed` → HTTP 404
- `https://www.rts.rs/rss` → HTTP 404
- `https://www.rts.rs/rss.xml` → HTTP 404
- `https://www.rts.rs/feed/rss2` → HTTP 404
- `https://www.rts.rs/atom.xml` → HTTP 404
- `https://www.rts.rs/index.xml` → HTTP 404
- `https://www.rts.rs/?feed=rss2` → HTTP 200 ali sadrzaj nije feed (verovatno obicna HTML strana)
- `https://www.rts.rs/sitemap.xml` → HTTP 404
- `https://www.rts.rs/sitemap_index.xml` → HTTP 404
- `https://www.rts.rs/sitemap-news.xml` → HTTP 404
- `https://www.rts.rs/news-sitemap.xml` → HTTP 404

</details>

<details>
<summary>Euronews Srbija — 11 provera</summary>

- `https://www.euronews.rs/feed` → HTTP 404
- `https://www.euronews.rs/rss` → HTTP 200 ali sadrzaj nije feed (verovatno obicna HTML strana)
- `https://www.euronews.rs/rss.xml` → HTTP 404
- `https://www.euronews.rs/feed/rss2` → HTTP 404
- `https://www.euronews.rs/atom.xml` → HTTP 404
- `https://www.euronews.rs/index.xml` → HTTP 404
- `https://www.euronews.rs/?feed=rss2` → HTTP 200 ali sadrzaj nije feed (verovatno obicna HTML strana)
- `https://www.euronews.rs/sitemap.xml` → HTTP 404
- `https://www.euronews.rs/sitemap_index.xml` → HTTP 404
- `https://www.euronews.rs/sitemap-news.xml` → HTTP 404
- `https://www.euronews.rs/news-sitemap.xml` → HTTP 404

</details>

<details>
<summary>Tanjug — 8 provera</summary>

- `https://www.tanjug.rs/feed` → HTTP 404
- `https://www.tanjug.rs/rss` → HTTP 200 ali sadrzaj nije feed (verovatno obicna HTML strana)
- `https://www.tanjug.rs/rss.xml` → HTTP 404
- `https://www.tanjug.rs/feed/rss2` → HTTP 404
- `https://www.tanjug.rs/atom.xml` → HTTP 404
- `https://www.tanjug.rs/index.xml` → HTTP 404
- `https://www.tanjug.rs/?feed=rss2` → HTTP 200 ali sadrzaj nije feed (verovatno obicna HTML strana)
- `https://www.tanjug.rs/sitemap/news.xml` → sitemap (urlset, news, 385 unosa)

</details>

<details>
<summary>Beta — 7 provera</summary>

- `https://beta.rs/feed` → HTTP 404
- `https://beta.rs/rss` → feed (rss, 10 stavki)
- `https://beta.rs/rss.xml` → HTTP 404
- `https://beta.rs/feed/rss2` → HTTP 404
- `https://beta.rs/atom.xml` → HTTP 404
- `https://beta.rs/index.xml` → HTTP 404
- `https://beta.rs/?feed=rss2` → HTTP 200 ali sadrzaj nije feed (verovatno obicna HTML strana)

</details>

