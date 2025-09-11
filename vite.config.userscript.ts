import { fileURLToPath, URL } from 'url'

import { defineConfig } from 'vite'
import { generateDefaultEmojiGroupsPlugin } from './scripts/vite-plugin-generate-default-emoji-groups'

export default defineConfig(({ mode }) => {
  // Build settings for userscript
  const isDev = mode === 'development'
  const enableLogging = process.env.ENABLE_LOGGING !== 'false' // Always enable logging for userscripts unless explicitly disabled
  const enableIndexedDB = false // Userscripts don't use IndexedDB

  const variant = process.env.USERSCRIPT_VARIANT || 'default'

  return {
    // resolve alias so imports using @/xxx map to src/xxx
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
        // When building remote variant, point the generated big data file to an empty placeholder
        // defaultEmojiGroups is loaded at runtime from public assets; no build-time aliasing
      }
    },
    define: {
      // Compilation flags for userscript
      __ENABLE_LOGGING__: enableLogging,
      __ENABLE_INDEXEDDB__: enableIndexedDB,
      __USERSCRIPT_REMOTE_DEFAULTS__: variant === 'remote'
    },
    build: {
      minify: process.env.BUILD_MINIFIED === 'true' ? 'terser' : false,
      terserOptions:
        process.env.BUILD_MINIFIED === 'true'
          ? {
              compress: {
                drop_console: !enableLogging,
                drop_debugger: !isDev,
                passes: 3 // Multiple passes for better compression
              },
              mangle: {
                properties: {
                  regex: /^_/ // Mangle private properties
                }
              },
              format: {
                comments: false // Remove comments
              }
            }
          : undefined,
      rollupOptions: {
        input: {
          userscript: fileURLToPath(new URL('src/userscript/userscript-main.ts', import.meta.url))
        },
        output: {
          entryFileNames: chunkInfo => {
            return `${chunkInfo.name}.js`
          },
          chunkFileNames: `[name].js`,
          assetFileNames: `[name].[ext]`,
          // Bundle everything into a single file for userscript
          manualChunks: () => {
            return 'userscript' // Force everything into one chunk
          }
        },
        external: () => false // Don't externalize anything
      },
      outDir: process.env.BUILD_MINIFIED === 'true' ? 'dist-userscript-min' : 'dist-userscript',
      emptyOutDir: true
    },
    plugins: [generateDefaultEmojiGroupsPlugin()]
  }
})
