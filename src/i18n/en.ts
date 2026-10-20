/** Base dictionary. Its keys define `Messages`; every other language must provide all of them. */
export const en = {
  'app.title': 'Deckplan',
  'lang.label': 'Language',

  'header.stationName': 'Station name',
  'header.undo': 'Undo',
  'header.undoTitle': 'Undo (Ctrl+Z)',
  'header.json': 'Save / load JSON',
  'header.print': 'Print',
  'header.clear': 'Clear plan',

  'storage.writeError': 'Could not save to browser storage. Copy the JSON before closing this tab.',

  'palette.bulkheads': 'Bulkheads',
  'palette.bulkheadHint':
    'A bulkhead sits on a connection: where a corridor meets a room or another corridor. Pick a type and click the connections marked with circles, or drag a type onto a connection. Keys 1–5 pick a type.',
  'palette.selection': 'Selection',

  'bulkhead.open': 'Open passage',
  'bulkhead.door': 'Door',
  'bulkhead.bulkhead': 'Pressure bulkhead',
  'bulkhead.airlock': 'Airlock',
  'bulkhead.welded': 'Welded shut',
  'bulkhead.title': '{name} (click to change)',

  'inspector.connectionRoom': 'room – corridor connection',
  'inspector.connectionCorridor': 'corridor – corridor connection',
  'inspector.placingBulkhead': 'Placing: {name}',
  'inspector.placingBulkheadHint':
    'Click a connection marked with a circle. You can keep clicking. Esc finishes.',
  'inspector.finish': 'Finish',
  'inspector.cancel': 'Cancel',
  'inspector.rotate': 'Rotate 90°',
  'inspector.delete': 'Delete',
  'inspector.rotation': 'rotation {deg}°',
  'inspector.placeHint': 'Click the grid to place it. R rotates, Esc cancels.',
  'inspector.defaultHint':
    'Drag a module from the catalogue onto the grid, or click it and pick a spot. Click an element on the plan to select it. R rotates while dragging. Click a bulkhead on the plan to change its type.',

  'unit.cell.one': '{count} cell',
  'unit.cell.few': '{count} cells',
  'unit.cell.many': '{count} cells',
  'unit.cell.other': '{count} cells',

  'status.rooms': 'Rooms',
  'status.corridors': 'Corridors',
  'status.cells': 'Cells',
  'status.openEnds': 'Open ends',
  'status.fragments': 'Detached fragments',
  'status.zoomOut': 'Zoom out',
  'status.zoomIn': 'Zoom in',

  'toast.noFit': 'It does not fit here: cell taken or outside the plan.',
  'toast.noFitShort': 'It does not fit here.',
  'toast.noRotate': 'No room to rotate. Move the module and try again.',
  'toast.dropOnConnection': 'Drop the bulkhead on a connection marked with a circle.',
  'toast.noConnection': 'No connection here. Click a circle between two modules.',
  'toast.cleared': 'Plan cleared. "Undo" brings it back.',
  'toast.copied': 'JSON copied.',
  'toast.selectedText': 'Text selected. Copy it with the keyboard shortcut.',
  'toast.loaded': 'Plan loaded.',
  'toast.invalidJson': 'Not a plan. Check that the pasted text is the whole JSON.',

  'dialog.title': 'Station plan as JSON',
  'dialog.hint':
    'Copy the text to keep the plan. To load another plan, paste its JSON and choose "Load".',
  'dialog.copy': 'Copy',
  'dialog.load': 'Load',
  'dialog.close': 'Close',

  'sample.name': 'Kestrel-4 Outpost',
} as const

export type Messages = { [K in keyof typeof en]: string }
export type MessageKey = keyof Messages
