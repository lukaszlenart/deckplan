import { describe, expect, it } from 'vitest'
import { samplePlan } from '../domain/sample'
import { LocalStorageRepo, STORAGE_KEY } from '../storage/localStorageRepo'
import { MemoryStorage } from '../storage/memoryStorage'
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

  it('movePiece prunes bulkheads that lost their edge', () => {
    const { store } = setup()
    expect(store.plan.value.bulkheads['16,5,S']).toBe('airlock')
    expect(store.movePiece(21, 30, 20, 0)).toBe(true)
    expect(store.plan.value.bulkheads['16,5,S']).toBeUndefined()
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
})
