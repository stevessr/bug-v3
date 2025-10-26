import { fileURLToPath, URL } from 'url'

import { defineConfig } from 'vite'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

export default defineConfig(({ mode }) => {
  // Build settings for userscript
  const isDev = mode === 'development'
  const enableLogging = process.env.ENABLE_LOGGING !== 'false' // Always enable logging for userscripts unless explicitly disabled
  const enableIndexedDB = false // Userscripts don't use IndexedDB

  // Variant & platform selection removed; userscript always uses remote defaults at runtime

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
      // No variant or platform selection: always remote defaults
      __USERSCRIPT_REMOTE_DEFAULTS__: true
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
          entryFileNames: chunkInfo => `${chunkInfo.name}.js`,
          chunkFileNames: `[name].js`,
          assetFileNames: `[name].[ext]`,
          // Produce a single-file bundle by using IIFE format and inlining dynamic imports
          format: 'iife'
        },
        inlineDynamicImports: true,
        external: () => false // Don't externalize anything
      },
      outDir: process.env.BUILD_MINIFIED === 'true' ? 'dist-userscript-min' : 'dist-userscript',
      emptyOutDir: true
    },
    // Embedding defaults at build time was removed. Userscripts should load defaults at runtime
    // from `public/assets/defaultEmojiGroups.json` (remote variant). Keep plugins empty here.
    plugins: []
  }
})
