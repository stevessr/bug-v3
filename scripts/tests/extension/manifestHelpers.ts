import fs from 'fs'
import path from 'path'

type ManifestChunk = { imports?: string[] }
type BuildManifest = Record<string, ManifestChunk>

export function getOptionsStaticImports(distPath: string): Set<string> {
  const manifestPath = path.join(distPath, '.vite', 'manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as BuildManifest
  const optionsKey = 'src/options/main.ts'
  if (!manifest[optionsKey]) throw new Error(`Missing options build entry: ${optionsKey}`)

  const pending = [optionsKey]
  const visited = new Set<string>()
  while (pending.length > 0) {
    const key = pending.pop()!
    if (visited.has(key)) continue
    visited.add(key)
    pending.push(...(manifest[key]?.imports || []))
  }
  return visited
}
