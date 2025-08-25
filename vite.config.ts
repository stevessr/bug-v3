import { fileURLToPath, URL } from 'url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'

import { generateDefaultEmojiGroupsPlugin } from './scripts/vite-plugin-generate-default-emoji-groups'
import { copyHtmlToRootPlugin } from './scripts/vite-plugin-copy-html'

export default defineConfig(({ mode }) => {
  // 根据构建模式设置编译期标志
  const isDev = mode === 'development'
  const enableLogging = process.env.ENABLE_LOGGING === 'true' || isDev
  const enableIndexedDB = process.env.ENABLE_INDEXEDDB !== 'false' // 默认启用，除非明确禁用

  return {
    // Exclude problematic worker/module entries from dep optimizer. Some worker
    // build outputs (worker.js?worker_file&type=module) don't exist in the
    // optimized deps dir during dev and cause the optimizer to produce a
    // broken import path. Excluding the worker file lets Vite load it at runtime.
    optimizeDeps: {
      exclude: ['worker.js']
    },
    css: {
      postcss: './postcss.config.js'
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@html': fileURLToPath(new URL('./src/html', import.meta.url))
      }
    },
    define: {
      // 编译期标志定义
      __ENABLE_LOGGING__: enableLogging,
      __ENABLE_INDEXEDDB__: enableIndexedDB
    },
    plugins: [
      generateDefaultEmojiGroupsPlugin(),
      vue(),
      // auto register components and import styles for ant-design-vue
      Components({
        resolvers: [AntDesignVueResolver({ importStyle: 'less' })]
      }),
      copyHtmlToRootPlugin()
    ],
    build: {
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: !enableLogging, // 根据日志开关决定是否移除 console
          drop_debugger: !isDev // 生产环境移除 debugger
        }
      },
      rollupOptions: {
        input: {
<<<<<<< HEAD
          popup: fileURLToPath(new URL('html/popup.html', import.meta.url)),
          options: fileURLToPath(new URL('html/options.html', import.meta.url)),
          'image-generator': fileURLToPath(new URL('html/image-generator.html', import.meta.url)),
          'emoji-manager': fileURLToPath(new URL('html/emoji-manager.html', import.meta.url)),
          'image-generator-vue': fileURLToPath(
            new URL('html/image-generator-vue.html', import.meta.url)
          ),
          'animation-converter': fileURLToPath(
            new URL('html/animation-converter.html', import.meta.url)
          ),
          'image-editor': fileURLToPath(new URL('html/image-editor.html', import.meta.url)),
=======
          popup: fileURLToPath(new URL('src/html/popup.html', import.meta.url)),
          options: fileURLToPath(new URL('src/html/options.html', import.meta.url)),
          'image-generator': fileURLToPath(
            new URL('src/html/image-generator.html', import.meta.url)
          ),
          'image-editor': fileURLToPath(new URL('src/html/image-editor.html', import.meta.url)),
          'ai-image-generator': fileURLToPath(
            new URL('src/html/ai-image-generator.html', import.meta.url)
          ),
          'emoji-rename': fileURLToPath(new URL('src/html/emoji-rename.html', import.meta.url)),
          'emoji-manager': fileURLToPath(new URL('src/html/emoji-manager.html', import.meta.url)),
          'image-generator-vue': fileURLToPath(
            new URL('src/html/image-generator-vue.html', import.meta.url)
          ),
>>>>>>> 179a34af71ad2ff93dd5eaca7b050412a83554f3
          tenor: fileURLToPath(new URL('src/tenor/main.ts', import.meta.url)),
          waline: fileURLToPath(new URL('src/waline/main.ts', import.meta.url)),
          content: fileURLToPath(new URL('src/content/content.ts', import.meta.url)),
          background: fileURLToPath(new URL('src/background/background.ts', import.meta.url)),
          'image-generator-js': fileURLToPath(new URL('src/image-generator.ts', import.meta.url)),
          'animation-converter-js': fileURLToPath(
            new URL('src/animation-converter.ts', import.meta.url)
          ),
          'image-editor-js': fileURLToPath(new URL('src/image-editor.ts', import.meta.url)),
          'emoji-manager-js': fileURLToPath(new URL('src/emoji-manager.ts', import.meta.url)),
          'image-generator-vue-js': fileURLToPath(
            new URL('src/image-generator-vue.ts', import.meta.url)
          )
        },
        output: {
          entryFileNames: chunkInfo => {
            return 'js/[name].js'
          },
          chunkFileNames: 'js/[name].js',
          assetFileNames: assetInfo => {
            // Move HTML files to root of dist
            if (assetInfo.name?.endsWith('.html')) {
              return '[name].[ext]'
            }
            return 'assets/[name].[ext]'
          },
          manualChunks: id => {
            // Force content script dependencies to be bundled into the content entry
            if (id.includes('src/content/') || id.includes('content.ts')) {
              return 'content'
            }
            // Keep background modules together so runtime doesn't need cross-chunk imports
            if (id.includes('src/background/') || id.includes('background.ts')) {
              return 'background'
            }
<<<<<<< HEAD
=======
            // Split large third-party deps into separate chunks to reduce vendor size
            if (id.includes('node_modules/@ffmpeg')) {
              return 'ffmpeg'
            }
            if (id.includes('node_modules/gifuct-js')) {
              return 'gifuct'
            }
            if (id.includes('node_modules/jszip')) {
              return 'jszip'
            }
            // Fallback third-party deps into vendor
>>>>>>> 179a34af71ad2ff93dd5eaca7b050412a83554f3
            if (id.includes('node_modules')) {
              return 'vendor'
            }
            return 'undefined'
          }
        },
        external: id => {
          return false // Don't externalize anything
        }
      }
    }
  }
})
