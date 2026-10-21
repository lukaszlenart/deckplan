import { bulkheadAt } from '../domain/analysis'
import { moduleDef } from '../domain/catalogue'
import { pieceShape } from '../domain/geometry'
import { BULKHEAD_TYPES } from '../domain/types'
import { useLocalize, usePlural, useT } from '../i18n'
import { store } from './store'

export function Inspector() {
  const t = useT()
  const localize = useLocalize()
  const plural = usePlural()
  const plan = store.plan.value
  const { edges, doors } = store.analysis.value
  const edge = store.selectedEdge.value
  const info = edge ? edges.get(edge) : undefined
  const door = edge ? doors.get(edge) : undefined

  if (edge && (info || door)) {
    const current = door?.type ?? (info ? bulkheadAt(plan, edge, info) : 'open')
    const kind = door
      ? door.connected
        ? 'inspector.connectionRoom'
        : 'inspector.doorUnconnected'
      : 'inspector.connectionCorridor'
    return (
      <div class="card">
        <div class="t">{t(`bulkhead.${current}`)}</div>
        <div class="m">{t(kind)}</div>
        <div class="row">
          {BULKHEAD_TYPES.map((type, i) => (
            <button
              key={type}
              class={type === current ? 'primary' : ''}
              onClick={() => store.setBulkhead(edge, type)}
            >
              {t(`bulkhead.${type}`)} <kbd>{i + 1}</kbd>
            </button>
          ))}
        </div>
        {door && (
          <div class="row">
            <button onClick={() => store.deleteSelected()}>
              {t('inspector.deleteDoor')} <kbd>Del</kbd>
            </button>
          </div>
        )}
      </div>
    )
  }

  const tool = store.bulkheadTool.value
  if (tool) {
    return (
      <div class="card">
        <div class="t">{t('inspector.placingBulkhead', { name: t(`bulkhead.${tool}`) })}</div>
        <p class="hint">{t('inspector.placingBulkheadHint')}</p>
        <div class="row">
          <button onClick={() => store.toggleBulkheadTool(tool)}>{t('inspector.finish')}</button>
        </div>
      </div>
    )
  }

  const piece = plan.pieces.find((p) => p.id === store.selected.value)
  if (piece) {
    const d = moduleDef(piece.module)
    const cells = pieceShape(piece).cells.length
    return (
      <div class="card">
        <div class="t">{localize(d.name)}</div>
        <div class="m">
          {d.code} · {plural('unit.cell', cells)} · {t('inspector.rotation', { deg: piece.r * 90 })}
        </div>
        <div class="row">
          <button onClick={() => store.rotateSelected()}>
            {t('inspector.rotate')} <kbd>R</kbd>
          </button>
          <button onClick={() => store.deleteSelected()}>
            {t('inspector.delete')} <kbd>Del</kbd>
          </button>
        </div>
      </div>
    )
  }

  const pending = store.pending.value
  if (pending) {
    const d = moduleDef(pending.module)
    return (
      <div class="card">
        <div class="t">{localize(d.name)}</div>
        <div class="m">
          {d.code} · {t('inspector.rotation', { deg: pending.r * 90 })}
        </div>
        <p class="hint">{t('inspector.placeHint')}</p>
        <div class="row">
          <button onClick={() => store.rotatePending()}>{t('inspector.rotate')}</button>
          <button onClick={() => store.togglePending(pending.module)}>
            {t('inspector.cancel')}
          </button>
        </div>
      </div>
    )
  }

  return <p class="hint">{t('inspector.defaultHint')}</p>
}
