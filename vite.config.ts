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
      __ENABLE_LOGGING__: enableLogging
    },
    plugins: [
      // default emoji groups are now loaded at runtime from public assets
      vue(),
      Components({
        resolvers: [AntDesignVueResolver({ importStyle: 'less' })]
      }),
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
      sourcemap: process.env.BUILD_SOURCEMAP === 'true',
      manifest: process.env.BUILD_MANIFEST === 'true',
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
          // tenor and waline are no longer separate JS entry points; they are used
          // as components inside the Options page instead. Keep static HTML files
          // in the output via the emit-static-html plugin above.
          content: fileURLToPath(new URL('src/content/content.ts', import.meta.url)),
          background: fileURLToPath(new URL('src/background/background.ts', import.meta.url))
        },
        output: {
          entryFileNames: chunkInfo => {
            return 'js/[name].js'
          },
          chunkFileNames: 'js/[name].js',
          assetFileNames: 'assets/[name].[ext]',
          inlineDynamicImports: true,
          manualChunks: (id, { getModuleInfo }) => {
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
