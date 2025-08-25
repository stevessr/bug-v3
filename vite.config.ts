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
        // content script bundle
        'content-script': fileURLToPath(
          new URL('./src/content-script/content-script.ts', import.meta.url),
        ),
        // build background entry so it outputs dist/background.js
        background: fileURLToPath(new URL('./src/background/index.ts', import.meta.url)),
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
