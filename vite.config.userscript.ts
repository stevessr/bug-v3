import { fileURLToPath, URL } from 'url'

import { defineConfig } from 'vite'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

export default defineConfig(({ mode }) => {
  // Build settings for userscript
  const isDev = mode === 'development'
  const enableLogging = process.env.ENABLE_LOGGING !== 'false'
  const enableIndexedDB = false

  // Get which script to build from environment variable
  const scriptTarget = process.env.SCRIPT_TARGET || 'core'
  const entryFile =
    scriptTarget === 'manager' ? 'src/userscript/manager-main.ts' : 'src/userscript/core-main.ts'
  const outputName = scriptTarget === 'manager' ? 'emoji-manager' : 'emoji-picker-core'

  return {
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    define: {
      __ENABLE_LOGGING__: enableLogging,
      __ENABLE_INDEXEDDB__: enableIndexedDB,
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
                passes: 3
              },
              mangle: {
                properties: {
                  regex: /^_/
                }
              },
              format: {
                comments: false
              }
            }
          : undefined,
      rollupOptions: {
        input: {
          [outputName]: fileURLToPath(new URL(entryFile, import.meta.url))
        },
        output: {
          entryFileNames: chunkInfo => `${chunkInfo.name}.js`,
          chunkFileNames: `[name].js`,
          assetFileNames: `[name].[ext]`,
          format: 'iife'
        },
        inlineDynamicImports: true,
        external: () => false
      },
      outDir: 'dist',
      emptyOutDir: false
    },
    plugins: []
  }
})
