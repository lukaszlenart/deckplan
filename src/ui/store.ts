import { computed, signal, type ReadonlySignal, type Signal } from '@preact/signals'
import { analyze, canPlace, pruneBulkheads, type Analysis } from '../domain/analysis'
import { doorAt, nextRotation, pieceSize, resizePiece } from '../domain/geometry'
import { samplePlan } from '../domain/sample'
import type {
  BulkheadType,
  Cell,
  Door,
  EdgeKey,
  ModuleId,
  Piece,
  Plan,
  Rotation,
} from '../domain/types'
import { lang, translate, type MessageKey, type Params } from '../i18n'
import { LocalStorageRepo } from '../storage/localStorageRepo'
import type { PlanRepository } from '../storage/repository'

export const CELL = 34
export const ZOOMS = [0.5, 0.65, 0.8, 1, 1.25, 1.5] as const
export const HISTORY_LIMIT = 60

interface PieceDrag {
  module: ModuleId
  r: Rotation
  off: [number, number]
  sx: number
  sy: number
  moved: boolean
  over: boolean
  gx: number
  gy: number
}

export type DragState =
  | ({ kind: 'new' } & PieceDrag)
  | ({ kind: 'move'; id: number } & PieceDrag)
  | {
      kind: 'bulkhead'
      type: BulkheadType
      sx: number
      sy: number
      moved: boolean
      edge: EdgeKey | null
    }
  | {
      kind: 'resize'
      id: number
      x: number
      y: number
      /** Screen size, not the stored own-frame size. */
      w: number
      h: number
      sx: number
      sy: number
      moved: boolean
      over: boolean
    }

export interface Toast {
  id: number
  key: MessageKey
  params?: Params
}

export interface Store {
  plan: Signal<Plan>
  analysis: ReadonlySignal<Analysis>
  canUndo: Signal<boolean>
  selected: Signal<number | null>
  selectedEdge: Signal<EdgeKey | null>
  pending: Signal<{ module: ModuleId; r: Rotation } | null>
  bulkheadTool: Signal<BulkheadType | null>
  zoom: Signal<number>
  drag: Signal<DragState | null>
  hoverCell: Signal<Cell | null>
  hoverEdge: Signal<EdgeKey | null>
  toast: Signal<Toast | null>
  storageError: Signal<boolean>
  placePiece(module: ModuleId, r: Rotation, x: number, y: number): boolean
  movePiece(id: number, x: number, y: number, r: Rotation): boolean
  rotateSelected(): void
  /** `w`×`h` is the size on screen. */
  resizePiece(id: number, w: number, h: number): boolean
  deleteSelected(): void
  setBulkhead(key: EdgeKey, type: BulkheadType): void
  clearPlan(): void
  undo(): void
  renameStation(name: string): void
  loadPlan(plan: Plan): void
  selectPiece(id: number | null): void
  selectEdge(key: EdgeKey | null): void
  togglePending(module: ModuleId): void
  rotatePending(): void
  toggleBulkheadTool(type: BulkheadType): void
  cancelAll(): void
  zoomIn(): void
  zoomOut(): void
  showToast(key: MessageKey, params?: Params): void
}

export function createStore(
  repo: PlanRepository,
  sampleName: () => string,
  initialZoom = 3,
): Store {
  const loaded = repo.load()
  const plan = signal<Plan>(loaded ? pruneBulkheads(loaded) : samplePlan(sampleName()))
  const analysis = computed(() => analyze(plan.value))
  const canUndo = signal(false)
  const selected = signal<number | null>(null)
  const selectedEdge = signal<EdgeKey | null>(null)
  const pending = signal<{ module: ModuleId; r: Rotation } | null>(null)
  const bulkheadTool = signal<BulkheadType | null>(null)
  const zoom = signal(initialZoom)
  const drag = signal<DragState | null>(null)
  const hoverCell = signal<Cell | null>(null)
  const hoverEdge = signal<EdgeKey | null>(null)
  const toast = signal<Toast | null>(null)
  const storageError = signal(false)

  const sameSpot = (a: Omit<Door, 'type'>, b: Omit<Door, 'type'>) =>
    a.x === b.x && a.y === b.y && a.dir === b.dir

  const history: string[] = []
  let toastId = 0

  const showToast = (key: MessageKey, params?: Params) => {
    toast.value = { id: ++toastId, key, params }
  }

  const persist = (next: Plan) => {
    try {
      repo.save(next)
      storageError.value = false
    } catch (error) {
      console.error(error)
      storageError.value = true
    }
  }

  const snapshot = () => {
    history.push(JSON.stringify(plan.value))
    if (history.length > HISTORY_LIMIT) history.shift()
    canUndo.value = true
  }

  const commit = (next: Plan) => {
    plan.value = next
    persist(next)
  }

  const clearModes = () => {
    pending.value = null
    bulkheadTool.value = null
    hoverEdge.value = null
  }

  const store: Store = {
    plan,
    analysis,
    canUndo,
    selected,
    selectedEdge,
    pending,
    bulkheadTool,
    zoom,
    drag,
    hoverCell,
    hoverEdge,
    toast,
    storageError,

    placePiece(module, r, x, y) {
      const current = plan.value
      if (!canPlace(current, module, r, x, y)) {
        showToast('toast.noFit')
        return false
      }
      snapshot()
      const id = current.nextId
      commit({ ...current, pieces: [...current.pieces, { id, module, x, y, r }], nextId: id + 1 })
      selected.value = id
      selectedEdge.value = null
      return true
    },

    movePiece(id, x, y, r) {
      const current = plan.value
      const piece = current.pieces.find((p) => p.id === id)
      if (!piece) return false
      if (!canPlace(current, piece.module, r, x, y, id, pieceSize(piece))) {
        showToast('toast.noFitShort')
        return false
      }
      snapshot()
      const pieces = current.pieces.map((p) => (p.id === id ? { ...p, x, y, r } : p))
      commit(pruneBulkheads({ ...current, pieces }))
      selected.value = id
      selectedEdge.value = null
      return true
    },

    rotateSelected() {
      const current = plan.value
      const piece = current.pieces.find((p) => p.id === selected.value)
      if (!piece) return
      const r = nextRotation(piece.r)
      if (!canPlace(current, piece.module, r, piece.x, piece.y, piece.id, pieceSize(piece))) {
        showToast('toast.noRotate')
        return
      }
      snapshot()
      const pieces = current.pieces.map((p) => (p.id === piece.id ? { ...p, r } : p))
      commit(pruneBulkheads({ ...current, pieces }))
    },

    resizePiece(id, w, h) {
      const current = plan.value
      const piece = current.pieces.find((p) => p.id === id)
      if (!piece) return false
      const next = resizePiece(piece, w, h)
      if (next.w === piece.w && next.h === piece.h) return true
      if (!canPlace(current, piece.module, piece.r, piece.x, piece.y, id, pieceSize(next))) {
        showToast('toast.noFitShort')
        return false
      }
      snapshot()
      const pieces = current.pieces.map((p) => (p.id === id ? next : p))
      commit(pruneBulkheads({ ...current, pieces }))
      return true
    },

    deleteSelected() {
      const edge = selectedEdge.value
      const door = edge ? analysis.value.doors.get(edge) : undefined
      if (edge && door) {
        const current = plan.value
        const owner = current.pieces.find((p) => p.id === door.pieceId)
        const at = owner && doorAt(owner, edge)
        if (!owner || !at) return
        snapshot()
        const doors = (owner.doors ?? []).filter((d) => !sameSpot(d, at))
        const pieces = current.pieces.map((p) => (p.id === owner.id ? { ...p, doors } : p))
        commit(pruneBulkheads({ ...current, pieces }))
        selectedEdge.value = null
        return
      }
      const id = selected.value
      if (id == null) return
      snapshot()
      const current = plan.value
      commit(pruneBulkheads({ ...current, pieces: current.pieces.filter((p) => p.id !== id) }))
      selected.value = null
    },

    setBulkhead(key, type) {
      const current = plan.value
      const door = analysis.value.doors.get(key)
      const room = door
        ? current.pieces.find((p) => p.id === door.pieceId)
        : current.pieces
            .filter((p) => doorAt(p, key))
            .reduce<Piece | undefined>((a, p) => (a && a.id < p.id ? a : p), undefined)
      const at = room && doorAt(room, key)
      if (room && at) {
        const doors = door
          ? (room.doors ?? []).map((d) => (sameSpot(d, at) ? { ...d, type } : d))
          : [...(room.doors ?? []), { ...at, type }]
        snapshot()
        commit({
          ...current,
          pieces: current.pieces.map((p) => (p === room ? { ...p, doors } : p)),
        })
      } else if (analysis.value.edges.has(key)) {
        snapshot()
        commit({ ...current, bulkheads: { ...current.bulkheads, [key]: type } })
      } else return
      showToast(`bulkhead.${type}`)
    },

    clearPlan() {
      if (!plan.value.pieces.length) return
      snapshot()
      commit({ ...plan.value, pieces: [], bulkheads: {} })
      selected.value = null
      selectedEdge.value = null
      showToast('toast.cleared')
    },

    undo() {
      const previous = history.pop()
      if (previous === undefined) return
      canUndo.value = history.length > 0
      selected.value = null
      selectedEdge.value = null
      commit(JSON.parse(previous) as Plan)
    },

    renameStation(name) {
      const next = { ...plan.value, name }
      plan.value = next
      persist(next)
    },

    loadPlan(next) {
      snapshot()
      selected.value = null
      selectedEdge.value = null
      clearModes()
      commit(pruneBulkheads(next))
    },

    selectPiece(id) {
      selected.value = id
      if (id != null) {
        selectedEdge.value = null
        clearModes()
      }
    },

    selectEdge(key) {
      selectedEdge.value = key
      if (key != null) {
        selected.value = null
        clearModes()
      }
    },

    togglePending(module) {
      const next = pending.value?.module === module ? null : { module, r: 0 as Rotation }
      clearModes()
      pending.value = next
      selected.value = null
      selectedEdge.value = null
    },

    rotatePending() {
      const current = pending.value
      if (current) pending.value = { module: current.module, r: nextRotation(current.r) }
    },

    toggleBulkheadTool(type) {
      const next = bulkheadTool.value === type ? null : type
      clearModes()
      bulkheadTool.value = next
      selected.value = null
      selectedEdge.value = null
    },

    cancelAll() {
      drag.value = null
      clearModes()
      selected.value = null
      selectedEdge.value = null
    },

    zoomIn() {
      zoom.value = Math.min(ZOOMS.length - 1, zoom.value + 1)
    },

    zoomOut() {
      zoom.value = Math.max(0, zoom.value - 1)
    },

    showToast,
  }
  return store
}

const narrow = typeof window !== 'undefined' && window.innerWidth < 760

export const store: Store = createStore(
  new LocalStorageRepo(),
  () => translate(lang.value, 'sample.name'),
  narrow ? 1 : 3,
)
