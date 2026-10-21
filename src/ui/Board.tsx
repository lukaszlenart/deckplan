import { useEffect, useRef } from 'preact/hooks'
import { edgeCenter, isResizable, pieceShape, placementOffset, portPoint } from '../domain/geometry'
import { GRID } from '../domain/types'
import {
  beginMoveDrag,
  beginResizeDrag,
  cellAt,
  moveDrag,
  nearestEdge,
  resolveDrop,
  rotateDrag,
  type Box,
} from './pointer'
import { useT } from '../i18n'
import { CELL, store, ZOOMS } from './store'
import { Ghost } from './svg/Ghost'
import { PlanDrawing } from './svg/PlanDrawing'

const CLICK_SUPPRESS_MS = 50

export function Board() {
  const t = useT()
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const suppressClick = useRef(false)

  const boxes = (): { board: Box; wrap: Box } | null => {
    const svg = svgRef.current
    const wrap = wrapRef.current
    if (!svg || !wrap) return null
    return { board: svg.getBoundingClientRect(), wrap: wrap.getBoundingClientRect() }
  }
  const suppressNextClick = () => {
    suppressClick.current = true
    setTimeout(() => (suppressClick.current = false), CLICK_SUPPRESS_MS)
  }
  const edgeUnder = (e: PointerEvent) => {
    const b = boxes()
    if (!b || !cellAt(b.board, b.wrap, e)) return null
    return nearestEdge(b.board, store.analysis.value.edges.keys(), e)
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = store.drag.value
      const b = boxes()
      if (!b) return
      if (!drag) {
        if (e.pointerType !== 'mouse') return
        if (store.pending.value) store.hoverCell.value = cellAt(b.board, b.wrap, e)
        else if (store.bulkheadTool.value) store.hoverEdge.value = edgeUnder(e)
        return
      }
      const cell = cellAt(b.board, b.wrap, e)
      const next = moveDrag(drag, e, cell, cell ? edgeUnder(e) : null)
      if (next.moved) e.preventDefault()
      store.drag.value = next
    }
    const onUp = () => {
      const drag = store.drag.value
      if (!drag) return
      store.drag.value = null
      const drop = resolveDrop(drag)
      if (drop.kind === 'click') {
        if (drag.kind === 'bulkhead') store.toggleBulkheadTool(drag.type)
        else if (drag.kind === 'new') store.togglePending(drag.module)
        else store.selectPiece(drag.id)
        return
      }
      suppressNextClick()
      if (drop.kind === 'bulkhead') {
        if (drop.edge) {
          store.selectEdge(drop.edge)
          store.setBulkhead(drop.edge, drop.type)
        } else store.showToast('toast.dropOnConnection')
      } else if (drop.kind === 'place') store.placePiece(drop.module, drop.r, drop.x, drop.y)
      else if (drop.kind === 'move') store.movePiece(drop.id, drop.x, drop.y, drop.r)
      else if (drop.kind === 'resize') store.resizePiece(drop.id, drop.w, drop.h)
    }
    const onCancel = () => (store.drag.value = null)
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [])

  useEffect(() => {
    const wrap = wrapRef.current
    if (wrap) wrap.scrollTop = Math.max(0, 3 * CELL * (ZOOMS[store.zoom.value] ?? 1))
  }, [])

  const onPointerDown = (e: PointerEvent) => {
    const target = e.target as Element | null
    if (store.bulkheadTool.value) {
      e.preventDefault()
      suppressNextClick()
      const edge = edgeUnder(e)
      if (edge) store.setBulkhead(edge, store.bulkheadTool.value)
      else store.showToast('toast.noConnection')
      return
    }
    const edgeEl = target?.closest<SVGElement>('[data-edge]')
    if (edgeEl?.dataset.edge) {
      e.preventDefault()
      suppressNextClick()
      store.selectEdge(edgeEl.dataset.edge)
      return
    }
    const gripEl = target?.closest<SVGElement>('[data-grip]')
    if (gripEl?.dataset.grip) {
      e.preventDefault()
      const piece = store.plan.value.pieces.find((p) => p.id === Number(gripEl.dataset.grip))
      if (piece) store.drag.value = beginResizeDrag(piece, e)
      return
    }
    const pieceEl = target?.closest<SVGElement>('[data-id]')
    if (pieceEl?.dataset.id) {
      e.preventDefault()
      const piece = store.plan.value.pieces.find((p) => p.id === Number(pieceEl.dataset.id))
      const b = boxes()
      if (!piece || !b) return
      const cell = cellAt(b.board, b.wrap, e) ?? [piece.x, piece.y]
      store.drag.value = beginMoveDrag(piece, cell, e)
    }
  }

  const onClick = (e: MouseEvent) => {
    const target = e.target as Element | null
    if (store.bulkheadTool.value || suppressClick.current) return
    if (target?.closest('[data-id],[data-edge]')) return
    const b = boxes()
    const cell = b && cellAt(b.board, b.wrap, e)
    if (!cell) return
    const pending = store.pending.value
    if (pending) {
      const [ox, oy] = placementOffset(pending.module, pending.r)
      store.placePiece(pending.module, pending.r, cell[0] - ox, cell[1] - oy)
    } else if (store.selected.value != null || store.selectedEdge.value) {
      store.selectPiece(null)
      store.selectEdge(null)
    }
  }

  const onContextMenu = (e: MouseEvent) => {
    const drag = store.drag.value
    if (drag?.moved) {
      e.preventDefault()
      store.drag.value = rotateDrag(drag)
    }
  }

  const plan = store.plan.value
  const { edges, open } = store.analysis.value
  const z = ZOOMS[store.zoom.value] ?? 1
  const drag = store.drag.value
  const selected =
    drag?.kind === 'resize' ? undefined : plan.pieces.find((p) => p.id === store.selected.value)
  const grip =
    selected && !drag && !store.bulkheadTool.value && isResizable(selected.module)
      ? pieceShape(selected)
      : null
  const selectedEdge = store.selectedEdge.value
  const ring = selectedEdge && edges.has(selectedEdge) ? edgeCenter(selectedEdge) : null

  return (
    <div id="boardWrap" ref={wrapRef}>
      <svg
        id="board"
        ref={svgRef}
        xmlns="http://www.w3.org/2000/svg"
        class={store.bulkheadTool.value ? 'doormode' : ''}
        viewBox={`0 0 ${GRID.width} ${GRID.height}`}
        width={GRID.width * CELL * z}
        height={GRID.height * CELL * z}
        onPointerDown={onPointerDown}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onPointerLeave={() => {
          if (!store.drag.value) store.hoverCell.value = null
        }}
      >
        <PlanDrawing plan={plan} edges={edges} idPrefix="board" />
        <g pointer-events="none">
          {open.map((o) => {
            const [X, Y] = portPoint(o.x, o.y, o.dir)
            return o.room ? (
              <circle
                key={`${o.x},${o.y},${o.dir}`}
                cx={X}
                cy={Y}
                r=".07"
                fill="none"
                stroke="var(--muted)"
                stroke-width=".03"
              />
            ) : (
              <circle key={`${o.x},${o.y},${o.dir}`} cx={X} cy={Y} r=".11" fill="var(--bad)" />
            )
          })}
          {ring && (
            <circle
              cx={ring[0]}
              cy={ring[1]}
              r=".36"
              fill="none"
              stroke="var(--accent)"
              stroke-width=".06"
              stroke-dasharray=".14 .08"
            />
          )}
          {selected &&
            pieceShape(selected).cells.map(([x, y]) => (
              <rect
                key={`${x},${y}`}
                x={selected.x + x + 0.04}
                y={selected.y + y + 0.04}
                width=".92"
                height=".92"
                fill="none"
                stroke="var(--accent)"
                stroke-width=".06"
                stroke-dasharray=".18 .1"
              />
            ))}
        </g>
        {selected && grip && (
          <g class="grip" data-grip={selected.id} role="button" aria-label={t('board.resizeGrip')}>
            <rect
              x={selected.x + grip.w - 0.55}
              y={selected.y + grip.h - 0.55}
              width=".7"
              height=".7"
              fill="transparent"
            />
            <path
              d={`M${selected.x + grip.w - 0.08} ${selected.y + grip.h - 0.48}V${selected.y + grip.h - 0.08}H${selected.x + grip.w - 0.48}Z`}
              fill="var(--bh-door)"
              stroke="var(--bg)"
              stroke-width=".04"
            />
          </g>
        )}
        <g id="ghost" pointer-events="none">
          <Ghost />
        </g>
      </svg>
    </div>
  )
}
