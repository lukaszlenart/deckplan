import { defineConfig } from 'vitest/config'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact()],
  base: './',
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
