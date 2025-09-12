import { fileURLToPath, URL } from 'url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development'
  const enableLogging = process.env.ENABLE_LOGGING === 'true'
  const buildMinified = process.env.BUILD_MINIFIED !== 'false'

  return {
    css: {
      postcss: './postcss.config.js'
    },
    // resolve alias so imports using @/xxx map to src/xxx
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    plugins: [
      // bilibili_emoji_index.json is handled by the build script; default groups
      // are loaded at runtime from public assets. Register Vue and UI components.
      vue(),
      Components({
        resolvers: [AntDesignVueResolver({ importStyle: 'less' })]
      })
    ],
    build: {
      minify: buildMinified ? 'terser' : false,
      terserOptions: {
        compress: {
          drop_console: !enableLogging,
          drop_debugger: !isDev
        }
      },
      rollupOptions: {
        input: {
          popup: fileURLToPath(new URL('popup.html', import.meta.url)),
          options: fileURLToPath(new URL('options.html', import.meta.url)),
          tenor: fileURLToPath(new URL('src/tenor/main.ts', import.meta.url)),
          waline: fileURLToPath(new URL('src/waline/main.ts', import.meta.url)),
          // Autonomous content scripts - self-contained with no external dependencies
          'content-autodetect': fileURLToPath(
            new URL('src/content/autodetect-autonomous.ts', import.meta.url)
          ),
          'content-bridge': fileURLToPath(
            new URL('src/content/injectedBridge.ts', import.meta.url)
          ),
          'content-bilibili': fileURLToPath(
            new URL('src/content/bilibili-autonomous.ts', import.meta.url)
          ),
          'content-discourse': fileURLToPath(
            new URL('src/content/discourse-autonomous.ts', import.meta.url)
          ),
          'content-x': fileURLToPath(new URL('src/content/x-autonomous.ts', import.meta.url)),
          'content-pixiv': fileURLToPath(
            new URL('src/content/pixiv-autonomous.ts', import.meta.url)
          ),
          background: fileURLToPath(new URL('src/background/background.ts', import.meta.url)),
          // Autonomous image-inject script for generic image direct-link pages (already autonomous)
          'content/images/image-inject': fileURLToPath(
            new URL('src/content/images/image-inject.ts', import.meta.url)
          )
        },
        output: {
          entryFileNames: chunkInfo => {
            const name = String(chunkInfo.name)
            // Handle the options entry point
            if (name === 'options') {
              return 'js/options/options.js'
            }
            // Emit autonomous content scripts to js/content/ with clean names
            if (name === 'content-autodetect') return 'js/content/autodetect.js'
            if (name === 'content-bridge') return 'js/content/bridge.js'
            if (name === 'content-bilibili') return 'js/content/bilibili.js'
            if (name === 'content-discourse') return 'js/content/discourse.js'
            if (name === 'content-x') return 'js/content/x.js'
            if (name === 'content-pixiv') return 'js/content/pixiv.js'
            return 'js/[name].js'
          },
          format: 'es', // Keep ES modules for most scripts
          chunkFileNames: chunkInfo => {
            // List of components that are logically part of the options page
            // but are located in the shared /src/components directory.
            const optionsSpecificSharedComponents = ['AboutSection']

            const facadeModuleId = chunkInfo.facadeModuleId || ''

            if (
              facadeModuleId.includes('/src/options/') ||
              optionsSpecificSharedComponents.includes(chunkInfo.name)
            ) {
              return 'js/options/[name].js'
            }

            return 'js/[name].js'
          },
          assetFileNames: 'assets/[name].[ext]',
          // Disable manualChunks splitting to ensure autonomous content scripts
          // remain self-contained with no external dependencies. Each content
          // script inlines all required utilities and functions.
          manualChunks: undefined
        },
        external: (id: any) => {
          // 排除 default.json 文件，防止被打包
          if (id.includes('src/config/default.json')) {
            return true
          }
          return false // Don't externalize anything else
        }
      }
    }
  }
})
