import fs from 'fs'
import path from 'path'
import type { Plugin } from 'vite'

export function copyHtmlToRootPlugin(): Plugin {
  return {
    name: 'copy-html-to-root',
    writeBundle(options, bundle) {
      const outDir = options.dir || 'dist'
      const htmlSrcDir = path.join(outDir, 'src/html')
      
      if (!fs.existsSync(htmlSrcDir)) {
        return
      }

      // Get all HTML files from src/html in dist
      const htmlFiles = fs.readdirSync(htmlSrcDir).filter(file => file.endsWith('.html'))
      
      // Copy each HTML file to root of dist
      for (const htmlFile of htmlFiles) {
        const srcPath = path.join(htmlSrcDir, htmlFile)
        const destPath = path.join(outDir, htmlFile)
        
        try {
          fs.copyFileSync(srcPath, destPath)
          console.log(`📋 Copied ${htmlFile} to dist root`)
        } catch (error) {
          console.warn(`⚠️ Failed to copy ${htmlFile}:`, error)
        }
      }

      // Remove the src directory from dist if it exists
      try {
        fs.rmSync(path.join(outDir, 'src'), { recursive: true, force: true })
        console.log(`🧹 Cleaned up src directory from dist`)
      } catch (error) {
        console.warn(`⚠️ Failed to clean up src directory:`, error)
      }
    }
  }
}