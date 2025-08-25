import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

// Minimal config: build only the content-script entry as a single IIFE bundle
export default defineConfig({
  plugins: [vue(), vueJsx()],
  build: {
    target: 'es2019',
    sourcemap: false,
    rollupOptions: {
      input: fileURLToPath(new URL('./src/content-script/content-script.ts', import.meta.url)),
      output: {
        format: 'iife',
        entryFileNames: 'content-script.js',
        inlineDynamicImports: true,
      },
    },
    // produce non-hashed assets so manifest references stay simple
    emptyOutDir: false,
  },
})
