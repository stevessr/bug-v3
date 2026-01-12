import fs from 'node:fs'
import path from 'node:path'

function getArg(flag) {
  const index = process.argv.indexOf(flag)
  if (index === -1) return null
  return process.argv[index + 1] || null
}

const extensionId = getArg('--extension-id')
const hostPath = getArg('--host-path')
const outputPath = getArg('--output') || 'scripts/mcp-bridge/host-manifest.json'

if (!extensionId || !hostPath) {
  console.error('Usage: node scripts/mcp-bridge/create-host-manifest.js --extension-id <id> --host-path <abs path> [--output <path>]')
  process.exit(1)
}

const templatePath = path.resolve('scripts/mcp-bridge/host-manifest.template.json')
const template = fs.readFileSync(templatePath, 'utf8')

const payload = template
  .replace('__EXTENSION_ID__', extensionId)
  .replace('__HOST_PATH__', hostPath)

fs.writeFileSync(path.resolve(outputPath), payload)
console.log(`Wrote native host manifest to ${outputPath}`)
