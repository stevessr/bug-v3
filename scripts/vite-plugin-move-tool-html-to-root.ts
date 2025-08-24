import fs from 'fs'
import path from 'path'

import { Plugin } from 'vite'

export function moveToolHtmlToRootPlugin(
  toolHtmlFiles: string[] = [
    'image-generator.html',
    'animation-converter.html',
    'image-editor.html'
  ]
): Plugin {
  return {
    name: 'move-tool-html-to-root',
    writeBundle() {
      const distPath = path.resolve(process.cwd(), 'dist')
      const htmlPath = path.join(distPath, 'html')

      // 复制文件到根目录
      toolHtmlFiles.forEach(fileName => {
        const sourcePath = path.join(htmlPath, fileName)
        const targetPath = path.join(distPath, fileName)

        if (fs.existsSync(sourcePath)) {
          fs.copyFileSync(sourcePath, targetPath)
          // 保持与原先插件一致的日志输出

          console.log(`✅ 已复制 ${fileName} 到根目录`)
        }
      })
    }
  }
}

export default moveToolHtmlToRootPlugin
