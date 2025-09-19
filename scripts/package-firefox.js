#!/usr/bin/env node
// Package Firefox extension for distribution

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const distDir = 'dist-firefox'
const outputFile = 'emoji-extension-firefox.zip'

function createFirefoxPackage() {
  console.log('📦 Creating Firefox extension package...')
  
  // Check if dist-firefox exists
  if (!fs.existsSync(distDir)) {
    console.error('❌ Firefox build not found. Please run: npm run build:firefox')
    process.exit(1)
  }
  
  // Remove existing package
  if (fs.existsSync(outputFile)) {
    fs.unlinkSync(outputFile)
    console.log('🗑️  Removed existing package')
  }
  
  try {
    // Create zip package
    console.log(`📁 Packaging ${distDir}/ into ${outputFile}...`)
    
    // Use system zip command (cross-platform)
    const zipCommand = process.platform === 'win32' 
      ? `powershell -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${outputFile}'"`
      : `cd ${distDir} && zip -r ../${outputFile} .`
    
    execSync(zipCommand, { stdio: 'inherit' })
    
    const stats = fs.statSync(outputFile)
    console.log(`✅ Firefox extension packaged successfully!`)
    console.log(`📄 Package: ${outputFile} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`)
    console.log('')
    console.log('🦊 To install in Firefox:')
    console.log('1. Open Firefox and go to about:debugging')
    console.log('2. Click "This Firefox"')
    console.log('3. Click "Load Temporary Add-on"')
    console.log(`4. Select the ${outputFile} file or extract and select manifest.json`)
    console.log('')
    console.log('📚 For more information, see docs/FIREFOX_EXTENSION_GUIDE.md')
    
  } catch (error) {
    console.error('❌ Failed to create package:', error.message)
    process.exit(1)
  }
}

createFirefoxPackage()