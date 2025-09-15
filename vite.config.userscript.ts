import { fileURLToPath, URL } from 'url'

import { defineConfig } from 'vite'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

export default defineConfig(({ mode }) => {
  // Build settings for userscript
  const isDev = mode === 'development'
  const enableLogging = process.env.ENABLE_LOGGING !== 'false' // Always enable logging for userscripts unless explicitly disabled
  const enableIndexedDB = false // Userscripts don't use IndexedDB

  const variant = process.env.USERSCRIPT_VARIANT || 'default'
  const platform = process.env.USERSCRIPT_PLATFORM || 'original' // pc, mobile, original

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
      __USERSCRIPT_REMOTE_DEFAULTS__: variant === 'remote',
      __USERSCRIPT_PLATFORM__: JSON.stringify(platform)
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
    plugins: [
      // When building the userscript with USERSCRIPT_VARIANT=embedded,
      // generate an embedded TypeScript module `src/types/defaultEmojiGroups.ts`
      // and a static loader so the userscript bundle contains the defaults.
      {
        name: 'userscript-embed-defaults',
        buildStart() {
          try {
            const variantEnv = process.env.USERSCRIPT_VARIANT || 'default'
            if (variantEnv !== 'embedded') return

            const configPath = join(process.cwd(), 'src', 'config', 'default.json')
            const outTs = join(process.cwd(), 'src', 'types', 'defaultEmojiGroups.ts')
            const outLoader = join(process.cwd(), 'src', 'types', 'defaultEmojiGroups.loader.ts')
            const jsonOut = join(process.cwd(), 'public', 'assets', 'defaultEmojiGroups.json')

            const content = readFileSync(configPath, 'utf-8')
            const data = JSON.parse(content)
            if (!data || !Array.isArray(data.groups)) {
              this.warn('embedded default.json has no groups array')
              return
            }

            // Ensure directories exist
            mkdirSync(join(process.cwd(), 'src', 'types'), { recursive: true })
            mkdirSync(join(process.cwd(), 'public', 'assets'), { recursive: true })

              // Determine whether we should emit compact (single-line) JSON for embedded outputs.
              const embedOneline = (process.env.USERSCRIPT_EMBED_JSON_ONELINE === 'true') || ((process.env.USERSCRIPT_VARIANT || '').includes('oneline'))

              // Write the embedded TypeScript module
              const groupsString = embedOneline ? JSON.stringify(data.groups) : JSON.stringify(data.groups, null, 2)
              const tsContent = `import { EmojiGroup } from "./emoji";

  // This file is auto-generated for embedded userscript builds from src/config/default.json

  export const defaultEmojiGroups: EmojiGroup[] = ${groupsString};
  `
              writeFileSync(outTs, tsContent, 'utf-8')
              this.info(`\u2705 generated embedded ${outTs}`)

              // Write a static loader that returns the embedded defaults
              const settingsString = embedOneline ? JSON.stringify(data.settings || {}) : JSON.stringify(data.settings || {}, null, 2)
              const loaderContent = `import { defaultEmojiGroups } from "./defaultEmojiGroups";
  import type { DefaultEmojiData } from "./emoji";

  export async function loadDefaultEmojiGroups(): Promise<any[]> {
    return defaultEmojiGroups;
  }

  export async function loadPackagedDefaults(): Promise<DefaultEmojiData> {
    return {
      groups: defaultEmojiGroups,
      settings: ${settingsString}
    } as unknown as DefaultEmojiData;
  }
  `
              writeFileSync(outLoader, loaderContent, 'utf-8')
              this.info(`\u2705 generated embedded loader ${outLoader}`)

            // Always write runtime JSON as well
            try {
              writeFileSync(jsonOut, JSON.stringify({ groups: data.groups }), 'utf-8')
              this.info(`ℹ️ wrote runtime defaultEmojiGroups JSON to ${jsonOut}`)
            } catch (e) {
              this.warn('⚠️ failed to write runtime defaultEmojiGroups JSON: ' + String(e))
            }
          } catch (e) {
            this.warn('userscript embed defaults plugin error: ' + String(e))
          }
        }
      }
    ]
  }
})
