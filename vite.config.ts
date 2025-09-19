import { fileURLToPath, URL } from 'url'

import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'

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
  // default emoji groups are now loaded at runtime from public assets
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

              // Additionally: inline any other emitted chunks that are content-related
              // (for example `js/content2.js`) into the main `js/content.js` file.
              // This avoids leaving a small facade that imports a separate chunk,
              // which can cause runtime ESM import issues in content scripts.
              try {
                for (const [otherName, otherChunk] of Object.entries(bundle)) {
                  if (otherName === fileName) continue
                  if (typeof otherName !== 'string') continue
                  // target only other JS chunks that start with the content prefix
                  if (!otherName.startsWith('js/content')) continue
                  // Ensure this is a chunk with code
                  // @ts-ignore
                  if (!otherChunk || otherChunk.type !== 'chunk' || !otherChunk.code) continue

                  // Prepend the other chunk's code into the main content chunk.
                  // If the main chunk only contained an import to this other chunk
                  // (common facade behavior), replacing with the other's code yields
                  // a single self-contained file.
                  // Remove imports that reference this other chunk (e.g. import "./content2.js";
                  // or import x from './content2.js') — handle variants without spaces too.
                  const otherBase = (otherName.split('/').pop && otherName.split('/').pop()) || otherName
                  const importRegex = new RegExp(`import\\s*(?:['"]\\.\\/${otherBase}['"]|(?:.+?\\s+from\\s+['"]\\.\\/${otherBase}['"]))\\;?\\s*`, 'g')
                  // @ts-ignore
                  chunk.code = String(otherChunk.code) + '\n' + String(chunk.code).replace(importRegex, '')

                  // Remove the separate chunk from the bundle so it isn't emitted.
                  delete bundle[otherName]
                }
              } catch (e) {
                // don't let inlining failures break the build
                console.warn('[strip-content-exports] failed to inline secondary content chunks', e)
              }
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
      ,
      // Copy static HTML pages (tenor.html, waline.html) to the output dir
      {
        name: 'emit-static-html',
        writeBundle(options, bundle) {
          try {
            const outDir = (options && options.dir) || 'dist'
            const files = ['tenor.html', 'waline.html']
            for (const f of files) {
              const src = path.resolve(process.cwd(), f)
              const dest = path.resolve(process.cwd(), outDir, path.basename(f))
              if (fs.existsSync(src)) {
                fs.copyFileSync(src, dest)
              }
            }
          } catch (e) {
            // don't fail the build for this non-critical copy
            console.warn('[emit-static-html] copy failed', e)
          }
        }
      }
    ],
    build: {
      // Enable generating sourcemaps when BUILD_SOURCEMAP is set to 'true'.
      // We keep this off by default to avoid shipping .map files unintentionally.
      sourcemap: process.env.BUILD_SOURCEMAP === 'true',
      // Optionally emit a rollup manifest mapping chunks -> modules when
      // BUILD_MANIFEST=true. Useful for offline analysis without relying on
      // potentially incompatible source map consumers.
      manifest: process.env.BUILD_MANIFEST === 'true',
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
          // Tenor/waline entries are the source TS files; HTML pages will be
          // copied to `dist/` by the emit-static-html plugin so they can
          // reference the emitted /js/*.js bundles.
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
          // Inline dynamic imports into the same output file where possible
          inlineDynamicImports: true,
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
            const isImportedByContent = (target: string) => {
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

            // Previously we returned undefined to let Rollup decide, but that
            // still resulted in small shared chunks (e.g. createEl.js) that
            // ended up as separate files imported by the content script.
            // For the content bundle we want modules that are part of
            // `src/content` (or reachable only from the content entry) to
            // be emitted inside the `content` chunk to avoid creating a
            // standalone chunk that the content script would import at
            // runtime (some hosts disallow top-level ESM imports in content
            // scripts). Return the explicit chunk name 'content' in those
            // cases; otherwise leave chunking to Rollup.
            try {
              const nid = normalize(id)
              if (!nid) return undefined
              // If the module itself lives under src/content, group into content
              if (nid.includes('/src/content/')) return 'content'
              // If the module is reachable (transitively) from the content entry,
              // also group it into the content chunk so it is inlined there.
              if (isImportedByContent(id)) return 'content'
            } catch (e) {
              // ignore and fall through to default behavior
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
