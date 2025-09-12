// Compatibility shim: forward to gzip loader to maintain older import paths
import type { EmojiGroup } from '../types/emoji'
import { loadDefaultGroups } from './gzipLoader'

export async function loadCompressedDefaultGroups(): Promise<EmojiGroup[]> {
  // backward compatible name: still returns default groups but from plain JSON
  return await loadDefaultGroups()
}

export function isBrotliSupported(): boolean {
  // No runtime decompression needed anymore; return true for compatibility
  return true
}

export async function decompressBrotli(_data: ArrayBuffer): Promise<Uint8Array> {
  throw new Error('decompressBrotli is no longer supported in runtime; provide plain JSON instead')
}