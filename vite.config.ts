import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import preact from '@preact/preset-vite'
import { SERVICE_WORKER_FILE, precacheUrls, serviceWorkerSource } from './src/pwa/precache.ts'

/** Emits `sw.js` with the list of built and public files and a version hashed from their content. */
function serviceWorker(): Plugin {
  let publicDir = ''
  return {
    name: 'deckplan:service-worker',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      publicDir = config.publicDir
    },
    generateBundle(_, bundle) {
      const files = new Map<string, string | Uint8Array>()
      for (const output of Object.values(bundle)) {
        files.set(output.fileName, output.type === 'chunk' ? output.code : output.source)
      }
      for (const entry of readdirSync(publicDir, { recursive: true, withFileTypes: true })) {
        if (!entry.isFile()) continue
        const path = join(entry.parentPath, entry.name)
        files.set(relative(publicDir, path), readFileSync(path))
      }
      const urls = precacheUrls([...files.keys()])
      const hash = createHash('sha256')
      for (const url of urls) hash.update(url).update(files.get(url) ?? '')
      const template = readFileSync(
        fileURLToPath(new URL('./src/pwa/sw.js', import.meta.url)),
        'utf8',
      )
      this.emitFile({
        type: 'asset',
        fileName: SERVICE_WORKER_FILE,
        source: serviceWorkerSource(template, hash.digest('hex').slice(0, 12), urls),
      })
    },
  }
}

export default defineConfig({
  plugins: [preact(), serviceWorker()],
  base: './',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
