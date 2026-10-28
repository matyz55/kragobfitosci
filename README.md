# Krąg obfitości 🔮

Przeglądarkowa gra towarzyska w zgadywanie myśli na skali.
Statyczna strona (HTML + CSS + JavaScript, bez serwera), działa na telefonie, tablecie i komputerze.

**Zagraj:** https://matyz55.github.io/kragobfitosci/ (po włączeniu GitHub Pages dla gałęzi)

## Jak to działa

Każda karta to skala między dwoma przeciwieństwami, np. *Zimne ↔ Gorące*. Na skali ukryty jest cel, który widzi
tylko **psychik**. Psychik podaje hasło, a pozostali ustawiają wskazówkę na tarczy tam, gdzie ich zdaniem leży cel.
Cel ma pięć pól: 2 · 3 · 4 · 3 · 2 pkt.

## Tryby gry

- **Jeden gracz** – trening: gra pokazuje kartę i gotowe hasło, ustawiasz wskazówkę. 10 rund, do 40 pkt, rekord
  zapamiętywany w przeglądarce. Miejsca haseł na skali to szacunki autorów (pole przykładów w `js/data.js`).
- **Dwie drużyny** – klasyczne zasady: psychik wybiera jedną z dwóch kart, podaje hasło (wpisuje albo mówi na głos),
  jego drużyna ustawia wskazówkę, druga drużyna zgaduje „lewo czy prawo” (1 pkt, nie przy trafieniu w środek).
  Druga drużyna zaczyna z 1 pkt, drużyna z 4 pkt, która nadal przegrywa, gra dodatkową turę, przy remisie na progu –
  dogrywka. Gra do 5/7/10/15 pkt.
- **Współpraca** – 2+ graczy razem, 5/7/10 kart, środek celu daje 3 pkt i dodatkową kartę, bez „lewo/prawo”.
  16 pkt i więcej to wygrana.

Gra jest „na jednym urządzeniu”: przed każdą turą ekran prosi o przekazanie urządzenia psychikowi.

## Kategorie

22 kategorie, 439 kart (297 haseł dla jednego gracza): Ogólne, Muzyka, Film i seriale, Jedzenie i picie, Sport,
Nauka i technika, Polskie klimaty, Internet i gry, Zwierzęta i natura, Ludzie i charaktery, Szkoła i praca, Podróże,
Moda i wygląd, Historia, Miłość i przyjaźń, Dom i codzienność, Książki i język, Imprezowe, Dzieciństwo i bajki,
Motoryzacja, Pory roku i święta, Zdrowie i ciało. Kategorie wybiera się po wyborze trybu (i ustawień graczy) –
tuż przed startem gry; wybór jest zapamiętywany. Karty i przykłady: `js/data.js`.

## Wygląd

Ciemny motyw z animowaną „zorzą” w tle, tarcza z gradientami (obręcz od niebieskiego do czerwonego jak końce skali,
wachlarz celu rozkładający się przy odsłonięciu, wskazówka obracająca się płynnie), konfetti przy trafieniu w środek
i przy wygranej. Czcionki Fredoka (nagłówki, przyciski) i Nunito (tekst) są dołączone w `fonts/` (licencja SIL Open
Font License 1.1 – pliki `fonts/OFL-*.txt`), więc działają także bez sieci. Przy ustawieniu systemu „ogranicz ruch”
animacje i konfetti są wyłączone.

## Dźwięk

Efekty dźwiękowe są tworzone w przeglądarce (Web Audio API, `js/sound.js`) – bez plików audio: stuknięcia przycisków,
tykanie tarczy przy przesuwaniu wskazówki, odsłonięcie i zasłonięcie celu, fanfara zależna od punktów, sygnał
za trafione „lewo/prawo” i melodia na koniec gry. Przycisk 🔊/🔇 w górnym pasku wyłącza dźwięk (zapamiętywane).

## Duży ekran (📺)

Strona `tv.html` dla telewizora, rzutnika albo drugiego monitora – duża tarcza, końce skali, hasło, wyniki, konfetti
i dźwięki. Telefon (albo komputer), na którym toczy się gra, jest pilotem: przycisk 📺 w górnym pasku.

- **To samo urządzenie** (np. laptop podłączony do telewizora): „Otwórz w nowym oknie” – połączenie przez
  BroadcastChannel, bez internetu.
- **Telewizor lub inny komputer**: otwórz na nim `tv.html` – pokaże 4-znakowy kod i kod QR. Telefon skanuje QR
  (otwiera grę z `?tv=KOD` i łączy się sam) albo w oknie 📺 wpisuje kod. Połączenie jak w Songsterze (`js/net.js`):
  naraz bezpośrednio (WebRTC przez PeerJS) i przez publiczny serwer MQTT (shiftr.io) – wygrywa szybszy; opcjonalnie
  własny serwer pośredniczący (Cloudflare Workers) – adres w `window.KRAG_RELAY`. Telefon pamięta kod i po
  odświeżeniu łączy się ponownie.
- **Cel jest tajny**: duży ekran dostaje położenie celu dopiero przy odsłonięciu (sprawdza to test `tests/tv.spec.mjs`).
  Gdy psychik patrzy na cel, telewizor pokazuje tylko kartę i napis „… patrzy na cel”.
- Dźwięk na dużym ekranie włącza się jednym kliknięciem (przeglądarki nie pozwalają na dźwięk bez kliknięcia),
  ⛶ – pełny ekran. Starszy duży ekran sam się odświeża, gdy telefon ma nowszą wersję gry.
- Przez sieć przesyłany jest tylko stan gry (bez kodu HTML) – kanały publicznego MQTT są jawne.

## Ekran i instalacja

- Każdy ekran mieści się w oknie bez przewijania – na telefonach (pionowo i poziomo), tabletach i komputerach.
  Tarcza dopasowuje się do wolnego miejsca, a przy telefonie trzymanym poziomo stoi obok przycisków.
  Sprawdza to test `tests/layout.spec.mjs` na 19 rozmiarach ekranu.
- Przycisk **Zainstaluj** w menu: w Chrome, Edge i innych przeglądarkach opartych na Chromium otwiera okno instalacji
  (gdy przeglądarka je udostępni), w pozostałych pokazuje instrukcję (iPhone/iPad – menu „Udostępnij”, Safari na
  Macu – menu „Plik”, Firefox na komputerze nie instaluje aplikacji ze stron). Po instalacji przycisk znika.

## Pliki

- `index.html`, `style.css` – strona i wygląd
- `js/data.js` – kategorie i karty
- `js/game.js` – zasady (punktacja, tury, dogrywka, współpraca, tryb jednoosobowy)
- `js/dial.js` – tarcza SVG (przeciąganie palcem/myszą i suwak)
- `js/sound.js` – efekty dźwiękowe
- `tv.html`, `tv.css`, `js/tv.js` – duży ekran; `js/remote.js` – pilot (wysyłanie stanu); `js/net.js` – połączenia sieciowe
- `js/app.js` – ekrany i przebieg gry
- `sw.js`, `manifest.webmanifest`, `icons/` – instalacja jako aplikacja i działanie bez sieci
- `fonts/` – czcionki Fredoka i Nunito (SIL OFL 1.1)

## Uruchomienie lokalne i testy

```bash
npm install
npm run serve      # http://localhost:8765
npm run lint
npm test           # testy Playwright
```

## Źródła

- Zasady, karty (skale), grafika i opisy wyników – opracowanie własne.
- Czcionki: Google Fonts – Fredoka (https://fonts.google.com/specimen/Fredoka) i Nunito
  (https://fonts.google.com/specimen/Nunito), licencja SIL OFL 1.1 (tekst licencji w `fonts/`).
- Wymagania instalacji (ikony 192 i 512 px, HTTPS, manifest): https://web.dev/articles/install-criteria oraz
  https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
