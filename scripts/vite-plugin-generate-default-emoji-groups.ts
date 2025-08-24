import { Plugin } from 'vite'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

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

      try {
        console.log('📦 正在从 default.json 生成 defaultEmojiGroups.ts...')

        const configContent = readFileSync(configPath, 'utf-8')
        const configData: ConfigData = JSON.parse(configContent)

        if (!configData.groups || !Array.isArray(configData.groups)) {
          throw new Error('default.json 中缺少有效的 groups 数组')
        }

        // 生成 TypeScript 文件内容
        const tsContent = `import { EmojiGroup } from "./emoji";

// 这个文件是在构建时从 src/config/default.json 自动生成的
// 请不要手动修改此文件，而是修改 src/config/default.json

export const defaultEmojiGroups: EmojiGroup[] = ${JSON.stringify(configData.groups, null, 2)};
`

        writeFileSync(outputPath, tsContent, 'utf-8')
        console.log('✅ defaultEmojiGroups.ts 已成功生成')

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
