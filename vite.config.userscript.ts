import { fileURLToPath } from 'url'

import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => {
  // Build settings for userscript
  const isDev = mode === 'development'
  const enableLogging = process.env.ENABLE_LOGGING !== 'false' // Always enable logging for userscripts unless explicitly disabled
  const enableIndexedDB = false // Userscripts don't use IndexedDB

  return {
    define: {
      // Compilation flags for userscript
      __ENABLE_LOGGING__: enableLogging,
      __ENABLE_INDEXEDDB__: enableIndexedDB
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
          userscript: fileURLToPath(
            new URL('scripts/tampermonkey/userscript-main.ts', import.meta.url)
          )
        },
        output: {
          entryFileNames: 'userscript.js',
          chunkFileNames: 'userscript.js',
          assetFileNames: `[name].[ext]`,
          // Force everything into a single file
          inlineDynamicImports: true
        },
        external: () => false // Don't externalize anything
      },
      outDir: process.env.BUILD_MINIFIED === 'true' ? 'dist-userscript-min' : 'dist-userscript',
      emptyOutDir: true
    }
  }
})
