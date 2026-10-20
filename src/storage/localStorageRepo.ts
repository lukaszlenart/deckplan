import type { Plan } from '../domain/types'
import { migrate } from './migrate'
import { StorageError, type PlanRepository } from './repository'
import { parsePlan } from './schema'

export const STORAGE_KEY = 'deckplan/plan'
export const LEGACY_STORAGE_KEY = 'wy-stacja-v1'
export const CORRUPT_BACKUP_KEY = 'deckplan/plan.corrupt'

type Logger = Pick<Console, 'warn'>

export interface LocalStorageRepoOptions {
  storage?: Storage | undefined
  logger?: Logger
}

export class LocalStorageRepo implements PlanRepository {
  private readonly storage: Storage | undefined
  private readonly logger: Logger

  constructor(options: LocalStorageRepoOptions = {}) {
    this.storage = 'storage' in options ? options.storage : safeLocalStorage()
    this.logger = options.logger ?? console
  }

  load(): Plan | undefined {
    const raw = this.storage?.getItem(STORAGE_KEY) ?? this.storage?.getItem(LEGACY_STORAGE_KEY)
    if (raw == null) return undefined
    try {
      return parsePlan(migrate(JSON.parse(raw)))
    } catch (error) {
      this.logger.warn('Stored plan is unreadable; kept a copy under', CORRUPT_BACKUP_KEY, error)
      try {
        this.storage?.setItem(CORRUPT_BACKUP_KEY, raw)
      } catch {
        // Nothing more we can do; the warning above is the record.
      }
      return undefined
    }
  }

  save(plan: Plan): void {
    if (!this.storage) throw new StorageError('Browser storage is unavailable')
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(plan))
    } catch (error) {
      throw new StorageError('Could not write the plan to browser storage', { cause: error })
    }
  }
}

function safeLocalStorage(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}
