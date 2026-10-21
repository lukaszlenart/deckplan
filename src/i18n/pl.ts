import type { Messages } from './en'

export const pl: Messages = {
  'app.title': 'Deckplan',
  'lang.label': 'Język',

  'header.stationName': 'Nazwa stacji',
  'header.undo': 'Cofnij',
  'header.undoTitle': 'Cofnij (Ctrl+Z)',
  'header.json': 'Zapis / odczyt JSON',
  'header.print': 'Drukuj',
  'header.clear': 'Wyczyść plan',

  'storage.writeError':
    'Nie udało się zapisać w pamięci przeglądarki. Skopiuj JSON, zanim zamkniesz tę kartę.',

  'palette.bulkheads': 'Grodzie',
  'palette.bulkheadHint':
    'Grodź stoi na połączeniu, czyli tam, gdzie korytarz styka się z pomieszczeniem albo z innym korytarzem. Wybierz typ i klikaj połączenia oznaczone kółkami albo przeciągnij typ na połączenie. Klawisze 1–5 wybierają typ.',
  'palette.selection': 'Zaznaczenie',

  'bulkhead.open': 'Otwarte przejście',
  'bulkhead.door': 'Drzwi',
  'bulkhead.bulkhead': 'Grodź ciśnieniowa',
  'bulkhead.airlock': 'Śluza powietrzna',
  'bulkhead.welded': 'Zaspawane',
  'bulkhead.title': '{name} (kliknij, aby zmienić)',

  'board.size': '{w}×{h}',
  'board.resizeGrip': 'Zmień rozmiar',

  'inspector.connectionRoom': 'połączenie pomieszczenie – korytarz',
  'inspector.connectionCorridor': 'połączenie korytarz – korytarz',
  'inspector.doorUnconnected': 'drzwi pomieszczenia – bez połączenia',
  'inspector.deleteDoor': 'Usuń drzwi',
  'inspector.placingBulkhead': 'Wstawianie: {name}',
  'inspector.placingBulkheadHint':
    'Kliknij czerwoną kropkę na ścianie pomieszczenia, aby wstawić drzwi, albo kółko między korytarzami. Możesz klikać kolejne. Esc kończy.',
  'inspector.finish': 'Zakończ',
  'inspector.cancel': 'Anuluj',
  'inspector.rotate': 'Obróć 90°',
  'inspector.delete': 'Usuń',
  'inspector.rotation': 'obrót {deg}°',
  'inspector.placeHint': 'Kliknij na siatce, aby postawić. R obraca, Esc anuluje.',
  'inspector.defaultHint':
    'Przeciągnij moduł z katalogu na siatkę albo kliknij go i wskaż miejsce. Kliknij element na planie, aby go zaznaczyć. Podczas przeciągania R obraca. Kliknij grodź na planie, aby zmienić jej typ.',

  'unit.cell.one': '{count} pole',
  'unit.cell.few': '{count} pola',
  'unit.cell.many': '{count} pól',
  'unit.cell.other': '{count} pola',

  'status.rooms': 'Pomieszczenia',
  'status.corridors': 'Korytarze',
  'status.cells': 'Pola',
  'status.openEnds': 'Otwarte końce',
  'status.fragments': 'Odłączone fragmenty',
  'status.zoomOut': 'Oddal',
  'status.zoomIn': 'Przybliż',

  'toast.noFit': 'Tu się nie zmieści: pole zajęte albo poza planem.',
  'toast.noFitShort': 'Tu się nie zmieści.',
  'toast.noRotate': 'Brak miejsca na obrót. Przesuń moduł i spróbuj ponownie.',
  'toast.dropOnConnection': 'Upuść grodź na połączeniu oznaczonym kółkiem.',
  'toast.noConnection': 'Tu nie ma połączenia. Kliknij kółko między dwoma modułami.',
  'toast.cleared': 'Plan wyczyszczony. „Cofnij” przywraca.',
  'toast.copied': 'Skopiowano JSON.',
  'toast.selectedText': 'Zaznaczono tekst. Skopiuj go skrótem klawiszowym.',
  'toast.loaded': 'Plan wczytany.',
  'toast.invalidJson': 'Nie rozpoznano planu. Sprawdź, czy wklejony tekst to cały JSON.',

  'dialog.title': 'Plan stacji w formacie JSON',
  'dialog.hint':
    'Skopiuj tekst, aby zachować plan. Aby wczytać inny plan, wklej jego JSON i wybierz „Wczytaj”.',
  'dialog.copy': 'Kopiuj',
  'dialog.load': 'Wczytaj',
  'dialog.close': 'Zamknij',

  'sample.name': 'Placówka Kestrel-4',
}
