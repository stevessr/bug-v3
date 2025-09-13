import { fileURLToPath, URL } from 'url'

import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development'
  // Allow overriding minification behavior via ENABLE_MINIFIED env var (matches project naming style).
  // When ENABLE_MINIFIED is explicitly set to 'true', we enable dropping console/debugger.
  const enableMinifiedEnv = process.env.ENABLE_MINIFIED
  const buildMinified =
    typeof enableMinifiedEnv === 'string' ? enableMinifiedEnv === 'true' : !isDev

  const minifyOption: 'terser' | false = buildMinified ? 'terser' : false

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
      // Allow disabling minification for debug builds via ENABLE_MINIFIED env var
      minify: minifyOption,
      terserOptions: buildMinified
        ? {
            compress: {
              drop_console: buildMinified,
              drop_debugger: buildMinified
            }
          }
        : undefined,
      rollupOptions: {
        input: {
          popup: fileURLToPath(new URL('popup.html', import.meta.url)),
          options: fileURLToPath(new URL('options.html', import.meta.url)),
          // Implementation bundles for site integrations so they can be injected
          // independently into page tabs (expose init functions on window).
          'pixiv-impl': fileURLToPath(new URL('src/content/pixiv/index.ts', import.meta.url)),
          'bilibili-impl': fileURLToPath(new URL('src/content/bilibili/bilibili.ts', import.meta.url)),
          tenor: fileURLToPath(new URL('src/tenor/main.ts', import.meta.url)),
          waline: fileURLToPath(new URL('src/waline/main.ts', import.meta.url)),
          // content entry now uses the autodetect loader which decides whether to initialize
          content: fileURLToPath(new URL('src/content/content-autodetect.ts', import.meta.url)),
          // bridge helper that will be injected into pages (isolated world)
          'content-bridge': fileURLToPath(
            new URL('src/content/injectedBridge.ts', import.meta.url)
          ),
          // Per-site content scripts - injected by background as needed
          'discourse-content': fileURLToPath(
            new URL('src/content/content-discourse.ts', import.meta.url)
          ),
          'bilibili-content': fileURLToPath(
            new URL('src/content/content-bilibili.ts', import.meta.url)
          ),
          'x-content': fileURLToPath(new URL('src/content/content-x.ts', import.meta.url)),
          'pixiv-content': fileURLToPath(new URL('src/content/content-pixiv.ts', import.meta.url)),
          background: fileURLToPath(new URL('src/background/background.ts', import.meta.url))
        },
        output: {
          entryFileNames: chunkInfo => {
            // Emit content-related entries to js/content/<site>.js and remove 'content' suffix
            let name = String(chunkInfo.name)
            // Sanitize Vue SFC virtual-module suffixes like
            // _vue_vue_type_script_setup_true_lang and similar to keep filenames shorter.
            name = name.replace(/_vue_vue_type_[^_]+(?:_[^_]+)*_lang/g, '_vuepart')
            name = name.replace(/_vue_vue_type_style_[^_]+_lang/g, '_styles')

            if (name === 'content') return 'js/content/autodetect.js'
            if (name === 'content-bridge') return 'js/content/bridge.js'
            if (name.endsWith('-content')) {
              const base = name.replace(/-content$/, '')
              return `js/content/${base}.js`
            }
            // Route the options entry to js/options
            if (name === 'options') return 'js/options/options.js'
            return `js/${name}.js`
          },
          chunkFileNames: chunkInfo => {
            // Default chunk name
            let name = String(chunkInfo.name || '')

            // Sanitize Vue SFC virtual-module suffixes to shorten names
            name = name.replace(/_vue_vue_type_[^_]+(?:_[^_]+)*_lang/g, '_vuepart')
            name = name.replace(/_vue_vue_type_style_[^_]+_lang/g, '_styles')

            // If this chunk originates from the options entry (heuristic: name includes 'options' or module ids)
            // Put it under js/options to keep options-related code isolated.
            if (name.includes('options') || name.startsWith('options-')) {
              return `js/options/${name}.js`
            }

            return `js/${name}.js`
          },
          assetFileNames: 'assets/[name].[ext]',
          // Manual chunking: keep content-related behavior unchanged, but place
          // modules under `src/options` into their own chunks. This makes the
          // options page lazy-load split into multiple small JS files.
          // Avoid forcing third-party libs into a single shared chunk so that
          // site-specific impls remain independent.
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
            const isImportedByContent = (target: string | undefined) => {
              try {
                const start = normalize(target)
                if (!start) return false
                const visited = new Set()
                const stack = [target]
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

            try {
              if (!id) return undefined
              // normalize path separators
              const normalized = id.replace(/\\/g, '/').toLowerCase()


              // Keep content-related modules untouched
              if (normalized.includes('/src/content/')) return undefined

              // If module comes from src/options, create a chunk per-file
              const marker = '/src/options/'
              const idx = normalized.indexOf(marker)
              if (idx !== -1) {
                const rel = normalized.slice(idx + marker.length)
                // use last segment name as chunk key (without extension)
                const m = rel.match(/([^/]+?)(?:\.[a-z0-9]+)?$/)
                const base = m && m[1] ? m[1].replace(/[^a-z0-9_-]/g, '_') : rel.replace(/[^a-z0-9_-]/g, '_')
                return `options-${base}`
              }
            } catch (e) {
              void e
            }
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
