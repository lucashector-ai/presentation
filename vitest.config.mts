import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
      // módulos de servidor importam `server-only`, que só o bundler (vinext) resolve
      'server-only': fileURLToPath(new URL('./lib/teste/vazio.ts', import.meta.url)),
      // fora do vinext, `next/*` vem dos shims dele (o pacote `next` não está instalado)
      'next/server': fileURLToPath(new URL('./node_modules/vinext/dist/shims/server.js', import.meta.url)),
    },
  },
  test: {
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts', 'components/**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
  },
})
