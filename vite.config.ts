import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    vueDevTools(),
    Components({
      dirs: ['src/options/tabs', 'src/options/components'],
      extensions: ['vue'],
      deep: true,
      resolvers: [AntDesignVueResolver({ importStyle: false })],
      dts: false,
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        options: fileURLToPath(new URL('./options.html', import.meta.url)),
        popup: fileURLToPath(new URL('./popup.html', import.meta.url)),
        // build background entry so it outputs dist/background.js
        background: fileURLToPath(new URL('./src/background/index.ts', import.meta.url)),
        // build content-script entry so it outputs dist/content-script.js
        'content-script': fileURLToPath(
          new URL('./src/content-script/content-script.ts', import.meta.url),
        ),
      },
      output: {
        // Ensure background entry is emitted as dist/background.js so manifest can reference it
        // while keeping other bundles hashed under assets/.
        entryFileNames: (chunkInfo: any) => {
          if (chunkInfo && chunkInfo.name === 'background') return 'background.js'
          if (chunkInfo && chunkInfo.name === 'content-script') return 'content-script.js'
          return 'assets/[name]-[hash].js'
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        // rolldown (vite aliased) expects manualChunks to be a function
        manualChunks(id) {
          if (typeof id === 'string' && id.includes('monaco-editor')) return 'monaco-editor'
          return undefined
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    include: [
      'monaco-editor',
      'monaco-editor/esm/vs/editor/editor.worker',
      'monaco-editor/esm/vs/language/json/json.worker',
      'monaco-editor/esm/vs/language/typescript/ts.worker',
    ],
  },
})
