import { fileURLToPath, URL } from 'url'

import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path'
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
          // content entry now uses the autodetect loader which decides whether to initialize
          content: fileURLToPath(new URL('src/content/content-autodetect.ts', import.meta.url)),
          // bridge helper that will be injected into pages (isolated world)
          'content-bridge': fileURLToPath(new URL('src/content/injectedBridge.ts', import.meta.url)),

          // Per-site content scripts (legacy wrappers)
          discourse: fileURLToPath(new URL('src/content/content-discourse.ts', import.meta.url)),
          bilibili: fileURLToPath(new URL('src/content/content-bilibili.ts', import.meta.url)),
          x: fileURLToPath(new URL('src/content/content-x.ts', import.meta.url)),
          pixiv: fileURLToPath(new URL('src/content/content-pixiv.ts', import.meta.url)),

          // Per-site content scripts - injected by background as needed
          'discourse-content': fileURLToPath(new URL('src/content/discourse/discourse.ts', import.meta.url)),
          'bilibili-content': fileURLToPath(new URL('src/content/bilibili/bilibili.ts', import.meta.url)),
          'x-content': fileURLToPath(new URL('src/content/x/main.ts', import.meta.url)),
          'pixiv-content': fileURLToPath(new URL('src/content/pixiv/pixiv.ts', import.meta.url)),
          background: fileURLToPath(new URL('src/background/background.ts', import.meta.url))
        },
        output: {
          entryFileNames: chunkInfo => {
            const name = String(chunkInfo.name)
            // Handle the options entry point
            if (name === 'options') {
              return 'js/options/options.js'
            }
            // Emit content-related entries to js/content/<site>.js and remove 'content' suffix
            if (name === 'content') return 'js/content/autodetect.js'
            if (name === 'content-bridge') return 'js/content/bridge.js'
            if (name.endsWith('-content')) {
              const base = name.replace(/-content$/, '')
              return `js/content/${base}.js`
            }
            return 'js/[name].js'
          },
          chunkFileNames: (chunkInfo) => {
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
          // Disable manualChunks splitting to avoid creating a shared "background.js"
          // chunk that other entrypoints (like content) would import from. Keeping
          // modules inlined per-entry ensures content scripts do not contain
          // top-level ESM imports which cause runtime SyntaxError in some hosts.
          manualChunks: (id, { getModuleInfo }) => {
            // Resolve the canonical content entry path
            const contentEntry = fileURLToPath(new URL('src/content/content.ts', import.meta.url))

            // Normalize an id for comparisons: strip query/hash, normalize slashes, lowercase
            const normalize = (raw?: string) => {
              if (!raw) return ''
              let s = raw.split('?')[0].split('#')[0]
              s = s.replace(/\\/g, '/')
              return s.toLowerCase()
            }

            const normContent = normalize(contentEntry)

            // Reverse-traverse importers: starting from `id`, walk up via importers to see
            // if content entry (or anything under src/content) imports it (transitively).
            const isImportedByContent = target => {
              try {
                const start = normalize(target)
                if (!start) return false
                const visited = new Set()
                const stack = [target] // Corrected from [stack.pop()]
                while (stack.length) {
                  const cur = stack.pop()
                  if (!cur) continue
                  const ncur = normalize(cur)
                  if (visited.has(ncur)) continue
                  visited.add(ncur)
                  // If importer is exactly the content entry, or under src/content, it's reachable
                  if (ncur === normContent || ncur.includes('/src/content/')) return true
                  const info = getModuleInfo(cur)
                  if (!info) continue
                  const importers = info.importers || []
                  for (const imp of importers) {
                    stack.push(imp)
                  }
                }
              } catch (e) {
                return false
              }
              return false
            }

            // Previously we had complex heuristics here to split shared
            // modules, but that produced a separate background chunk which
            // content.js then imported via ESM. For extension content
            // scripts we must avoid producing top-level imports between
            // extension files. Returning undefined disables manual chunking
            // and lets Rollup inline modules per-entry.
            return undefined
          }
        },
        external: id => {
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
