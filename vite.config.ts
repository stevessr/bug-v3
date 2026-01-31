import { fileURLToPath, URL } from 'url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import AutoImport from 'unplugin-auto-import/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig(({ mode }) => {
  // 根据构建模式设置编译期标志
  const isDev = mode === 'development'
  const isProd = mode === 'production'
  // 生产环境强制禁用日志，开发环境默认启用（除非明确禁用）
  const enableLogging = isDev && process.env.ENABLE_LOGGING !== 'false'

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
      AutoImport({
        imports: [
          'vue',
          'vue-router',
          'pinia',
          {
            from: 'ant-design-vue',
            imports: ['message']
          },
          {
            from: './src/stores/index',
            imports: [
              'useGroupStore',
              'useEmojiCrudStore',
              'useFavoritesStore',
              'useCssStore',
              'useEmojiStore',
              'useSyncStore',
              'useTagStore'
            ]
          }
        ],
        resolvers: [
          // Auto import icons from @ant-design/icons-vue
          name => {
            if (name.match(/^[A-Z][a-z]+([A-Z][a-z]+)*(Outlined|Filled|TwoTone)$/)) {
              return {
                name,
                from: '@ant-design/icons-vue'
              }
            }
          }
        ],
        dts: 'src/auto-imports.d.ts',
        dirs: ['src/composables', 'src/utils'],
        vueTemplate: true
      }),
      Components({
        dts: 'src/components.d.ts',
        resolvers: [
          AntDesignVueResolver({
            importStyle: 'less',
            resolveIcons: true
          })
        ]
      })
    ],
    // 优化：预构建依赖
    optimizeDeps: {
      include: ['vue', 'pinia', 'ant-design-vue', '@ant-design/icons-vue'],
      // 排除不需要预构建的模块
      exclude: ['@jsquash/avif', '@jsquash/jpeg', '@jsquash/oxipng', '@jsquash/webp']
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
                // 生产环境移除所有 console（除了 console.error）
                drop_console: isProd,
                drop_debugger: true, // 始终移除 debugger
                passes: 3, // 更激进的压缩
                // 显式移除日志函数
                pure_funcs: isProd
                  ? ['console.log', 'console.info', 'console.debug', 'console.warn']
                  : [],
                dead_code: true,
                unused: true,
                // 额外的生产环境优化
                ...(isProd && {
                  arrows: true, // 转换箭头函数
                  booleans: true, // 优化布尔值
                  collapse_vars: true, // 内联变量
                  comparisons: true, // 优化比较操作
                  conditionals: true, // 优化条件语句
                  evaluate: true, // 求值常量表达式
                  join_vars: true, // 合并变量声明
                  loops: true, // 优化循环
                  reduce_vars: true, // 变量优化
                  sequences: true // 合并语句序列
                })
              },
              format: {
                comments: false // 移除所有注释
              },
              mangle: {
                safari10: true
              }
            },
      rollupOptions: {
        input: {
          index: fileURLToPath(new URL('index.html', import.meta.url)),
          discourse: fileURLToPath(new URL('discourse.html', import.meta.url)),
          content: fileURLToPath(new URL('src/content/content.ts', import.meta.url)),
          background: fileURLToPath(new URL('src/background/background.ts', import.meta.url))
        },
        output: {
          entryFileNames: 'js/[name].js',
          chunkFileNames: 'js/[name].js',
          assetFileNames: 'assets/[name].[ext]',
          format: 'es', // Use ES module format for better code splitting support
          inlineDynamicImports: false,
          manualChunks(id) {
            if (id.includes('node_modules')) {
              // UI 库单独打包，避免 content script 加载不需要的 UI 代码
              if (id.includes('ant-design-vue') || id.includes('@ant-design')) {
                return 'vendor-ui'
              }
              // 核心框架单独打包
              if (
                id.includes('vue') ||
                id.includes('pinia') ||
                id.includes('vue-router') ||
                id.includes('@vueuse')
              ) {
                return 'vendor-core'
              }
              // 其他第三方依赖
              return 'vendor-libs'
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
