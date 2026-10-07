import { inflateSync, strFromU8, strToU8 } from 'fflate'
import type { BrotliWasmType } from 'brotli-wasm'

import { packFavoriteGroup } from '../favoriteReferences'
// Use the non-eager WASM entry: the package root initializes WASM on import.
// A relative package path also bypasses its exports map, which hides this entry.
import initBrotli, * as brotliModule from '../../../node_modules/brotli-wasm/pkg.web/brotli_wasm.js'

const COMPACT_KEYS = new Set([
  'appSettings',
  'favorites',
  'archivedGroupIds',
  'discourseDomains',
  'emojiGroupIndex',
  'telegramBotToken'
])
export const isEmojiGroupStorageKey = (key: string) => key.startsWith('emojiGroup_')
export const isCompactStorageKey = (key: string) =>
  isEmojiGroupStorageKey(key) || COMPACT_KEYS.has(key)

let brotli: BrotliWasmType | undefined
let ready: Promise<void> | undefined
export function initializeStorageCodec(): Promise<void> {
  if (!ready) {
    // MV3 service workers prohibit dynamic import(), and Vite's import-preload
    // helper additionally requires document. Keep the WASM module import static.
    ready = initBrotli()
      .then(() => {
        brotli = brotliModule
      })
      .catch(error => {
        ready = undefined
        throw error
      })
  }
  return ready
}

function getBrotli() {
  if (!brotli) throw new Error('Storage codec must be initialized before use')
  return brotli
}

// Chrome storage is JSON-only. Persist compressed bytes directly as unsigned integer words,
// not Base64 (or another textual binary encoding). Tiny values remain plain JSON.
export function decodeStorageValue(key: string, value: unknown): any {
  let unpacked =
    value && typeof value === 'object' && 'data' in value
      ? (value as { data: unknown }).data
      : value
  if (isCompactStorageKey(key) && Array.isArray(unpacked) && unpacked[0] === 'br2') {
    const [, byteLength, words] = unpacked
    if (
      unpacked.length !== 3 ||
      !Number.isInteger(byteLength) ||
      byteLength < 0 ||
      !Array.isArray(words) ||
      words.length !== Math.ceil(byteLength / 4) ||
      !words.every(
        (word: unknown) => Number.isInteger(word) && Number(word) >= 0 && Number(word) <= 0xffffffff
      )
    ) {
      throw new Error('Invalid compressed storage words')
    }
    const bytes = new Uint8Array(words.length * 4)
    const view = new DataView(bytes.buffer)
    words.forEach((word: number, i: number) => view.setUint32(i * 4, word, true))
    unpacked = JSON.parse(strFromU8(getBrotli().decompress(bytes.subarray(0, byteLength))))
  } else if (isEmojiGroupStorageKey(key) && typeof unpacked === 'string') {
    // Decode-only compatibility for the old Base64 + DEFLATE format.
    if (unpacked.startsWith('eg1:')) {
      const bytes = Uint8Array.from(atob(unpacked.slice(4)), char => char.charCodeAt(0))
      unpacked = JSON.parse(strFromU8(inflateSync(bytes)))
    } else if (/^eg\d+:/.test(unpacked)) throw new Error('Unsupported emoji group storage version')
  }
  return unpacked ?? null
}

export function encodeEmojiGroupValue(value: unknown): unknown {
  return encodeCompactValue(value)
}

function encodeCompactValue(value: unknown): unknown {
  if (value == null) return value
  const json = JSON.stringify(value)
  if (json === undefined) return null
  const bytes = strToU8(json)
  if (bytes.length < 256) return value
  const binary = getBrotli().compress(bytes, { quality: 9 })
  // JSON cannot store ArrayBuffer. Four bytes per unsigned integer avoids both
  // textual encodings and the overhead of serializing every byte separately.
  const padded = new Uint8Array(Math.ceil(binary.length / 4) * 4)
  padded.set(binary)
  const view = new DataView(padded.buffer)
  const words = Array.from({ length: padded.length / 4 }, (_, i) => view.getUint32(i * 4, true))
  const compressed = ['br2', binary.length, words]
  // Account for ALL JSON overhead, not just compressed payload bytes.
  return strToU8(JSON.stringify(compressed)).length < bytes.length ? compressed : value
}

export function encodeStorageValue(key: string, value: unknown, timestamp = Date.now()): unknown {
  if (isCompactStorageKey(key)) {
    const decoded = decodeStorageValue(key, value)
    return encodeCompactValue(key === 'emojiGroup_favorites' ? packFavoriteGroup(decoded) : decoded)
  }
  return { data: value, timestamp }
}
