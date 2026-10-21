import { moduleDef } from '../domain/catalogue'
import { pieceShape } from '../domain/geometry'
import { useT } from '../i18n'
import { store } from './store'

export function StatusBar() {
  const t = useT()
  const plan = store.plan.value
  const { open, fragments } = store.analysis.value
  const rooms = plan.pieces.filter((p) => moduleDef(p.module).kind === 'room').length
  const cells = plan.pieces.reduce((a, p) => a + pieceShape(p).cells.length, 0)
  const openEnds = open.filter((o) => !o.room).length
  const detached = plan.pieces.length ? fragments - 1 : 0
  return (
    <div class="status" id="status">
      <span>
        {t('status.rooms')} <b>{rooms}</b>
      </span>
      <span>
        {t('status.corridors')} <b>{plan.pieces.length - rooms}</b>
      </span>
      <span>
        {t('status.cells')} <b>{cells}</b>
      </span>
      <span class={openEnds ? 'warn' : 'good'}>
        {t('status.openEnds')} <b>{openEnds}</b>
      </span>
      <span class={detached ? 'warn' : 'good'}>
        {t('status.fragments')} <b>{detached}</b>
      </span>
      <span class="zoom">
        <button aria-label={t('status.zoomOut')} onClick={() => store.zoomOut()}>
          −
        </button>
        <button aria-label={t('status.zoomIn')} onClick={() => store.zoomIn()}>
          +
        </button>
      </span>
    </div>
  )
}
