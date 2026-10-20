import { BULKHEAD_TYPES, type BulkheadType } from '../domain/types'
import { useT } from '../i18n'
import { beginBulkheadDrag } from './pointer'
import { store } from './store'

const ICONS: Record<BulkheadType, preact.JSX.Element> = {
  open: (
    <line
      x1="2"
      y1="7"
      x2="26"
      y2="7"
      stroke="var(--muted)"
      stroke-width="1"
      stroke-dasharray="3 3"
    />
  ),
  door: <rect x="4" y="5" width="20" height="4" fill="var(--ink)" />,
  bulkhead: <rect x="3" y="3.5" width="22" height="7" fill="var(--accent)" stroke="var(--ink)" />,
  airlock: (
    <>
      <rect x="3" y="2.5" width="22" height="3" fill="var(--yellow)" />
      <rect x="3" y="8.5" width="22" height="3" fill="var(--yellow)" />
    </>
  ),
  welded: (
    <>
      <rect x="3" y="3.5" width="22" height="7" fill="var(--bad)" />
      <path d="M11 4.5l6 5M17 4.5l-6 5" stroke="var(--board)" stroke-width="1.5" />
    </>
  ),
}

export function BulkheadPalette() {
  const t = useT()
  const tool = store.bulkheadTool.value
  return (
    <section>
      <h2>{t('palette.bulkheads')}</h2>
      <div class="group" id="doorPalette">
        {BULKHEAD_TYPES.map((type, i) => (
          <div
            key={type}
            class={`item door${tool === type ? ' active' : ''}`}
            tabIndex={0}
            role="button"
            title={t(`bulkhead.${type}`)}
            onPointerDown={(e) => {
              e.preventDefault()
              store.drag.value = beginBulkheadDrag(type, e)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                store.toggleBulkheadTool(type)
              }
            }}
          >
            <svg viewBox="0 0 28 14">{ICONS[type]}</svg>
            <span>{t(`bulkhead.${type}`)}</span>
            <code>{i + 1}</code>
          </div>
        ))}
      </div>
      <p class="hint" style="margin-top:8px">
        {t('palette.bulkheadHint')}
      </p>
    </section>
  )
}
