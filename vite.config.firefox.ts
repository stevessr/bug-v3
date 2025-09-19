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
      Components({
        resolvers: [AntDesignVueResolver({ importStyle: 'less' })]
      }),
      {
        name: 'emit-static-html',
        writeBundle(options, bundle) {
          // Copy HTML files to output directory
          const htmlFiles = ['popup.html', 'options.html', 'tenor.html', 'waline.html']
          const outDir = options.dir || 'dist'

          htmlFiles.forEach(file => {
            const srcPath = path.resolve(file)
            const destPath = path.resolve(outDir, file)
            if (fs.existsSync(srcPath)) {
              fs.copyFileSync(srcPath, destPath)
            }
          })

          // Copy Firefox manifest
          const firefoxManifestSrc = path.resolve('public/manifest-firefox.json')
          const manifestDest = path.resolve(outDir, 'manifest.json')
          if (fs.existsSync(firefoxManifestSrc)) {
            fs.copyFileSync(firefoxManifestSrc, manifestDest)
            console.log('✅ Copied Firefox manifest to dist-firefox/manifest.json')
          }

          // Copy public assets except manifests
          const publicDir = path.resolve('public')
          if (fs.existsSync(publicDir)) {
            const copyRecursive = (src: string, dest: string) => {
              if (fs.statSync(src).isDirectory()) {
                if (!fs.existsSync(dest)) {
                  fs.mkdirSync(dest, { recursive: true })
                }
                fs.readdirSync(src).forEach(item => {
                  if (item !== 'manifest-firefox.json' && item !== 'manifest.json') { // Skip both manifests
                    copyRecursive(path.join(src, item), path.join(dest, item))
                  }
                })
              } else {
                fs.copyFileSync(src, dest)
              }
            }
            
            // Copy assets and img folders
            const assetsDir = path.join(publicDir, 'assets')
            const imgDir = path.join(publicDir, 'img')
            
            if (fs.existsSync(assetsDir)) {
              copyRecursive(assetsDir, path.join(outDir, 'assets'))
            }
            if (fs.existsSync(imgDir)) {
              copyRecursive(imgDir, path.join(outDir, 'img'))
            }
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
          inlineDynamicImports: false, // Firefox may have issues with dynamic imports in content scripts
          manualChunks: (id, { getModuleInfo }) => {
            return undefined
          }
        },
        external: id => {
          return false // Don't externalize anything
        }
      },
      outDir: 'dist-firefox'
    }
  }
})