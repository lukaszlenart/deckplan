import { describe, expect, it } from 'vitest'
import { CACHE_PREFIX, precacheUrls, serviceWorkerSource } from './precache'

describe('precacheUrls', () => {
  it('caches the app root and every file except the service worker and source maps', () => {
    const urls = precacheUrls([
      'index.html',
      'assets/index-abc.js',
      'assets/index-abc.js.map',
      'sw.js',
      'icon.svg',
    ])
    expect(urls).toEqual(['./', 'assets/index-abc.js', 'icon.svg', 'index.html'])
  })

  it('lists each file once', () => {
    expect(precacheUrls(['a.js', 'a.js'])).toEqual(['./', 'a.js'])
  })
})

describe('serviceWorkerSource', () => {
  it('defines the precache list before the template runs', () => {
    const template = 'const { cacheName, cachePrefix, urls } = self.__PRECACHE__'
    const source = serviceWorkerSource(template, 'v1', ['./'])
    const run = new Function('self', `${source}\nreturn { cacheName, cachePrefix, urls }`)
    expect(CACHE_PREFIX).toBe('deckplan-')
    expect(run({})).toEqual({
      cacheName: `${CACHE_PREFIX}v1`,
      cachePrefix: CACHE_PREFIX,
      urls: ['./'],
    })
  })
})
