#!/usr/bin/env node
/**
 * Unzip all archives in scripts/under_going into .work/<group>/extract.
 */

import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { ensureCommand, ensureDir, listZipFiles, sanitizeGroupName } from './processing-utils.js'

const DEFAULT_INPUT_DIR = path.resolve(process.cwd(), 'scripts/under_going')
const DEFAULT_WORK_DIR = path.resolve(process.cwd(), 'scripts/under_going/.work')

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT_DIR,
    workdir: DEFAULT_WORK_DIR
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--input':
        args.input = path.resolve(process.cwd(), argv[++i])
        break
      case '--workdir':
        args.workdir = path.resolve(process.cwd(), argv[++i])
        break
      default:
        if (arg.startsWith('--')) {
          console.warn(`Unknown option ignored: ${arg}`)
        }
        break
    }
  }

  return args
}

function unzipToDir(zipPath, destDir) {
  ensureDir(destDir)
  console.log(`Unzipping: ${zipPath} -> ${destDir}`)
  const result = spawnSync('unzip', ['-q', '-o', zipPath, '-d', destDir], {
    stdio: 'inherit'
  })
  if (result.status !== 0) {
    throw new Error(`Failed to unzip: ${zipPath}`)
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  console.log('Starting unzip-under-going with args:', args)

  ensureCommand('unzip', 'Install unzip (e.g. apt install unzip).')
  ensureDir(args.workdir)

  const zipFiles = listZipFiles(args.input)
  if (zipFiles.length === 0) {
    console.log(`No zip files found in ${args.input}`)
    return
  }

  for (const zipPath of zipFiles) {
    const zipName = path.basename(zipPath)
    const groupName = sanitizeGroupName(zipName)
    const groupDir = path.join(args.workdir, groupName)
    const extractDir = path.join(groupDir, 'extract')

    if (fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true, force: true })
    }

    unzipToDir(zipPath, extractDir)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
