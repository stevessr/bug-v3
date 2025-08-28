#!/usr/bin/env node

import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function parseArgs() {
  const argv = process.argv.slice(2)
  const res = { build: true, key: process.env.CRX_KEY_PATH || process.env.CRX_KEY || '', out: '' }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--no-build') res.build = false
    else if (a === '--key' || a === '--key-path') res.key = argv[++i]
    else if (a === '--out' || a === '-o') res.out = argv[++i]
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node scripts/pack-crx.js [--no-build] [--key <path>] [--out <file.crx>]')
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
  })
  if (res.status !== 0) {
    console.error('Build failed. Aborting pack.')
    process.exit(res.status || 1)
  }
}

function ensureDistExists() {
  const d = path.resolve(__dirname, '..', 'dist')
  if (!fs.existsSync(d)) {
    console.error('dist/ not found. Run build first.')
    process.exit(1)
  }
  return d
}

function ensureKey(keyPath) {
  if (keyPath && fs.existsSync(keyPath)) return path.resolve(keyPath)

  // generate a temporary RSA private key PEM if none provided
  const generatedPath = path.resolve(process.cwd(), 'pack-key.pem')
  if (fs.existsSync(generatedPath)) return generatedPath

  console.log('No private key provided. Generating a temporary key at', generatedPath)
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicExponent: 0x10001,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  })
  fs.writeFileSync(generatedPath, privateKey, { mode: 0o600 })
  return generatedPath
}

function packWithCrx(distPath, keyPath, outPath) {
  const outFile = outPath || path.resolve(process.cwd(), 'dist.crx')
  console.log(`📦 Packing ${distPath} -> ${outFile}`)

  // Try common CLI forms for 'crx' package. Prefer: npx crx pack <dir> --private-key <key> -o <out>
  const args = ['crx', 'pack', distPath, '--private-key', keyPath, '-o', outFile]
  const res = spawnSync('npx', args, { stdio: 'inherit', shell: true })
  if (res.status === 0) {
    console.log('✅ .crx created at', outFile)
    return
  }

  console.warn('Primary npx crx invocation failed, trying alternate flags...')

  // Alternate flags
  const altArgs = ['crx', 'pack', distPath, '-k', keyPath, '-o', outFile]
  const res2 = spawnSync('npx', altArgs, { stdio: 'inherit', shell: true })
  if (res2.status === 0) {
    console.log('✅ .crx created at', outFile)
    return
  }

  console.error(
    'Failed to pack using npx crx. Please ensure the `crx` package is installed (devDependency) and try running `pnpm install` first.',
  )
  process.exit(res2.status || res.status || 1)
}

async function main() {
  const opts = parseArgs()
  if (opts.build) runBuild()
  const distPath = ensureDistExists()
  const key = ensureKey(opts.key)
  const out = opts.out
    ? path.resolve(opts.out)
    : path.resolve(process.cwd(), `${path.basename(process.cwd())}.crx`)
  packWithCrx(distPath, key, out)
}

main()
