#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DIR = path.resolve(__dirname, '..', 'dist', 'js')

function removeEmptyFiles(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`[clean-empty-chunks] directory not found: ${dir}`)
    return 0
  }
  const files = fs.readdirSync(dir)
  let removed = 0
  for (const f of files) {
    const p = path.join(dir, f)
    try {
      const stat = fs.statSync(p)
      if (stat.isFile() && stat.size <= 1) {
        fs.unlinkSync(p)
        console.log(
          `[clean-empty-chunks] removed ${path.relative(process.cwd(), p)} (size ${stat.size})`,
        )
        removed++
      }
    } catch (e) {
      // ignore
      console.debug('Failed to process file:', e.message)
    }
  }
  return removed
}

const removed = removeEmptyFiles(DIR)
console.log(`[clean-empty-chunks] done. removed ${removed} files.`)
