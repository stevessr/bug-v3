// Compatibility shim: forward to gzip loader to maintain older import paths
import type { EmojiGroup } from '../types/emoji'
import { loadGzipDefaultGroups, isGzipSupported, decompressGzip } from './gzipLoader'

export async function loadCompressedDefaultGroups(): Promise<EmojiGroup[]> {
  return await loadGzipDefaultGroups()
}

export function isBrotliSupported(): boolean {
  // For backwards compatibility, treat brotli support query as gzip support
  return isGzipSupported()
}

export async function decompressBrotli(data: ArrayBuffer): Promise<Uint8Array> {
  // Forward to gzip decompressor (caller should be aware of format)
  return await decompressGzip(data)
}