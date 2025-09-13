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
      // 禁用 AntDesignVueResolver，只依赖手动按需导入
      Components({
        // resolvers: [] // 移除自动导入解析器，让项目完全依赖手动按需导入
        dts: false // 禁用类型定义文件生成
      })
    ],
    build: {
      target: 'esnext', // Chrome extensions run in modern Chrome, no need for compatibility
      // Allow disabling minification for debug builds via BUILD_MINIFIED env var
      minify: process.env.BUILD_MINIFIED === 'false' ? false : 'terser',
      // 禁用模块预加载polyfill，减少兼容性代码
      modulePreload: false,
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
          chunkFileNames: chunkInfo => {
            // Organize chunks by their entry point
            const facadeModuleId = chunkInfo.facadeModuleId
            if (facadeModuleId) {
              // Check if this chunk is related to options
              if (
                facadeModuleId.includes('/src/options/') ||
                facadeModuleId.includes('options.html') ||
                (chunkInfo.name && chunkInfo.name.includes('options'))
              ) {
                return 'js/options/[name].js'
              }
              // Check if this chunk is related to popup
              if (
                facadeModuleId.includes('/src/popup/') ||
                facadeModuleId.includes('popup.html') ||
                (chunkInfo.name && chunkInfo.name.includes('popup'))
              ) {
                return 'js/popup/[name].js'
              }
            }

            // Check chunk name patterns for lazy-loaded components
            if (chunkInfo.name) {
              // Options-specific chunks (from webpackChunkName comments)
              if (
                chunkInfo.name.includes('emoji-tabs') ||
                chunkInfo.name.includes('import-modals') ||
                chunkInfo.name.includes('edit-modals') ||
                chunkInfo.name.includes('create-modals') ||
                chunkInfo.name.includes('import-tabs')
              ) {
                return 'js/options/[name].js'
              }
            }

            return 'js/[name].js'
          },
          assetFileNames: 'assets/[name].[ext]',
          // For Chrome extensions, we want to minimize the number of chunk files
          // while keeping reasonable file sizes. Chrome extensions don't benefit from
          // aggressive code splitting like web apps do.
          manualChunks: (id, { getModuleInfo }) => {
            // Special handling for default configuration - keep as separate chunk for caching
            if (
              id.includes('/src/utils/defaultConfig') ||
              id.includes('/types/defaultEmojiGroups')
            ) {
              return 'defaultConfig'
            }

            // 将所有 node_modules 依赖合并到一个vendor chunk中
            // 这样可以避免Vite生成多个es*.js文件
            if (id.includes('node_modules/')) {
              return 'vendor'
            }

            // For all other modules, return undefined to inline them
            return undefined
          }
        },
        external: id => {
          // 排除 Ant Design Vue 的图标库，因为项目可能不需要所有图标
          if (id.includes('@ant-design/icons') || id.includes('ant-design-vue/es/icon')) {
            return true
          }
          return false // Don't externalize anything else
        },
        // 优化 ES 模块输出
        experimentalMinChunkSize: 1000, // 最小 chunk 大小，避免过多小文件
        treeshake: {
          // 启用更激进的 tree shaking
          moduleSideEffects: false,
          propertyReadSideEffects: false,
          tryCatchDeoptimization: false
        }
      }
    }
  }
})
