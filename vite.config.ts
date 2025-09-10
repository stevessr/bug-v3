import { fileURLToPath, URL } from 'url'

import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'

import { generateDefaultEmojiGroupsPlugin } from './scripts/vite-plugin-generate-default-emoji-groups'

export default defineConfig(({ mode }) => {
  // 根据构建模式设置编译期标志
  const isDev = mode === 'development'
  const enableLogging = process.env.ENABLE_LOGGING === 'true' || isDev
  const enableIndexedDB = process.env.ENABLE_INDEXEDDB !== 'false' // 默认启用，除非明确禁用

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
    define: {
      // 编译期标志定义
      __ENABLE_LOGGING__: enableLogging,
      __ENABLE_INDEXEDDB__: enableIndexedDB
    },
    plugins: [
      // Serve /bilibili_emoji_index.json in dev and emit it as asset in build
      (function bilibiliIndexPlugin() {
        const srcPath = fileURLToPath(
          new URL('./src/config/bilibili_emoji_index.json', import.meta.url)
        )
        let assetId: string | null = null
        return {
          name: 'bilibili-index-asset',
          // no `apply` so plugin runs in both dev and build
          configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
              try {
                if (!req.url) return next()
                // Support query/hash variants
                const u = req.url.split('?')[0].split('#')[0]
                if (u === '/bilibili_emoji_index.json') {
                  try {
                    const content = await fs.promises.readFile(srcPath, 'utf-8')
                    res.setHeader('content-type', 'application/json; charset=utf-8')
                    res.statusCode = 200
                    res.end(content)
                    return
                  } catch (e) {
                    res.statusCode = 500
                    res.end(JSON.stringify({ error: 'failed to read index' }))
                    return
                  }
                }
              } catch (e) {
                // swallow
              }
              return next()
            })
          },
          buildStart() {
            try {
              const content = fs.readFileSync(srcPath, 'utf-8')
              assetId = this.emitFile({
                type: 'asset',
                fileName: 'bilibili_emoji_index.json',
                source: content
              })
              this.warn('bilibili index scheduled to be emitted as bibilili_emoji_index.json')
            } catch (e) {
              this.warn('Failed to read bilibili index at ' + srcPath + ': ' + e)
            }
          },
          generateBundle() {
            if (assetId) {
              const final = this.getFileName(assetId)
              this.warn('bilibili index emitted as ' + final)
            }
          }
        }
      })(),
      generateDefaultEmojiGroupsPlugin(),
      vue(),
      // Small safe plugin: remove trailing `export { ... }` that Rollup may append
      // to the content chunk. We only strip the final export block to avoid
      // aggressive regex edits elsewhere.
      {
        name: 'strip-content-exports',
        generateBundle(_options, bundle) {
          for (const [fileName, chunk] of Object.entries(bundle)) {
            // @ts-ignore
            const isChunk = chunk && chunk.type === 'chunk'
            if (!isChunk) continue
            // Heuristic: target the content entry chunk by filename or facadeModuleId
            const looksLikeContent =
              fileName === 'js/content.js' ||
              (!!(chunk as any).facadeModuleId &&
                String((chunk as any).facadeModuleId)
                  .replace(/\\/g, '/')
                  .toLowerCase()
                  .includes('/src/content/'))

            if (looksLikeContent) {
              // @ts-ignore
              let code = chunk.code
              // Remove a trailing export block like: export { logger as l };
              code = code.replace(/export\s*\{[\s\S]*?\};?\s*$/m, '')
              // Ensure file ends cleanly (keep existing IIFE if present)
              chunk.code = code
            }
          }
        }
      },
      // Ensure content script is emitted as a plain script without import/export
      // and avoid other bundles importing from the content chunk.
      // NOTE: content-script-plain plugin removed. Handling content chunk as a plain
      // script via regex proved fragile; prefer emitting a normal chunk and
      // handling any runtime compatibility in source. If we need to reintroduce
      // a transform for the content chunk, prefer an AST-based approach.
      // auto register components and import styles for ant-design-vue
      Components({
        resolvers: [AntDesignVueResolver({ importStyle: 'less' })]
      })
    ],
    build: {
      // Allow disabling minification for debug builds via BUILD_MINIFIED env var
      minify: process.env.BUILD_MINIFIED === 'false' ? false : 'terser',
      terserOptions:
        process.env.BUILD_MINIFIED === 'false'
          ? undefined
          : {
              compress: {
                drop_console: !enableLogging, // 根据日志开关决定是否移除 console
                drop_debugger: !isDev // 生产环境移除 debugger
              }
            },
      rollupOptions: {
        input: {
          popup: fileURLToPath(new URL('popup.html', import.meta.url)),
          options: fileURLToPath(new URL('options.html', import.meta.url)),
          tenor: fileURLToPath(new URL('src/tenor/main.ts', import.meta.url)),
          waline: fileURLToPath(new URL('src/waline/main.ts', import.meta.url)),
          content: fileURLToPath(new URL('src/content/content.ts', import.meta.url)),
          background: fileURLToPath(new URL('src/background/background.ts', import.meta.url))
        },
        output: {
          entryFileNames: chunkInfo => {
            return 'js/[name].js'
          },
          chunkFileNames: 'js/[name].js',
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
          return false // Don't externalize anything
        }
      }
    }
  }
})
