#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const target = path.resolve(__dirname, '..', 'dist', 'js', 'content.js')

if (!fs.existsSync(target)) {
  console.error('[fix-content-build] target not found:', target)
  process.exitCode = 1
  process.exit(1)
}

const code = fs.readFileSync(target, 'utf8')

// Remove trailing export statements like: export{n as l};
// and any lone `export` at the end of file. Use a conservative regex that
// removes a final `export ...;` block if present.
const cleaned = code.replace(/[\r\n]*export\s*\{[\s\S]*?\};?\s*$/m, '\n')

if (cleaned === code) {
  console.log('[fix-content-build] no trailing export found - no change')
} else {
  fs.writeFileSync(target, cleaned, 'utf8')
  console.log('[fix-content-build] stripped trailing export from', target)
}
