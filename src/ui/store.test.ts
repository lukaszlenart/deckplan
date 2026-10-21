import { describe, expect, it } from 'vitest'
import { samplePlan } from '../domain/sample'
import { freeWallSegments } from '../domain/analysis'
import { makePlan } from '../domain/testing'
import type { Plan } from '../domain/types'
import { LocalStorageRepo, STORAGE_KEY } from '../storage/localStorageRepo'
import { MemoryStorage } from '../storage/memoryStorage'
import { exportPlan, importPlan } from '../storage/backup'
import { createStore, HISTORY_LIMIT } from './store'

const quiet = { warn: () => {} }

function setup(storage: Storage | undefined = new MemoryStorage()) {
  const repo = new LocalStorageRepo({ storage, logger: quiet })
  return { storage, store: createStore(repo, () => 'Sample') }
}

describe('store', () => {
  it('starts from the sample plan when storage is empty', () => {
    const { store } = setup()
    expect(store.plan.value.name).toBe('Sample')
    expect(store.plan.value.pieces).toHaveLength(21)
    expect(store.canUndo.value).toBe(false)
  })

  it('loads the stored plan when there is one', () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEY, JSON.stringify(samplePlan('Stored')))
    expect(setup(storage).store.plan.value.name).toBe('Stored')
  })

  it('placePiece adds, selects and persists; refuses an occupied cell', () => {
    const { store, storage } = setup()
    expect(store.placePiece('K1', 0, 30, 20)).toBe(true)
    const added = store.plan.value.pieces.at(-1)
    expect(added).toEqual({ id: 22, module: 'K1', x: 30, y: 20, r: 0 })
    expect(store.selected.value).toBe(22)
    expect(store.plan.value.nextId).toBe(23)
    expect(JSON.parse(storage?.getItem(STORAGE_KEY) ?? '').pieces).toHaveLength(22)
    expect(store.placePiece('K1', 0, 30, 20)).toBe(false)
    expect(store.toast.value?.key).toBe('toast.noFit')
    expect(store.plan.value.pieces).toHaveLength(22)
  })

  it('rotateSelected refuses when blocked and toasts', () => {
    const { store } = setup()
    store.placePiece('O4', 0, 30, 20)
    store.placePiece('K1', 0, 31, 22)
    store.selectPiece(22)
    store.rotateSelected()
    expect(store.plan.value.pieces.find((p) => p.id === 22)?.r).toBe(0)
    expect(store.toast.value?.key).toBe('toast.noRotate')
    store.placePiece('K1', 0, 35, 25)
    store.rotateSelected()
    expect(store.plan.value.pieces.find((p) => p.id === 24)?.r).toBe(1)
  })

  it('setBulkhead ignores unknown edges and stores known ones', () => {
    const { store } = setup()
    store.setBulkhead('30,30,S', 'welded')
    expect(store.plan.value.bulkheads['30,30,S']).toBeUndefined()
    store.setBulkhead('4,8,E', 'welded')
    expect(store.plan.value.bulkheads['4,8,E']).toBe('welded')
    expect(store.toast.value?.key).toBe('bulkhead.welded')
  })

  it('undo restores the previous plan and is capped', () => {
    const { store } = setup()
    for (let i = 0; i < HISTORY_LIMIT + 5; i++)
      store.placePiece('K1', 0, 20 + (i % 20), 20 + Math.floor(i / 20))
    expect(store.plan.value.pieces).toHaveLength(21 + HISTORY_LIMIT + 5)
    let undone = 0
    while (store.canUndo.value) {
      store.undo()
      undone++
    }
    expect(undone).toBe(HISTORY_LIMIT)
    expect(store.plan.value.pieces).toHaveLength(21 + 5)
  })

  it('undo after loadPlan brings the previous plan back', () => {
    const { store } = setup()
    store.loadPlan(samplePlan('Other'))
    expect(store.plan.value.name).toBe('Other')
    store.undo()
    expect(store.plan.value.name).toBe('Sample')
  })

  it('selection rules: pending clears selection, selecting an edge clears the piece', () => {
    const { store } = setup()
    store.selectPiece(1)
    store.togglePending('K2')
    expect(store.selected.value).toBeNull()
    expect(store.pending.value).toEqual({ module: 'K2', r: 0 })
    store.rotatePending()
    expect(store.pending.value?.r).toBe(1)
    store.togglePending('K2')
    expect(store.pending.value).toBeNull()
    store.selectPiece(1)
    store.selectEdge('4,8,E')
    expect(store.selected.value).toBeNull()
    expect(store.selectedEdge.value).toBe('4,8,E')
    store.toggleBulkheadTool('door')
    expect(store.selectedEdge.value).toBeNull()
    expect(store.bulkheadTool.value).toBe('door')
    store.cancelAll()
    expect(store.bulkheadTool.value).toBeNull()
  })

  it('deleteSelected removes the piece and clears the selection', () => {
    const { store } = setup()
    store.selectPiece(1)
    store.deleteSelected()
    expect(store.plan.value.pieces.find((p) => p.id === 1)).toBeUndefined()
    expect(store.selected.value).toBeNull()
  })

  it('movePiece carries the room doors and drops the connection it left', () => {
    const { store } = setup()
    expect(store.analysis.value.edges.get('16,5,S')?.door?.type).toBe('airlock')
    expect(store.movePiece(21, 30, 20, 0)).toBe(true)
    expect(store.analysis.value.edges.has('16,5,S')).toBe(false)
    expect(store.analysis.value.doors.get('30,20,S')).toMatchObject({ type: 'airlock' })
    expect(store.movePiece(21, 4, 8, 0)).toBe(false)
    expect(store.toast.value?.key).toBe('toast.noFitShort')
  })

  it('clearPlan empties the plan and undo restores it', () => {
    const { store } = setup()
    store.clearPlan()
    expect(store.plan.value.pieces).toEqual([])
    expect(store.analysis.value.fragments).toBe(0)
    store.undo()
    expect(store.plan.value.pieces).toHaveLength(21)
  })

  it('renameStation persists without a snapshot', () => {
    const { store, storage } = setup()
    store.renameStation('Renamed')
    expect(JSON.parse(storage?.getItem(STORAGE_KEY) ?? '').name).toBe('Renamed')
    expect(store.canUndo.value).toBe(false)
  })

  it('storageError is set when save throws and cleared on the next success', () => {
    const storage = new MemoryStorage()
    const original = storage.setItem.bind(storage)
    let failOnce = true
    storage.setItem = (k, v) => {
      if (failOnce) {
        failOnce = false
        throw new Error('quota')
      }
      original(k, v)
    }
    const { store } = setup(storage)
    store.placePiece('K1', 0, 30, 20)
    expect(store.storageError.value).toBe(true)
    store.placePiece('K1', 0, 31, 20)
    expect(store.storageError.value).toBe(false)
  })

  it('zoom stays within bounds', () => {
    const { store } = setup()
    for (let i = 0; i < 10; i++) store.zoomIn()
    expect(store.zoom.value).toBe(5)
    for (let i = 0; i < 10; i++) store.zoomOut()
    expect(store.zoom.value).toBe(0)
  })

  it('hands out unique ids after loading a plan with a stale nextId', () => {
    const { store } = setup()
    const stale = { ...samplePlan('Stale'), nextId: 1 }
    const result = importPlan(JSON.stringify(stale))
    if (!result.ok) throw new Error('import failed')
    store.loadPlan(result.plan)
    store.placePiece('K1', 0, 30, 20)
    const ids = store.plan.value.pieces.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('placing or moving a piece clears the edge selection', () => {
    const { store } = setup()
    store.selectEdge('4,8,E')
    store.placePiece('K1', 0, 30, 20)
    expect(store.selectedEdge.value).toBeNull()
    store.selectEdge('4,8,E')
    store.movePiece(22, 31, 20, 0)
    expect(store.selectedEdge.value).toBeNull()
  })

  it('resizePiece grows a room, undo restores it, same size is a no-op', () => {
    const { store } = setup()
    store.loadPlan(makePlan([{ module: 'O4', x: 0, y: 0, r: 0 }]))
    expect(store.resizePiece(1, 6, 3)).toBe(true)
    expect(store.plan.value.pieces[0]).toMatchObject({ w: 6, h: 3 })
    const before = store.plan.value
    expect(store.resizePiece(1, 6, 3)).toBe(true)
    expect(store.plan.value).toBe(before)
    store.undo()
    expect(store.plan.value.pieces[0]).not.toHaveProperty('w')
  })

  it('resizePiece refuses to overlap and stores rotated sizes in the own frame', () => {
    const { store } = setup()
    store.loadPlan(
      makePlan([
        { module: 'O4', x: 0, y: 0, r: 1 },
        { module: 'M1', x: 0, y: 6, r: 0 },
      ]),
    )
    expect(store.resizePiece(1, 2, 7)).toBe(false)
    expect(store.toast.value?.key).toBe('toast.noFitShort')
    expect(store.resizePiece(1, 3, 5)).toBe(true)
    expect(store.plan.value.pieces[0]).toMatchObject({ w: 5, h: 3 })
  })

  it('rotateSelected checks and keeps the resized footprint', () => {
    const { store } = setup()
    store.loadPlan(
      makePlan([
        { module: 'O4', x: 0, y: 0, r: 0, w: 6, h: 2 },
        { module: 'M1', x: 1, y: 4, r: 0 },
      ]),
    )
    store.selectPiece(1)
    store.rotateSelected()
    expect(store.toast.value?.key).toBe('toast.noRotate')
    store.loadPlan(makePlan([{ module: 'O4', x: 0, y: 0, r: 0, w: 6, h: 2 }]))
    store.selectPiece(1)
    store.rotateSelected()
    expect(store.plan.value.pieces[0]).toMatchObject({ r: 1, w: 6, h: 2 })
  })

  it('movePiece checks and keeps the resized footprint', () => {
    const { store } = setup()
    store.loadPlan(
      makePlan([
        { module: 'O4', x: 0, y: 0, r: 0, w: 6, h: 2 },
        { module: 'M1', x: 15, y: 0, r: 0 },
      ]),
    )
    expect(store.movePiece(1, 10, 0, 0)).toBe(false)
    expect(store.movePiece(1, 2, 5, 0)).toBe(true)
    expect(store.plan.value.pieces[0]).toMatchObject({ x: 2, y: 5, w: 6, h: 2 })
  })

  it('setBulkhead places a door on a free wall, retypes it, and Delete removes it', () => {
    const { store } = setup()
    store.loadPlan(
      makePlan([
        { module: 'M1', x: 0, y: 1, r: 0 },
        { module: 'K1', x: 0, y: 2, r: 0 },
      ]),
    )
    store.setBulkhead('0,1,S', 'door')
    expect(store.plan.value.pieces[0]?.doors).toEqual([{ x: 0, y: 0, dir: 4, type: 'door' }])
    expect(store.analysis.value.fragments).toBe(1)
    store.setBulkhead('0,1,S', 'welded')
    expect(store.plan.value.pieces[0]?.doors).toEqual([{ x: 0, y: 0, dir: 4, type: 'welded' }])
    store.selectEdge('0,1,S')
    store.deleteSelected()
    expect(store.plan.value.pieces[0]?.doors ?? []).toEqual([])
    expect(store.plan.value.pieces).toHaveLength(2)
    expect(store.analysis.value.open).toContainEqual({ x: 0, y: 2, dir: 0, room: false })
    store.undo()
    expect(store.plan.value.pieces[0]?.doors).toEqual([{ x: 0, y: 0, dir: 4, type: 'welded' }])
  })

  it('a door on a shared wall is placed once, on the lower-id room', () => {
    const { store } = setup()
    store.loadPlan(
      makePlan([
        { module: 'M1', x: 1, y: 0, r: 0 },
        { module: 'M1', x: 0, y: 0, r: 0 },
      ]),
    )
    store.setBulkhead('0,0,E', 'door')
    expect(store.plan.value.pieces.map((p) => p.doors ?? [])).toEqual([
      [{ x: 0, y: 0, dir: 6, type: 'door' }],
      [],
    ])
    expect(freeWallSegments(store.plan.value)).not.toContain('0,0,E')
  })

  it('loading drops bulkheads stored on room edges', () => {
    const { store } = setup()
    store.loadPlan(
      makePlan(
        [
          { module: 'M1', x: 0, y: 1, r: 0 },
          { module: 'K1', x: 0, y: 2, r: 0 },
        ],
        { '0,1,S': 'airlock' },
      ),
    )
    expect(store.plan.value.bulkheads).toEqual({})
  })

  describe('a room moved onto another room door drops its own clashing door', () => {
    const rooms = () =>
      makePlan([
        { module: 'M1', x: 5, y: 5, r: 0, doors: [{ x: 0, y: 0, dir: 2, type: 'door' }] },
        { module: 'M1', x: 8, y: 5, r: 0, doors: [{ x: 0, y: 0, dir: 6, type: 'welded' }] },
      ])
    const exportable = (plan: Plan) => importPlan(exportPlan(plan)).ok

    it('movePiece', () => {
      const { store } = setup()
      store.loadPlan(rooms())
      expect(store.movePiece(2, 6, 5, 0)).toBe(true)
      expect(store.plan.value.pieces[1]?.doors ?? []).toEqual([])
      expect(store.analysis.value.doors.get('5,5,E')).toMatchObject({ pieceId: 1, type: 'door' })
      expect(exportable(store.plan.value)).toBe(true)
    })

    it('rotateSelected', () => {
      const { store } = setup()
      store.loadPlan(
        makePlan([
          { module: 'M1', x: 5, y: 5, r: 0, doors: [{ x: 0, y: 0, dir: 2, type: 'door' }] },
          { module: 'M1', x: 6, y: 5, r: 1, doors: [{ x: 0, y: 0, dir: 2, type: 'welded' }] },
        ]),
      )
      store.selectPiece(2)
      store.rotateSelected()
      expect(store.plan.value.pieces[1]).toMatchObject({ r: 2 })
      expect(store.plan.value.pieces[1]?.doors ?? []).toEqual([])
      expect(exportable(store.plan.value)).toBe(true)
    })

    it('resizePiece', () => {
      const { store } = setup()
      store.loadPlan(
        makePlan([
          { module: 'O4', x: 10, y: 10, r: 0, doors: [{ x: 3, y: 0, dir: 2, type: 'airlock' }] },
          { module: 'M1', x: 15, y: 10, r: 0, doors: [{ x: 0, y: 0, dir: 6, type: 'door' }] },
        ]),
      )
      expect(store.resizePiece(1, 5, 2)).toBe(true)
      expect(store.plan.value.pieces[0]?.doors ?? []).toEqual([])
      expect(store.analysis.value.doors.get('14,10,E')).toMatchObject({ pieceId: 2, type: 'door' })
      expect(exportable(store.plan.value)).toBe(true)
    })
  })
})
