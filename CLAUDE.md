# Krąg obfitości – zasady pracy w repozytorium

## Historia zmian (CHANGELOG.md)

- Przy **każdej** wydanej zmianie dopisz w `CHANGELOG.md` nową wersję na końcu pliku:
  `## X.Y.Z – DD.MM.RRRR (`skrót commitu`)` i krótką listę zmian po polsku, zrozumiałą dla gracza.
- Numer wersji: główna (X) – nowy sposób grania, pośrednia (Y) – nowe funkcje, tryby, kategorie,
  poprawkowa (Z) – poprawki i drobne zmiany.
- Ten sam numer wpisz w `GAME_VERSION` w `js/game.js` (pokazywany w menu).
- Pisz tylko to, co faktycznie zmieniono.

## Pamięć podręczna

- Przy zmianie listy plików gry albo ich zawartości podnieś `CACHE` w `sw.js` (np. `krag-v2`).

## Karty

- Karty w `js/data.js` piszemy samodzielnie (nie kopiujemy kart z innych gier).
- Przykłady do trybu jednoosobowego wybieramy tak, żeby ich miejsce na skali było oczywiste; nie wpisujemy
  niesprawdzonych faktów (tytuły, wykonawcy, nazwy muszą być prawdziwe).
