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
const ANTD_IMPORT_SOURCE_RE = /from\s*['"]ant-design-vue['"]/
const NAMED_IMPORT_PREFIX_RE = /import\s*\{/
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
    transform: {
      filter: {
        id: SUPPORTED_TRANSFORM_FILE_RE,
        code: 'ant-design-vue'
      },
      handler(code, id) {
        if (!SUPPORTED_TRANSFORM_FILE_RE.test(id) || id.includes('/node_modules/')) {
          return null
        }

        if (!code.includes('ant-design-vue')) {
          return null
        }

        if (!ANTD_IMPORT_SOURCE_RE.test(code) || !NAMED_IMPORT_PREFIX_RE.test(code)) {
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
            transformedImports.push(
              `import { ${fallbackImports.join(', ')} } from 'ant-design-vue';`
            )
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

// 拦截 @jsquash/avif 的多线程编码器入口（avif_enc_mt.js 及其 worker），
// 替换为一个最小 stub 模块。原始文件包含 `new Worker(new URL('./avif_enc_mt.worker.mjs', import.meta.url))`
// 与 `new URL('avif_enc_mt.wasm', import.meta.url)`，Vite 一旦扫描这两条
// 引用就会强制把 3.4MB 多线程 WASM、对应 worker 以及 hash 副本拷贝进 dist。
// 扩展 manifest 未启用 cross-origin isolation，threads() 在运行时必定 false，
// 因此整个 MT 分支是死代码。
//
// 这里走 resolveId hook 而不是 resolve.alias，是因为 vite:worker-import-meta-url
// 插件需要在原始 importer 的目录里查找 worker 路径，alias 改成绝对路径反而
// 让相对路径解析失败。返回一个虚拟模块 id 让后续 load 钩子提供 stub 代码。
function createAvifMtStubPlugin(): Plugin {
  const VIRTUAL_ID = '\0virtual:avif-enc-mt-stub'
  // 既要匹配 jsquash 内部的相对 import `./codec/enc/avif_enc_mt.js`，
  // 也要匹配 Vite 已解析过的绝对/规范化路径。简单匹配文件基名即可，
  // 因为 avif_enc_mt 是 jsquash 独有的命名。
  const AVIF_MT_BASENAME_RE = /(?:^|[\\/])avif_enc_mt(?:\.worker)?\.m?js(?:\?.*)?$/
  return {
    name: 'avif-enc-mt-stub',
    enforce: 'pre',
    resolveId(source) {
      // 廉价前置过滤：源字符串不含 `avif_enc_mt` 时立刻返回。
      // resolveId 会对每个模块触发，避免对几千个无关 id 跑正则。
      if (!source.includes('avif_enc_mt')) return null
      if (AVIF_MT_BASENAME_RE.test(source)) {
        return VIRTUAL_ID
      }
      return null
    },
    load(id) {
      if (id === VIRTUAL_ID) {
        return [
          '// jsquash AVIF multi-thread encoder is stubbed: extension is not COI.',
          'export default function avifEncMtStub() {',
          '  return Promise.reject(new Error("AVIF multi-thread encoder disabled (no COI)."))',
          '}'
        ].join('\n')
      }
      return null
    }
  }
}

export default defineConfig(({ mode }) => {
  // 根据构建模式设置编译期标志
  const isDev = mode === 'development'
  const isProd = mode === 'production'
  const isFastBuild = process.env.BUILD_FAST === 'true'
  const shouldMinify = !isFastBuild && process.env.BUILD_MINIFIED !== 'false'
  const minifier = shouldMinify
    ? process.env.BUILD_MINIFIER === 'terser'
      ? 'terser'
      : true // Vite 8 default: Oxc
    : false
  const cssMinifier = shouldMinify
    ? true // Vite 8 default: lightningcss
    : false
  const enableForumBrowser = process.env.ENABLE_FORUM_BROWSER !== 'false'
  const enableLocalMcpBridge = process.env.ENABLE_LOCAL_MCP_BRIDGE !== 'false'
  // 生产环境强制禁用日志，开发环境默认启用（除非明确禁用）
  const enableLogging = isDev && process.env.ENABLE_LOGGING !== 'false'

  const buildInputs: Record<string, string> = {
    index: fileURLToPath(new URL('index.html', import.meta.url)),
    content: fileURLToPath(new URL('src/content/content.ts', import.meta.url)),
    background: fileURLToPath(new URL('src/background/background.ts', import.meta.url))
  }
  const resolveAliases: Array<{ find: string | RegExp; replacement: string }> = [
    {
      find: '@',
      replacement: fileURLToPath(new URL('./src', import.meta.url))
    }
  ]

  if (enableForumBrowser) {
    buildInputs.discourse = fileURLToPath(new URL('discourse.html', import.meta.url))
  } else {
    const noForumBrowserPage = fileURLToPath(
      new URL('./src/options/pages/NoForumBrowserPage.vue', import.meta.url)
    )
    const noForumBrowserComponent = fileURLToPath(
      new URL('./src/options/components/NoForumBrowser.vue', import.meta.url)
    )
    resolveAliases.push(
      {
        find: '../pages/DiscourseBrowserPage.vue',
        replacement: noForumBrowserPage
      },
      {
        find: '../components/DiscourseBrowser.vue',
        replacement: noForumBrowserComponent
      },
      {
        find: './options/components/DiscourseBrowser.vue',
        replacement: noForumBrowserComponent
      }
    )
  }

  if (!enableLocalMcpBridge) {
    const disabledMcpBridge = fileURLToPath(
      new URL('./src/background/handlers/mcpBridge.disabled.ts', import.meta.url)
    )
    resolveAliases.push({
      find: '../handlers/mcpBridge.ts',
      replacement: disabledMcpBridge
    })
  }

  return {
    // Use relative asset URLs so content-script dynamic imports resolve against
    // the extension bundle URL instead of the current page origin.
    base: './',
    css: {
      postcss: './postcss.config.js',
      // 优化：启用 CSS 代码分割
      devSourcemap: isDev
    },
    // resolve alias so imports using @/xxx map to src/xxx
    resolve: {
      alias: resolveAliases
    },
    define: {
      // 编译期标志定义
      __ENABLE_LOGGING__: enableLogging,
      __ENABLE_FORUM_BROWSER__: enableForumBrowser,
      __ENABLE_LOCAL_MCP_BRIDGE__: enableLocalMcpBridge
    },
    plugins: [
      createAntDesignVueOnDemandPlugin(),
      createPruneKatexFallbackFontsPlugin(),
      createAvifMtStubPlugin(),
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
      include: ['vue', 'pinia', 'ant-design-vue', '@ant-design/icons-vue']
    },
    build: {
      // Chrome/Edge already support modulepreload. Avoid installing Vite's
      // document-wide polyfill (and its MutationObserver) in every surface.
      modulePreload: {
        polyfill: false
      },
      sourcemap: !isFastBuild && process.env.BUILD_SOURCEMAP === 'true',
      manifest: !isFastBuild && process.env.BUILD_MANIFEST === 'true',
      minify: shouldMinify ? minifier : false,
      reportCompressedSize: false, // Skip gzip/brotli size calculation for faster builds
      chunkSizeWarningLimit: 1000, // Increase limit to 1000 kB since this is a feature-rich extension
      // 优化：目标现代浏览器
      target: 'esnext',
      // 优化：启用 CSS 代码分割
      cssCodeSplit: !isFastBuild,
      cssMinify: shouldMinify ? cssMinifier : false,
      emptyOutDir: !isFastBuild || !enableForumBrowser,
      terserOptions:
        !shouldMinify || minifier !== 'terser'
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
      rolldownOptions: {
        input: buildInputs,
        output: {
          entryFileNames: 'js/[name].js',
          chunkFileNames: 'js/[name].js',
          assetFileNames: 'assets/[name].[ext]',
          format: 'es',
          ...(isFastBuild
            ? {}
            : {
                codeSplitting: {
                  groups: [
                    {
                      // Keep Vite's dynamic-import preload helper out of large
                      // vendor chunks. Otherwise a tiny lazy import can make
                      // the 1+ MB AI bundle eager on popup/content startup.
                      name: 'vite-runtime',
                      test: /vite\/(?:preload-helper|modulepreload-polyfill)/,
                      priority: 100
                    },
                    {
                      name: 'vendor-ui',
                      test: /[\\/]node_modules[\\/](?:ant-design-vue|@ant-design)[\\/]/,
                      priority: 30
                    },
                    {
                      name: 'vendor-core',
                      test: /[\\/]node_modules[\\/](?:vue|pinia|vue-router|@vueuse)[\\/]/,
                      priority: 25
                    },
                    {
                      name: 'vendor-ai',
                      test: /[\\/]node_modules[\\/](?:@anthropic-ai|@mariozechner)[\\/]/,
                      priority: 22
                    },
                    {
                      name: 'vendor-editor',
                      test: /[\\/]node_modules[\\/](?:prosemirror-[^\\/]+|@bbob|marked|rehype|rehype-parse|rehype-stringify|unified|unist-util-visit|dompurify|highlight\.js)[\\/]/,
                      priority: 18
                    },
                    {
                      name: 'vendor-image',
                      test: /[\\/]node_modules[\\/](?:@jsquash|libheif-js|@ffmpeg|fflate)[\\/]/,
                      priority: 15
                    },
                    {
                      name: 'vendor-utils',
                      test: /[\\/]node_modules[\\/](?:katex|dayjs|lodash|dexie|zod|nanoid|typeit)[\\/]/,
                      priority: 10
                    },
                    {
                      name: 'vendor-libs',
                      test: /[\\/]node_modules[\\/]/,
                      priority: 0
                    }
                  ]
                }
              })
        },
        treeshake: isFastBuild
          ? false
          : {
              moduleSideEffects: 'no-external',
              propertyReadSideEffects: false
            }
      }
    }
  }
})
