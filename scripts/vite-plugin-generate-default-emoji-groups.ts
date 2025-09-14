/* eslint-disable no-restricted-properties */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

import { Plugin } from 'vite'

interface ConfigData {
  groups: any[]
  settings?: any
}

export function generateDefaultEmojiGroupsPlugin(): Plugin {
  return {
    name: 'generate-default-emoji-groups',
    buildStart() {
      // 读取 default.json 文件
      const configPath = join(process.cwd(), 'src/config/default.json')
      const outputPath = join(process.cwd(), 'src/types/defaultEmojiGroups.ts')
      const jsonOutputPath = join(process.cwd(), 'public', 'assets', 'defaultEmojiGroups.json')

      try {
        console.log('📦 正在从 default.json 生成 defaultEmojiGroups.ts...')

        const configContent = readFileSync(configPath, 'utf-8')
        const configData: ConfigData = JSON.parse(configContent)

        if (!configData.groups || !Array.isArray(configData.groups)) {
          throw new Error('default.json 中缺少有效的 groups 数组')
        }

        // Always write a runtime JSON into public/assets for loader consumption
        try {
          writeFileSync(
            jsonOutputPath,
            JSON.stringify({ groups: configData.groups }, null, 2),
            'utf-8'
          )
          console.log(`✅ wrote runtime defaultEmojiGroups JSON to ${jsonOutputPath}`)
        } catch (e) {
          console.warn('⚠️ failed to write runtime defaultEmojiGroups JSON:', e)
        }

        // If not remote variant, also generate the TypeScript module for existing imports
        const variant = process.env.USERSCRIPT_VARIANT || 'default'
        if (variant === 'remote') {
          const tsContent = `import { EmojiGroup } from "./emoji";

// Remote variant: default emoji groups are fetched at runtime. This file is intentionally empty.

export const defaultEmojiGroups: EmojiGroup[] = [];
`
          writeFileSync(outputPath, tsContent, 'utf-8')
          console.log('ℹ️ USERSCRIPT_VARIANT=remote -> generated empty defaultEmojiGroups.ts')
        } else {
          // 生成 TypeScript 文件内容 (embedded)
          const tsContent = `import { EmojiGroup } from "./emoji";

// 这个文件是在构建时从 src/config/default.json 自动生成的
// 请不要手动修改此文件，而是修改 src/config/default.json

export const defaultEmojiGroups: EmojiGroup[] = ${JSON.stringify(configData.groups, null, 2)};
`

          writeFileSync(outputPath, tsContent, 'utf-8')
          console.log('✅ defaultEmojiGroups.ts 已成功生成')

          // Also generate a static loader that returns the embedded defaults so
          // userscript bundles do not include the dynamic fetch-based loader.
          const loaderOutputPath = join(
            process.cwd(),
            'src',
            'types',
            'defaultEmojiGroups.loader.ts'
          )
          const loaderTsContent = `import { defaultEmojiGroups } from "./defaultEmojiGroups";
import type { DefaultEmojiData } from "./emoji";

export async function loadDefaultEmojiGroups(): Promise<any[]> {
  return defaultEmojiGroups;
}

export async function loadPackagedDefaults(): Promise<DefaultEmojiData> {
  return {
    groups: defaultEmojiGroups,
    settings: ${JSON.stringify(configData.settings || {}, null, 2)}
  } as unknown as DefaultEmojiData;
}
`
          try {
            // Backup existing loader if present
            try {
              const backupPath = loaderOutputPath + '.bak'
              if (existsSync(loaderOutputPath) && !existsSync(backupPath)) {
                writeFileSync(backupPath, readFileSync(loaderOutputPath, 'utf-8'), 'utf-8')
                console.log(`🔖 Backed up existing loader to ${backupPath}`)
              }
            } catch (backupErr) {
              console.warn('⚠️ failed to backup existing loader:', backupErr)
            }

            writeFileSync(loaderOutputPath, loaderTsContent, 'utf-8')
            console.log('✅ generated static defaultEmojiGroups.loader.ts for embedded userscript')
          } catch (e) {
            console.warn('⚠️ failed to write static loader for userscript build:', e)
          }
        }

        // 添加文件监听，当 default.json 改变时重新生成
        this.addWatchFile(configPath)
      } catch (error) {
        console.error('❌ 生成 defaultEmojiGroups.ts 失败:', error)
        throw error
      }
    },

    handleHotUpdate({ file, server }) {
      // 当 default.json 文件改变时，重新生成 defaultEmojiGroups.ts
      if (file.includes('src/config/default.json')) {
        console.log('🔄 检测到 default.json 变更，重新生成 defaultEmojiGroups.ts...')

        const configPath = join(process.cwd(), 'src/config/default.json')
        const outputPath = join(process.cwd(), 'src/types/defaultEmojiGroups.ts')

        try {
          const configContent = readFileSync(configPath, 'utf-8')
          const configData: ConfigData = JSON.parse(configContent)

          if (!configData.groups || !Array.isArray(configData.groups)) {
            throw new Error('default.json 中缺少有效的 groups 数组')
          }

          const tsContent = `import { EmojiGroup } from "./emoji";

// 这个文件是在构建时从 src/config/default.json 自动生成的
// 请不要手动修改此文件，而是修改 src/config/default.json

export const defaultEmojiGroups: EmojiGroup[] = ${JSON.stringify(configData.groups, null, 2)};
`

          writeFileSync(outputPath, tsContent, 'utf-8')
          console.log('✅ defaultEmojiGroups.ts 已重新生成')

          // 通知客户端重新加载
          server.ws.send({
            type: 'full-reload'
          })
        } catch (error) {
          console.error('❌ 重新生成 defaultEmojiGroups.ts 失败:', error)
        }

        return []
      }
    }
  }
}
