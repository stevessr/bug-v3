import { fileURLToPath, URL } from 'url'

import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import Components from 'unplugin-vue-components/vite'
import AutoImport from 'unplugin-auto-import/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'

type AntdImportTransformRule = {
  importKind: 'default' | 'named'
  path: string
  namedImport?: string
  includeStyle?: boolean
}

const ANTD_IMPORT_TRANSFORM_MAP: Record<string, AntdImportTransformRule> = {
  Badge: { importKind: 'default', path: 'badge' },
  Button: { importKind: 'default', path: 'button' },
  Checkbox: { importKind: 'default', path: 'checkbox' },
  ConfigProvider: { importKind: 'default', path: 'config-provider' },
  Dropdown: { importKind: 'default', path: 'dropdown' },
  Image: { importKind: 'default', path: 'image' },
  Input: { importKind: 'default', path: 'input' },
  Menu: { importKind: 'default', path: 'menu' },
  MenuItem: { importKind: 'named', path: 'menu', namedImport: 'MenuItem' },
  Modal: { importKind: 'default', path: 'modal' },
  Popconfirm: { importKind: 'default', path: 'popconfirm' },
  Progress: { importKind: 'default', path: 'progress' },
  Radio: { importKind: 'default', path: 'radio' },
  Select: { importKind: 'default', path: 'select' },
  Spin: { importKind: 'default', path: 'spin' },
  Switch: { importKind: 'default', path: 'switch' },
  Tooltip: { importKind: 'default', path: 'tooltip' },
  TreeSelect: { importKind: 'default', path: 'tree-select' },
  message: { importKind: 'default', path: 'message' }
}

const ANTD_NAMED_IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*['"]ant-design-vue['"]\s*;?/g
const SUPPORTED_TRANSFORM_FILE_RE = /\.(vue|[cm]?[jt]sx?)(\?.*)?$/
const KATEX_FALLBACK_FONT_RE = /^assets\/KaTeX_.*\.(woff|ttf)$/

type ParsedNamedImport = {
  imported: string
  local: string
  raw: string
}

function parseNamedImports(rawImports: string): ParsedNamedImport[] {
  return rawImports
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const match = item.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/)
      if (!match) {
        return null
      }

      const [, imported, local] = match
      return {
        imported,
        local: local ?? imported,
        raw: item
      }
    })
    .filter((item): item is ParsedNamedImport => item !== null)
}

function createAntDesignVueOnDemandPlugin(): Plugin {
  return {
    name: 'ant-design-vue-on-demand-import',
    enforce: 'pre',
    transform(code, id) {
      if (!SUPPORTED_TRANSFORM_FILE_RE.test(id) || id.includes('/node_modules/')) {
        return null
      }

      if (!code.includes('ant-design-vue')) {
        return null
      }

      let hasChanged = false

      const transformed = code.replace(ANTD_NAMED_IMPORT_RE, (_fullMatch, importBlock) => {
        const parsedImports = parseNamedImports(importBlock)
        if (parsedImports.length === 0) {
          return _fullMatch
        }

        const transformedImports: string[] = []
        const styleImports = new Set<string>()
        const fallbackImports: string[] = []

        for (const specifier of parsedImports) {
          const rule = ANTD_IMPORT_TRANSFORM_MAP[specifier.imported]
          if (!rule) {
            fallbackImports.push(specifier.raw)
            continue
          }

          const modulePath = `ant-design-vue/es/${rule.path}`

          if (rule.importKind === 'default') {
            transformedImports.push(`import ${specifier.local} from '${modulePath}';`)
          } else {
            const namedImport = rule.namedImport ?? specifier.imported
            transformedImports.push(
              specifier.local === namedImport
                ? `import { ${namedImport} } from '${modulePath}';`
                : `import { ${namedImport} as ${specifier.local} } from '${modulePath}';`
            )
          }

          if (rule.includeStyle !== false) {
            styleImports.add(`import 'ant-design-vue/es/${rule.path}/style';`)
          }
        }

        if (fallbackImports.length > 0) {
          transformedImports.push(`import { ${fallbackImports.join(', ')} } from 'ant-design-vue';`)
        }

        if (transformedImports.length === 0) {
          return _fullMatch
        }

        hasChanged = true

        return `${transformedImports.join('\n')}\n${Array.from(styleImports).join('\n')}`
      })

      if (!hasChanged) {
        return null
      }

      return {
        code: transformed,
        map: null
      }
    }
  }
}

function createPruneKatexFallbackFontsPlugin(): Plugin {
  return {
    name: 'prune-katex-fallback-fonts',
    apply: 'build',
    generateBundle(_, bundle) {
      for (const fileName of Object.keys(bundle)) {
        if (KATEX_FALLBACK_FONT_RE.test(fileName)) {
          delete bundle[fileName]
        }
      }
    }
  }
}

export default defineConfig(({ mode }) => {
  // 根据构建模式设置编译期标志
  const isDev = mode === 'development'
  const isProd = mode === 'production'
  const isFastBuild = process.env.BUILD_FAST === 'true'
  const minifier = process.env.BUILD_MINIFIER === 'terser' ? 'terser' : 'esbuild'
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
      createAntDesignVueOnDemandPlugin(),
      createPruneKatexFallbackFontsPlugin(),
      vue({
        // 优化：启用 Vue 的响应式转换优化
        script: {
          defineModel: true,
          propsDestructure: true
        }
      }),
      vueJsx(),
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
        dts: isFastBuild ? false : 'src/auto-imports.d.ts',
        dirs: ['src/composables', 'src/utils'],
        vueTemplate: true
      }),
      Components({
        dts: isFastBuild ? false : 'src/components.d.ts',
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
      sourcemap: !isFastBuild && process.env.BUILD_SOURCEMAP === 'true',
      manifest: !isFastBuild && process.env.BUILD_MANIFEST === 'true',
      minify: isFastBuild ? false : process.env.BUILD_MINIFIED === 'false' ? false : minifier,
      reportCompressedSize: false, // Skip gzip/brotli size calculation for faster builds
      chunkSizeWarningLimit: 1000, // Increase limit to 1000 kB since this is a feature-rich extension
      // 优化：目标现代浏览器
      target: 'esnext',
      // 优化：启用 CSS 代码分割
      cssCodeSplit: !isFastBuild,
      cssMinify: isFastBuild ? false : 'esbuild',
      emptyOutDir: !isFastBuild,
      terserOptions:
        process.env.BUILD_MINIFIED === 'false' || minifier !== 'terser'
          ? undefined
          : {
              ecma: 2020,
              module: true,
              toplevel: true,
              compress: {
                ecma: 2020,
                // 生产环境移除所有 console（除了 console.error）
                drop_console: isProd,
                drop_debugger: true, // 始终移除 debugger
                passes: 4, // 更激进的压缩
                // 显式移除日志函数
                pure_funcs: isProd
                  ? ['console.log', 'console.info', 'console.debug', 'console.warn']
                  : [],
                dead_code: true,
                unused: true,
                pure_getters: true,
                hoist_funs: true,
                unsafe_arrows: true,
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
                safari10: true,
                toplevel: true
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
          manualChunks: isFastBuild
            ? undefined
            : id => {
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
        treeshake: isFastBuild
          ? false
          : {
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
