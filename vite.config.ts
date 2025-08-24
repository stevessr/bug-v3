import { fileURLToPath, URL } from 'url'

import { defineConfig } from 'vite'
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
      })
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
          popup: fileURLToPath(new URL('html/popup.html', import.meta.url)),
          options: fileURLToPath(new URL('html/options.html', import.meta.url)),
          'image-generator': fileURLToPath(new URL('html/image-generator.html', import.meta.url)),
          'emoji-manager': fileURLToPath(new URL('html/emoji-manager.html', import.meta.url)),
          'image-generator-vue': fileURLToPath(new URL('html/image-generator-vue.html', import.meta.url)),
          'animation-converter': fileURLToPath(new URL('html/animation-converter.html', import.meta.url)),
          'image-editor': fileURLToPath(new URL('html/image-editor.html', import.meta.url)),
          tenor: fileURLToPath(new URL('src/tenor/main.ts', import.meta.url)),
          waline: fileURLToPath(new URL('src/waline/main.ts', import.meta.url)),
          content: fileURLToPath(new URL('src/content/content.ts', import.meta.url)),
          background: fileURLToPath(new URL('src/background/background.ts', import.meta.url)),
          'image-generator-js': fileURLToPath(new URL('src/image-generator.ts', import.meta.url)),
          'animation-converter-js': fileURLToPath(new URL('src/animation-converter.ts', import.meta.url)),
          'image-editor-js': fileURLToPath(new URL('src/image-editor.ts', import.meta.url)),
          'emoji-manager-js': fileURLToPath(new URL('src/emoji-manager.ts', import.meta.url)),
          'image-generator-vue-js': fileURLToPath(new URL('src/image-generator-vue.ts', import.meta.url))
        },
        output: {
          entryFileNames: chunkInfo => {
            return 'js/[name].js'
          },
          chunkFileNames: 'js/[name].js',
          assetFileNames: 'assets/[name].[ext]',
          manualChunks: id => {
            // Force content script dependencies to be bundled into the content entry
            if (id.includes('src/content/') || id.includes('content.ts')) {
              return 'content'
            }
            // Keep background modules together so runtime doesn't need cross-chunk imports
            if (id.includes('src/background/') || id.includes('background.ts')) {
              return 'background'
            }
            // Put third-party deps into vendor
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
