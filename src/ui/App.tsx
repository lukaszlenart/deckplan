import { useEffect, useState } from 'preact/hooks'
import { BULKHEAD_TYPES } from '../domain/types'
import { lang, useT } from '../i18n'
import { exportPlan } from '../storage/backup'
import { Board } from './Board'
import { BulkheadPalette } from './BulkheadPalette'
import { LangSwitch } from './components/LangSwitch'
import { Inspector } from './Inspector'
import { JsonDialog } from './JsonDialog'
import { Palette } from './Palette'
import { PrintSheet } from './PrintSheet'
import { rotateDrag } from './pointer'
import { useShortcuts } from './shortcuts'
import { StatusBar } from './StatusBar'
import { store } from './store'
import { Toast } from './Toast'

export function App() {
  const t = useT()
  const [dialog, setDialog] = useState<{ id: number; text: string } | null>(null)

  useEffect(() => {
    document.documentElement.lang = lang.value
    document.title = t('app.title')
  }, [lang.value])

  const pickBulkhead = (i: number) => () => {
    const type = BULKHEAD_TYPES[i]
    if (!type) return
    const edge = store.selectedEdge.value
    if (edge) store.setBulkhead(edge, type)
    else if (store.bulkheadTool.value !== type) store.toggleBulkheadTool(type)
  }

  useShortcuts({
    r: () => {
      const drag = store.drag.value
      if (drag?.moved) store.drag.value = rotateDrag(drag)
      else if (store.pending.value) store.rotatePending()
      else store.rotateSelected()
    },
    Delete: () => store.deleteSelected(),
    Backspace: () => store.deleteSelected(),
    Escape: () => store.cancelAll(),
    'mod+z': () => store.undo(),
    '1': pickBulkhead(0),
    '2': pickBulkhead(1),
    '3': pickBulkhead(2),
    '4': pickBulkhead(3),
    '5': pickBulkhead(4),
  })

  return (
    <>
      <header>
        <div class="brand">
          <b>{t('app.title')}</b>
          <input
            id="stationName"
            aria-label={t('header.stationName')}
            value={store.plan.value.name}
            onChange={(e) => store.renameStation(e.currentTarget.value)}
          />
        </div>
        <div class="tools">
          <button
            id="undoBtn"
            title={t('header.undoTitle')}
            disabled={!store.canUndo.value}
            onClick={() => store.undo()}
          >
            {t('header.undo')}
          </button>
          <button
            id="exportBtn"
            onClick={() => setDialog({ id: Date.now(), text: exportPlan(store.plan.value) })}
          >
            {t('header.json')}
          </button>
          <button id="printBtn" onClick={() => window.print()}>
            {t('header.print')}
          </button>
          <button id="clearBtn" onClick={() => store.clearPlan()}>
            {t('header.clear')}
          </button>
          <LangSwitch />
        </div>
      </header>
      {store.storageError.value && (
        <div class="banner" role="alert">
          {t('storage.writeError')}
        </div>
      )}
      <div class="app">
        <aside>
          <Palette />
          <BulkheadPalette />
          <section>
            <h2>{t('palette.selection')}</h2>
            <div id="inspector">
              <Inspector />
            </div>
          </section>
        </aside>
        <main>
          <StatusBar />
          <Board />
        </main>
      </div>
      {dialog && <JsonDialog key={dialog.id} text={dialog.text} onClose={() => setDialog(null)} />}
      <Toast />
      <PrintSheet />
    </>
  )
}
