#!/usr/bin/env node

import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import archiver from 'archiver'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function parseArgs() {
  const argv = process.argv.slice(2)
  const res = { build: true, out: '' }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--no-build') res.build = false
    else if (a === '--out' || a === '-o') res.out = argv[++i]
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node scripts/pack-zip.js [--no-build] [--out <file.zip>]')
      process.exit(0)
    }
  }
  return res
}

function runBuild() {
  console.log('🔨 Running build...')
  const res = spawnSync('node', ['./scripts/build.js', 'build:minimal'], {
    stdio: 'inherit',
    shell: true,
    cwd: path.resolve(__dirname, '..')
  })
  
  if (res.status !== 0) {
    console.error('❌ Build failed')
    process.exit(1)
  }
  console.log('✅ Build completed')
}

async function createZip(outputPath) {
  return new Promise((resolve, reject) => {
    const distPath = path.resolve(__dirname, '../dist')
    const packagePath = path.resolve(__dirname, '../package.json')
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))
    const version = packageJson.version
    
    if (!outputPath) {
      outputPath = path.resolve(__dirname, `../bug-v3-v${version}.zip`)
    }

    console.log(`📦 Creating ZIP: ${outputPath}`)

    const output = fs.createWriteStream(outputPath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', () => {
      console.log(`✅ ZIP created: ${archive.pointer()} bytes`)
      resolve()
    })

    archive.on('error', (err) => {
      reject(err)
    })

    archive.pipe(output)
    archive.directory(distPath, false)
    archive.finalize()
  })
}

async function main() {
  const args = parseArgs()
  
  try {
    if (args.build) {
      runBuild()
    }
    
    await createZip(args.out)
    console.log('🎉 ZIP packaging completed successfully!')
  } catch (error) {
    console.error('❌ Failed to create ZIP:', error.message)
    process.exit(1)
  }
}

main()