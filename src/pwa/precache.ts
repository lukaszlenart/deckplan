export const SERVICE_WORKER_FILE = 'sw.js'
export const CACHE_PREFIX = 'deckplan-'

/** URLs the service worker caches on install, relative to its own location. */
export function precacheUrls(files: readonly string[]): string[] {
  const cached = files.filter((f) => f !== SERVICE_WORKER_FILE && !f.endsWith('.map'))
  return ['./', ...[...new Set(cached)].sort()]
}

/** Prepends the cache settings that `sw.js` reads from `self.__PRECACHE__`. */
export function serviceWorkerSource(template: string, version: string, urls: readonly string[]) {
  const precache = { cacheName: `${CACHE_PREFIX}${version}`, cachePrefix: CACHE_PREFIX, urls }
  return `self.__PRECACHE__ = ${JSON.stringify(precache)}\n${template}`
}
