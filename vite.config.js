import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: {
    exclude: ['@grame/faustwasm']
  },
  build: {
    minify: 'esbuild',
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'pqca/index.html'),
      },
    },
  },
  esbuild: {
    minifyIdentifiers: false, // no name mangling — fixes the wasm glue
    minifySyntax: true,       // still minify syntax
    minifyWhitespace: true,   // still minify whitespace
  }
})