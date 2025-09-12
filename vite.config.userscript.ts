import { fileURLToPath, URL } from 'url'

import { defineConfig } from 'vite'
import { generateDefaultEmojiGroupsPlugin } from './scripts/vite-plugin-generate-default-emoji-groups'

export default defineConfig(({ mode }) => {
  // Build settings for userscript
  const isDev = mode === 'development'

  const variant = process.env.USERSCRIPT_VARIANT || 'default'

  const enableMinifiedEnv = process.env.ENABLE_MINIFIED
  const buildMinified = typeof enableMinifiedEnv === 'string' ? enableMinifiedEnv === 'true' : !isDev

  return {
    // resolve alias so imports using @/xxx map to src/xxx
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
        // When building remote variant, point the generated big data file to an empty placeholder
        // defaultEmojiGroups is loaded at runtime from public assets; no build-time aliasing
      }
    },
    build: {
      minify: buildMinified ? 'terser' : false,
      terserOptions: buildMinified
        ? {
            compress: {
              drop_console: !isDev,
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
  outDir: buildMinified ? 'dist-userscript-min' : 'dist-userscript',
      emptyOutDir: true
    },
    plugins: [generateDefaultEmojiGroupsPlugin()]
  }
})
