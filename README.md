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

18 kategorii, 292 karty: Ogólne, Muzyka, Film i seriale, Jedzenie i picie, Sport, Nauka i technika, Polskie klimaty,
Internet i gry, Zwierzęta i natura, Ludzie i charaktery, Szkoła i praca, Podróże, Moda i wygląd, Historia,
Miłość i przyjaźń, Dom i codzienność, Książki i język, Imprezowe. Wybór na ekranie „Kategorie” (zapamiętywany).
Karty i przykłady: `js/data.js`.

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
- `js/app.js` – ekrany i przebieg gry
- `sw.js`, `manifest.webmanifest`, `icons/` – instalacja jako aplikacja i działanie bez sieci

## Uruchomienie lokalne i testy

```bash
npm install
npm run serve      # http://localhost:8765
npm run lint
npm test           # testy Playwright
```

## Źródła

- Zasady, karty (skale), grafika i opisy wyników – opracowanie własne.
- Wymagania instalacji (ikony 192 i 512 px, HTTPS, manifest): https://web.dev/articles/install-criteria oraz
  https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
