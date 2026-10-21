import { describe, expect, it, vi } from 'vitest'
import { samplePlan } from '../domain/sample'
import { makePlan } from '../domain/testing'
import { LEGACY_KESTREL } from './legacyFixture'
import {
  CORRUPT_BACKUP_KEY,
  LEGACY_STORAGE_KEY,
  LocalStorageRepo,
  STORAGE_KEY,
} from './localStorageRepo'
import { MemoryStorage } from './memoryStorage'
import { StorageError } from './repository'

const quiet = { warn: vi.fn() }

describe('LocalStorageRepo', () => {
  it('loads nothing from empty storage', () => {
    const repo = new LocalStorageRepo({ storage: new MemoryStorage(), logger: quiet })
    expect(repo.load()).toBeUndefined()
  })

  it('round-trips a plan under the current key', () => {
    const storage = new MemoryStorage()
    const repo = new LocalStorageRepo({ storage, logger: quiet })
    const plan = samplePlan('X')
    repo.save(plan)
    expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? '')).toEqual(plan)
    expect(repo.load()).toEqual(plan)
  })

  it('migrates a plan stored under the legacy key and leaves that key in place', () => {
    const storage = new MemoryStorage()
    storage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(LEGACY_KESTREL))
    const repo = new LocalStorageRepo({ storage, logger: quiet })
    const plan = repo.load()
    expect(plan?.pieces).toHaveLength(21)
    expect(plan?.bulkheads['16,5,S']).toBe('airlock')
    expect(storage.getItem(LEGACY_STORAGE_KEY)).not.toBeNull()
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('backs up unparseable JSON and loads nothing', () => {
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEY, '{not json')
    const warn = vi.fn()
    const repo = new LocalStorageRepo({ storage, logger: { warn } })
    expect(repo.load()).toBeUndefined()
    expect(storage.getItem(CORRUPT_BACKUP_KEY)).toBe('{not json')
    expect(warn).toHaveBeenCalled()
  })

  it('backs up parseable but invalid data and loads nothing', () => {
    const storage = new MemoryStorage()
    const raw = JSON.stringify({ schemaVersion: 1, name: 'x', pieces: [{ id: 1, module: 'Z9' }] })
    storage.setItem(STORAGE_KEY, raw)
    const warn = vi.fn()
    const repo = new LocalStorageRepo({ storage, logger: { warn } })
    expect(repo.load()).toBeUndefined()
    expect(storage.getItem(CORRUPT_BACKUP_KEY)).toBe(raw)
    expect(warn).toHaveBeenCalled()
  })

  it('without storage loads nothing and refuses to save', () => {
    const repo = new LocalStorageRepo({ storage: undefined, logger: quiet })
    expect(repo.load()).toBeUndefined()
    expect(() => repo.save(samplePlan('X'))).toThrow(StorageError)
  })

  it('wraps a failing setItem in StorageError', () => {
    const storage = new MemoryStorage()
    storage.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    const repo = new LocalStorageRepo({ storage, logger: quiet })
    expect(() => repo.save(samplePlan('X'))).toThrow(StorageError)
  })

  it('loads a plan saved before placed doors with doorless rooms', () => {
    const old = makePlan(
      [
        { module: 'M1', x: 0, y: 1, r: 0 },
        { module: 'K1', x: 0, y: 2, r: 0 },
      ],
      { '0,1,S': 'airlock' },
    )
    const storage = new MemoryStorage()
    storage.setItem(STORAGE_KEY, JSON.stringify(old))
    const loaded = new LocalStorageRepo({ storage, logger: quiet }).load()
    expect(loaded?.pieces[0]).not.toHaveProperty('doors')
    expect(storage.getItem(CORRUPT_BACKUP_KEY)).toBeNull()
  })
})
