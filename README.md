# Krąg obfitości 🔮

Przeglądarkowa gra towarzyska w zgadywanie myśli na skali.
Statyczna strona (HTML + CSS + JavaScript, bez serwera), działa na telefonie, tablecie i komputerze.

**Zagraj:** https://matyz55.github.io/kragobfitosci/ (po włączeniu GitHub Pages dla gałęzi)

## Jak to działa

Każda karta to skala między dwoma przeciwieństwami, np. *Zimne ↔ Gorące*. Na skali ukryty jest cel, który widzi
tylko **wyrocznia**. Wyrocznia podaje hasło, a pozostali ustawiają wskazówkę na tarczy tam, gdzie ich zdaniem leży cel.
Cel ma pięć pól: 2 · 3 · 4 · 3 · 2 pkt.

## Tryby gry

- **Jeden gracz** – trening: gra pokazuje kartę i gotowe hasło, ustawiasz wskazówkę. 10 rund, do 40 pkt, rekord
  zapamiętywany w przeglądarce. Miejsca haseł na skali to szacunki autorów (pole przykładów w `js/data.js`).
- **Dwie drużyny** – klasyczne zasady: wyrocznia wybiera jedną z dwóch kart, podaje hasło (wpisuje albo mówi na głos),
  jego drużyna ustawia wskazówkę, druga drużyna zgaduje „lewo czy prawo” (1 pkt, nie przy trafieniu w środek).
  Druga drużyna zaczyna z 1 pkt, drużyna z 4 pkt, która nadal przegrywa, gra dodatkową turę, przy remisie na progu –
  dogrywka. Gra do 5/7/10/15 pkt.
- **Współpraca** – 2+ graczy razem, 5/7/10 kart, środek celu daje 3 pkt i dodatkową kartę, bez „lewo/prawo”.
  16 pkt i więcej to wygrana.

Gra jest „na jednym urządzeniu”: przed każdą turą ekran prosi o przekazanie urządzenia wyroczni.

## Kategorie

22 kategorie, 909 kart (904 hasła dla jednego gracza; w każdej kategorii co najmniej 40 kart i 20 haseł, więc każdą da się grać osobno): Ogólne, Muzyka, Film i seriale, Jedzenie i picie, Sport,
Nauka i technika, Polskie klimaty, Internet i gry, Zwierzęta i natura, Ludzie i charaktery, Szkoła i praca, Podróże,
Moda i wygląd, Historia, Miłość i przyjaźń, Dom i codzienność, Książki i język, Imprezowe, Dzieciństwo i bajki,
Motoryzacja, Pory roku i święta, Zdrowie i ciało. Kategorie wybiera się po wyborze trybu (i ustawień graczy) –
tuż przed startem gry; wybór jest zapamiętywany. Karty i przykłady: `js/data.js`.

## Własne talie

Menu → **Moje talie** (albo przycisk „Moje talie” pod listą kategorii): własne karty, np. o znajomych, o rodzinie,
o klasie albo o firmie.

- **Edytor**: nazwa i ikona talii, karty jako dwa końce skali i (nieobowiązkowo) przykładowe hasło – jego miejsce
  ustawia się wskazówką na tarczy. Hasła są potrzebne w grze jednoosobowej i w podpowiedziach dla wyroczni.
  Do 8 talii, do 60 kart w talii; karty pokazują się stronami, bez przewijania.
- **Zapis tylko w tym telefonie** (pamięć przeglądarki). Talia, która dostała pierwszą kartę albo przyszła w linku,
  od razu jest wybrana do gry (sama – inne kategorie można dobrać przy wyborze kategorii). Własne talie stoją na
  początku listy kategorii (przerywana ramka). Wyzwanie dnia zawsze korzysta tylko z kart wbudowanych.
- **Udostępnianie**: przycisk „Udostępnij” pokazuje kod QR i link (kopiowanie albo „Wyślij” na telefonie).
  Cała talia jest zapisana w adresie po znaku `#` (skompresowana; w starszych przeglądarkach bez kompresji) –
  tej części adresu przeglądarka nie wysyła na serwer, więc nie trzeba konta ani serwera.
- **Dodawanie**: po otwarciu linku albo zeskanowaniu kodu gra proponuje dodanie talii (z podglądem kart).
  Gdy gra jest zainstalowana jako aplikacja, a link otworzył się w przeglądarce: „Moje talie → Wklej link”.
  Talia z linku jest sprawdzana i przycinana do limitów (długość tekstów, liczba kart), a jej teksty nigdy nie
  trafiają na stronę jako kod.

## Wyzwanie dnia, statystyki, drużyny

- **Wyzwanie dnia** (menu): 10 haseł losowanych na podstawie samej daty – ten sam zestaw u wszystkich graczy danego
  dnia, zawsze zwykła szerokość pól. Liczy się pierwsze podejście dnia (kolejne to trening), wynik można udostępnić
  (np. „🟥🟧🟨⬛…” – kolor kwadratu to punkty w rundzie). Na kafelku w menu: dzisiejszy wynik i seria kolejnych dni.
- **Statystyki** (menu, tylko w tej przeglądarce): liczba gier i rund, średnia punktów, odsetek trafień w sam środek
  i pudeł, seria wyzwań, najlepsza wyrocznia (średnia punktów, liczona od 3 rund), ulubione kategorie i rekordy.
  Można je wyczyścić (z potwierdzeniem).
- **Drużyny**: awatar (zwierzątko) i kolor każdej drużyny – stuknięcie zmienia na następny; nazwy, gracze, awatary,
  kolory i próg wygranej są zapamiętywane na następną grę. Kolory i awatary widać w tablicy wyników, na ekranie
  przekazania, w podsumowaniu i na dużym ekranie.

## Ustawienia i wznawianie

- **Ustawienia** (menu → Ustawienia, zapamiętywane w przeglądarce):
  - motyw: ciemny, jasny albo wysokiego kontrastu; zwykła lub duża wielkość tekstu,
  - poziom trudności – szerokość pól celu: łatwy (szersze, np. dla dzieci), zwykły, trudny (węższe),
  - minutnik narady (wył., 30 s, 60 s, 90 s, 2 min) – odliczanie przy ustawianiu wskazówki w drużynach
    i współpracy, w ostatnich 10 s cykanie, na koniec sygnał i wibracja (widać go też na dużym ekranie),
  - podpowiedzi dla wyroczni – przycisk „Podpowiedź” pokazuje przykładowe hasło z puli gry jednoosobowej najbliższe
    celowi na wybranej karcie (i czy cel leży dalej w lewo czy w prawo),
  - instalacja gry jako aplikacji.
- **Wznawianie gry**: stan gry zapisuje się w przeglądarce po każdym etapie tury (i przy zamykaniu karty).
  Po odświeżeniu, zamknięciu aplikacji albo powrocie do menu w menu pojawia się „Przerwana gra → Wznów”.
  Przerwanie u wyroczni wraca do ekranu przekazania (cel nie pokaże się nikomu przypadkiem), a po odsłonięciu
  celu punkty nie liczą się drugi raz. Zapis znika po zakończeniu gry albo po „✕”.

## Wygląd

Ciemny motyw z animowaną „zorzą” w tle i tarcza z gradientami: obręcz od niebieskiego do czerwonego jak końce skali,
przerywany pierścień i napis „Krąg obfitości” na tarczy, wachlarz celu rozkładający się przy odsłonięciu. Po odpowiedzi
świeci pole, w które trafiła wskazówka (pozostałe są przygaszone), a liczby pól leżą nad wskazówką.

- **Ekran tury**: nad tarczą duża karta z hasłem (i imieniem wyroczni), u wyroczni dwie karty do wyboru jako
  mini-skale i pole „Twoje hasło”, po odsłonięciu karta wyniku z odznaką punktów. Gdy brakuje wysokości, zmniejsza się
  tarcza, nie hasło.
- **Tablica wyników**: paski postępu drużyn do progu wygranej, kropki rund (kolor = zdobyte punkty).
- **Koniec gry**: puchar, kryształowa kula albo tarcza strzelnicza (własne ilustracje SVG), paski drużyn albo kropki
  rund, licznik do wygranej we współpracy i statystyki (średnia, trafienia w sam środek).
- **Ikony** w górnym pasku, menu i na dużym ekranie to własne ikony SVG (`js/ui.js`) – wyglądają tak samo na każdym
  urządzeniu.
- **Suwak pod tarczą** jest zablokowany i wyszarzony, gdy wskazówki nie wolno ruszać (u wyroczni, po zatwierdzeniu
  odpowiedzi, przy „lewo/prawo” i po odsłonięciu).

Czcionki Baloo 2 (nagłówki, przyciski) i Nunito (tekst) są dołączone w `fonts/` (licencja SIL Open
Font License 1.1 – pliki `fonts/OFL-*.txt`), więc działają także bez sieci. Przy ustawieniu systemu „ogranicz ruch”
animacje i konfetti są wyłączone.

## Wibracje

Na telefonach, które obsługują wibracje w przeglądarce (Android), wskazówka „klika” przy każdej kresce podziałki –
mocniej na dłuższych kreskach i na końcach skali. Wibracje są też przy odsłonięciu i zasłonięciu celu, wyniku
(inne dla 4, 3, 2 i 0 pkt), trafionym „lewo/prawo”, końcu gry i przyciskach. Przycisk 📳 w górnym pasku (obok 🔊) je wyłącza –
wyłączone pokazują 📴 (przycisk widoczny tylko na urządzeniach dotykowych). Safari na iPhonie nie obsługuje wibracji ze stron – tam ich nie ma.

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
  Gdy wyrocznia patrzy na cel, telewizor pokazuje tylko kartę i napis „… patrzy na cel”.
- Dźwięk na dużym ekranie włącza się jednym kliknięciem (przeglądarki nie pozwalają na dźwięk bez kliknięcia),
  ⛶ – pełny ekran. Starszy duży ekran sam się odświeża, gdy telefon ma nowszą wersję gry.
- Przez sieć przesyłany jest tylko stan gry (bez kodu HTML) – kanały publicznego MQTT są jawne.

## Ekran i instalacja

- Każdy ekran mieści się w oknie bez przewijania – na telefonach (pionowo i poziomo), tabletach i komputerach.
  Tarcza dopasowuje się do wolnego miejsca, a przy telefonie trzymanym poziomo stoi obok przycisków.
  Gdy nazwy kategorii się nie mieszczą (najmniejsze ekrany, dużo własnych talii), lista przechodzi na zwarty układ.
  Sprawdzają to testy `tests/layout.spec.mjs` i `tests/layout-decks.spec.mjs` na 19 rozmiarach ekranu.
- Przycisk **Zainstaluj** w menu: w Chrome, Edge i innych przeglądarkach opartych na Chromium otwiera okno instalacji
  (gdy przeglądarka je udostępni), w pozostałych pokazuje instrukcję (iPhone/iPad – menu „Udostępnij”, Safari na
  Macu – menu „Plik”, Firefox na komputerze nie instaluje aplikacji ze stron). Po instalacji przycisk znika.

## Pliki

- `index.html`, `style.css` – strona i wygląd
- `js/data.js` – kategorie i karty
- `js/game.js` – zasady (punktacja, tury, dogrywka, współpraca, tryb jednoosobowy)
- `js/dial.js` – tarcza SVG (przeciąganie palcem/myszą i suwak)
- `js/ui.js` – wspólne elementy wyglądu telefonu i dużego ekranu: ikony, ilustracje, karta hasła, karta wyniku, tablica wyników, podsumowanie
- `js/sound.js` – efekty dźwiękowe
- `tv.html`, `tv.css`, `js/tv.js` – duży ekran; `js/remote.js` – pilot (wysyłanie stanu); `js/net.js` – połączenia sieciowe
- `js/app.js` – ekrany i przebieg gry
- `sw.js`, `manifest.webmanifest`, `icons/` – instalacja jako aplikacja i działanie bez sieci
- `fonts/` – czcionki Baloo 2 i Nunito (SIL OFL 1.1); test `tests/polish.spec.mjs` sprawdza, że mają wszystkie polskie znaki
- `js/haptics.js` – wibracje
- `js/stats.js` – statystyki i wyniki wyzwania dnia (localStorage)
- `js/decks.js` – własne talie: zapis, sprawdzanie, kodowanie talii w linku; `js/editor.js` – ekrany talii, kod QR, dodawanie z linku

## Uruchomienie lokalne i testy

```bash
npm install
npm run serve      # http://localhost:8765
npm run lint
npm test           # testy Playwright
```

## Źródła

- Zasady, karty (skale), grafika i opisy wyników – opracowanie własne.
- Czcionki: Google Fonts – Baloo 2 (https://fonts.google.com/specimen/Baloo+2) i Nunito
  (https://fonts.google.com/specimen/Nunito), licencja SIL OFL 1.1 (tekst licencji w `fonts/`).
- Wymagania instalacji (ikony 192 i 512 px, HTTPS, manifest): https://web.dev/articles/install-criteria oraz
  https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- Część adresu po `#` nie jest wysyłana na serwer: https://developer.mozilla.org/en-US/docs/Learn_web_development/Howto/Web_mechanics/What_is_a_URL
  i https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment
- Kompresja talii w linku (CompressionStream, format `deflate-raw`: Chrome/Edge 103+, Firefox 113+, Safari 16.4+ według
  danych zgodności MDN): https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream/CompressionStream
- Kody QR: biblioteka qrcode-generator (Kazuhiko Arase, licencja MIT) z cdnjs – https://cdnjs.com/libraries/qrcode-generator
