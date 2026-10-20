# Deckplan

Przeglądarkowy edytor planów stacji kosmicznych składanych z gotowych modułów na kwadratowej siatce. Powstał jako pomoc dla Mistrza Gry w sesjach RPG science fiction.

_English summary below._

## Uruchomienie

Cała aplikacja mieści się w pliku `index.html`. Nie wymaga instalacji, budowania ani serwera: wystarczy otworzyć plik w przeglądarce.

## Co potrafi

- **Siatka:** jeden kafel korytarza zajmuje jedno pole. Pomieszczenia zajmują od 1 do 8 pól (np. reaktor 2×4, laboratorium w kształcie litery L).
- **Korytarze:** prosty, zakręt 90°, rozgałęzienie T, skrzyżowanie, skos 45°, przejścia prosto–skos, zakręt skośny i zaślepka.
- **Wstawianie:** moduł można przeciągnąć z katalogu albo kliknąć go i wskazać miejsce na siatce. Podgląd na czerwono oznacza kolizję.
- **Obrót o 90°:** klawisz `R`, także w trakcie przeciągania.
- **Grodzie:** stoją na połączeniach, czyli tam, gdzie korytarz styka się z pomieszczeniem albo z innym korytarzem. Typy: otwarte przejście, drzwi, grodź ciśnieniowa, śluza, zaspawane.
- **Kontrola planu:** licznik otwartych końców korytarzy i odłączonych fragmentów stacji.
- **Zapis:** plan zapisuje się automatycznie w przeglądarce (localStorage). Można go też wyeksportować i wczytać jako JSON. Cofanie zmian: `Ctrl+Z` / `Cmd+Z`.

## Skróty klawiszowe

| Klawisz                | Działanie                                            |
| ---------------------- | ---------------------------------------------------- |
| `R`                    | obróć zaznaczony lub przeciągany moduł o 90°         |
| `Delete` / `Backspace` | usuń zaznaczony moduł                                |
| `1`–`5`                | wybierz typ grodzi albo zmień typ zaznaczonej grodzi |
| `Esc`                  | anuluj wstawianie i zaznaczenie                      |
| `Ctrl+Z` / `Cmd+Z`     | cofnij                                               |

## Format planu (JSON)

```json
{
  "name": "Placówka Kestrel-4",
  "pieces": [
    { "id": 1, "t": "K1", "x": 4, "y": 8, "r": 1 },
    { "id": 17, "t": "T1", "x": 6, "y": 9, "r": 0 }
  ],
  "doors": { "7,8,S": "grodz", "16,5,S": "sluza" }
}
```

- `t` to kod modułu z katalogu (`K1`–`K9` korytarze, `M*` mieszkalne, `O*` operacyjne, `T*` techniczne).
- `x`, `y` to pozycja lewego górnego narożnika modułu na siatce. `r` to obrót: 0–3, kolejne wielokrotności 90° zgodnie z ruchem wskazówek zegara.
- Klucz w `doors` to krawędź siatki w postaci `x,y,E` (prawa krawędź pola) albo `x,y,S` (dolna krawędź pola). Wartości: `brak`, `drzwi`, `grodz`, `sluza`, `spaw`. Połączenia, których nie ma w `doors`, dostają typ domyślny: drzwi przy pomieszczeniu i otwarte przejście między korytarzami.

Przykładowy plan znajduje się w [`examples/kestrel-4.json`](examples/kestrel-4.json). Aby go wczytać, wybierz „Zapis / odczyt JSON”, wklej zawartość pliku i kliknij „Wczytaj”.

---

## English summary

Deckplan is a single-file browser editor for drawing space station layouts from modular sections on a square grid. It was built as a game master aid for sci-fi tabletop RPGs. Open `index.html` in a browser, then drag modules from the catalogue, rotate them with `R`, and place bulkheads on connections between modules. Plans are auto-saved to localStorage and can be exported or imported as JSON (format described above). The UI is in Polish.

## Licencja / License

[Apache License 2.0](LICENSE)
