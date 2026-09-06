# Fontovi

`Inter-Regular.ttf` i `Inter-Bold.ttf` se koriste za naslovne slike članaka (Faza 8).

Font je u repo-u namerno, a ne skida se pri pokretanju: naslovne slike se crtaju u GitHub Actions
runneru koji nema instalirane fontove, a srpska latinica traži č, ć, ž, š i đ. Font koji ta slova
nema ih tiho preskoči, pa naslov izađe sa rupama.

Licenca je SIL Open Font License 1.1 (`LICENSE-Inter.txt`), koja dozvoljava korišćenje, izmenu i
dalju distribuciju, uključujući komercijalnu, uz uslov da se licenca distribuira uz font — zato
stoji ovde. Fajlovi su preuzeti sa Google Fonts CDN-a (`fonts.gstatic.com`), verzija v20.
