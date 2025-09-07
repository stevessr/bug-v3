#!/usr/bin/env node
// Script to remove imports/exports from content.js and inline all dependencies

import fs from 'fs'
import path from 'path'

function processContentJs(distDir) {
  const contentJsPath = path.join(distDir, 'js', 'content.js')
  
  if (!fs.existsSync(contentJsPath)) {
    console.log('⚠️ content.js not found, skipping processing')
    return
  }

  console.log('🔧 Processing content.js to remove imports/exports...')
  
  let content = fs.readFileSync(contentJsPath, 'utf-8')
  
  // Remove import statements
  content = content.replace(/import\s+[^;]+;?\s*\n/g, '')
  content = content.replace(/import\s*\([^)]+\)[^;]*;?\s*\n/g, '')
  
  // Remove export statements
  content = content.replace(/export\s+\{[^}]*\}\s*;?\s*\n/g, '')
  content = content.replace(/export\s+default\s+[^;]+;?\s*\n/g, '')
  content = content.replace(/export\s+\{[^}]*\}\s+from\s+[^;]+;?\s*\n/g, '')
  content = content.replace(/export\s*\{\s*\}\s*;?\s*\n/g, '')
  
  // Remove any remaining export keywords
  content = content.replace(/^export\s+/gm, '')
  
  // Clean up extra whitespace
  content = content.replace(/\n\s*\n\s*\n/g, '\n\n')
  
  fs.writeFileSync(contentJsPath, content, 'utf-8')
  console.log('✅ content.js processed successfully')
}

// Check if called directly
const distDir = process.argv[2] || 'dist'
processContentJs(distDir)