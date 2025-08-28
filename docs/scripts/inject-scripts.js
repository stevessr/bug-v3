#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Map of HTML files to their corresponding JS files
const htmlJsMap = {
  'animation-converter.html': 'animation-converter-js.js',
  'image-editor.html': 'image-editor-js.js',
  'emoji-manager.html': 'emoji-manager-js.js',
  'image-generator-vue.html': 'image-generator-vue-js.js',
}

const distDir = path.join(__dirname, '../dist')

// Inject script tags into HTML files
Object.entries(htmlJsMap).forEach(([htmlFile, jsFile]) => {
  const htmlPath = path.join(distDir, htmlFile)
  const jsPath = path.join(distDir, 'js', jsFile)

  // Check if both files exist
  if (fs.existsSync(htmlPath) && fs.existsSync(jsPath)) {
    let htmlContent = fs.readFileSync(htmlPath, 'utf8')

    // Check if script tag is already present
    if (!htmlContent.includes(`src="/js/${jsFile}"`)) {
      // Inject script tag before closing body tag
      const scriptTag = `    <script type="module" crossorigin src="/js/${jsFile}"></script>\n  </body>`
      htmlContent = htmlContent.replace('  </body>', scriptTag)

      fs.writeFileSync(htmlPath, htmlContent, 'utf8')
      console.log(`✅ Injected script tag for ${jsFile} into ${htmlFile}`)
    } else {
      console.log(`ℹ️  Script tag already exists in ${htmlFile}`)
    }
  } else {
    console.log(`⚠️  Missing files: ${htmlFile} or ${jsFile}`)
  }
})

console.log('🎉 Script injection completed')
