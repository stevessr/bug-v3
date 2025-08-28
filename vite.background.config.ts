import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

// Vite config specifically for building background script
export default defineConfig({
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/background/index.ts', import.meta.url)),
      name: 'background',
      fileName: () => 'background.js',
      formats: ['iife'],
    },
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      output: {
        // Ensure we don't use external imports in background script
        inlineDynamicImports: true,
      },
    },
    target: 'es2020',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
