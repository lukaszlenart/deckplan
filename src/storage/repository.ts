import type { Plan } from '../domain/types'

/** There is one plan; the repository holds the latest saved version of it. */
export interface PlanRepository {
  load(): Plan | undefined
  save(plan: Plan): void
}

export class StorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'StorageError'
  }
}
