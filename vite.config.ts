import { fileURLToPath, URL } from 'url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig(({ mode }) => {
  // 根据构建模式设置编译期标志
  const isDev = mode === 'development'
  const enableLogging = process.env.ENABLE_LOGGING === 'true' || isDev

  return {
    css: {
      postcss: './postcss.config.js',
      // 优化：启用 CSS 代码分割
      devSourcemap: isDev
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
      vue({
        // 优化：启用 Vue 的响应式转换优化
        script: {
          defineModel: true,
          propsDestructure: true
        }
      }),
      Components({
        resolvers: [AntDesignVueResolver({ importStyle: 'less' })]
      })
    ],
    // 优化：预构建依赖
    optimizeDeps: {
      include: [
        'vue',
        'pinia',
        'ant-design-vue',
        '@ant-design/icons-vue'
      ],
      // 排除不需要预构建的模块
      exclude: []
    },
    build: {
      sourcemap: process.env.BUILD_SOURCEMAP === 'true',
      manifest: process.env.BUILD_MANIFEST === 'true',
      minify: process.env.BUILD_MINIFIED === 'false' ? false : 'terser',
      chunkSizeWarningLimit: 1000, // Increase limit to 1000 kB since this is a feature-rich extension
      // 优化：目标现代浏览器
      target: 'esnext',
      // 优化：启用 CSS 代码分割
      cssCodeSplit: true,
      terserOptions:
        process.env.BUILD_MINIFIED === 'false'
          ? undefined
          : {
              compress: {
                drop_console: !enableLogging, // 根据日志开关决定是否移除 console
                drop_debugger: !isDev, // 生产环境移除 debugger
                passes: 3, // More aggressive compression
                // 优化：更激进的压缩
                pure_funcs: !enableLogging ? ['console.log', 'console.info', 'console.debug'] : [],
                dead_code: true,
                unused: true
              },
              format: {
                comments: false // Remove all comments in production
              },
              // 优化：启用 mangle
              mangle: {
                safari10: true
              }
            },
      rollupOptions: {
        input: {
          index: fileURLToPath(new URL('index.html', import.meta.url)),
          content: fileURLToPath(new URL('src/content/content.ts', import.meta.url)),
          background: fileURLToPath(new URL('src/background/background.ts', import.meta.url))
        },
        output: {
          entryFileNames: chunkInfo => {
            return 'js/[name].js'
          },
          chunkFileNames: 'js/[name].js',
          assetFileNames: 'assets/[name].[ext]',
          inlineDynamicImports: false, // Disable inline dynamic imports for better chunking
          // 优化：启用 tree-shaking 友好的格式
          format: 'es',
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router')) {
                return 'vue-core'
              }
              if (id.includes('ant-design-vue')) {
                return 'antd'
              }
              if (id.includes('marked') || id.includes('dompurify')) {
                return 'utils'
              }
              if (id.includes('@ant-design/icons')) {
                return 'antd-icons'
              }
              // Default vendor chunk for other node_modules
              return 'vendor'
            }
            if (id.includes('src/stores')) {
              return 'emoji-store'
            }
            if (id.includes('src/content')) {
              return undefined
            }
            if (id.includes('src/background')) {
              return undefined
            }
            if (id.includes('src/popup')) {
              return 'popup'
            }
            // Split options page into more granular chunks
            if (id.includes('src/options')) {
              if (id.includes('tabs/')) {
                if (id.includes('tabs/Upload')) return 'options-upload'
                if (id.includes('tabs/Settings')) return 'options-settings'
                if (id.includes('tabs/ImportExport')) return 'options-import-export'
                return 'options-tabs'
              }
              if (id.includes('modals/')) {
                if (id.includes('modals/AddEmojiModal')) return 'options-modals-add-emoji'
                if (id.includes('modals/ImportEmojisModal')) return 'options-modals-import'
                return 'options-modals'
              }
              if (id.includes('pages/')) {
                return 'options-pages'
              }
              if (id.includes('components/')) {
                return 'options-components'
              }
              if (id.includes('router/')) {
                return 'options-router'
              }
              if (id.includes('utils/')) {
                return 'options-utils'
              }
              // Main options logic
              return 'options-main'
            }
          }
        },
        // 优化：tree-shaking 优化
        treeshake: {
          moduleSideEffects: 'no-external',
          propertyReadSideEffects: false
        },
        external: id => {
          return false // Don't externalize anything
        }
      }
    }
  }
})
