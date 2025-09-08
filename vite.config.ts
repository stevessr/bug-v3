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
      // Ensure content script is emitted as a plain script without import/export
      // and avoid other bundles importing from the content chunk.
      {
        name: 'content-script-plain',
        generateBundle(_options, bundle) {
          for (const [fileName, chunk] of Object.entries(bundle)) {
            // chunk is a RollupOutputChunk
            // We want to target the content entry. Depending on rollup optimizations
            // the chunk may be named 'content', rendered to 'js/content.js', or
            // have a facadeModuleId pointing to the original entry file.
            // @ts-ignore
            const isChunk = chunk && chunk.type === 'chunk'
            // Try several heuristics to reliably detect the content chunk
            const looksLikeContent =
              isChunk &&
              // primary: chunk name set to 'content'
              (chunk.name === 'content' ||
                // common emitted filename: js/content.js
                fileName === 'js/content.js' ||
                // facadeModuleId references the original entry file
                // (normalize to posix style for safety)
                (!!(chunk as any).facadeModuleId &&
                  (function () {
                    const fid = String((chunk as any).facadeModuleId).replace(/\\\\/g, '/')
                    const lf = fid.toLowerCase()
                    // Accept several variants: exact content entry, any file under src/content,
                    // or paths that end with the expected filename. Use lowercase to be
                    // robust on Windows where drive letters / casing may vary.
                    return (
                      lf.includes('/src/content/content.ts') ||
                      lf.includes('/src/content/') ||
                      lf.endsWith('/src/content/content.ts')
                    )
                  })()))

            if (looksLikeContent) {
              // @ts-ignore
              let code = chunk.code
              // Conservatively remove any remaining import/export statements
              // including cases where imports are minified to single-line or
              // separated by semicolons. Also strip dynamic import(...) calls.
              // Match import/export statements ending with semicolon or linebreak.
              code = code.replace(/(^|\n|\;)\s*(?:import|export)[^;\n]*;?/g, '\n')
              // Remove dynamic import(...) calls (allow spaces inside parens)
              code = code.replace(/\bimport\(\s*[^)]*\s*\)/g, '')
              // Remove TypeScript "as" type assertions (e.g., "variable as Type")
              // This handles patterns like "element as HTMLElement", "(window as any)", etc.
              code = code.replace(/\s+as\s+[A-Za-z_$][A-Za-z0-9_$<>|&\[\].]*/g, '')
              // Wrap in IIFE so it becomes a plain script
              code = `(function(){\n${code}\n})();\n`
              // @ts-ignore
              chunk.code = code
            }
          }
        }
      },
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

            // Decide whether module is reachable from content and whether it's
            // also reachable from other non-content entrypoints. If it's shared,
            // don't place it into the content chunk to avoid other bundles
            // importing from content.
            const isReachableFromContent = isImportedByContent(id)
            if (isReachableFromContent) {
              // Check if it's also reachable from any other top-level entries
              const otherEntryHints = [
                'src/background/',
                'popup.html',
                'options.html',
                'src/tenor/',
                'src/waline/'
              ]
              const isShared = (() => {
                try {
                  const visited = new Set()
                  const stack = [id]
                  while (stack.length) {
                    const cur = stack.pop()
                    if (!cur) continue
                    const ncur = normalize(cur)
                    if (visited.has(ncur)) continue
                    visited.add(ncur)
                    if (ncur === normContent || ncur.includes('/src/content/')) {
                      // reachable from content; continue
                    }
                    // If any importer is under otherEntryHints, mark shared
                    const info = getModuleInfo(cur)
                    if (!info) continue
                    const importers = info.importers || []
                    for (const imp of importers) {
                      const nimp = normalize(imp)
                      for (const hint of otherEntryHints) {
                        if (nimp.includes(hint)) return true
                      }
                      stack.push(imp)
                    }
                  }
                } catch (e) {
                  return true
                }
                return false
              })()

              if (!isShared) return 'content'
            }

            // Keep background modules together (if they are not pulled into content)
            if (id.includes('src/background/') || id.includes('background.ts')) {
              return 'background'
            }

            // Put third-party deps not reachable from content into vendor
            if (id.includes('node_modules')) {
              return 'vendor'
            }

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
