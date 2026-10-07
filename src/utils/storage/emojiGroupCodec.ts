import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate'

const PREFIX = 'eg1:'
export const isEmojiGroupStorageKey = (key: string) => key.startsWith('emojiGroup_')

const toBase64 = (bytes: Uint8Array) => {
  const parts: string[] = []
  for (let i = 0; i < bytes.length; i += 0x8000) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + 0x8000)))
  }
  return btoa(parts.join(''))
}

// Read legacy {data,timestamp}, plain groups and versioned compressed groups.
export function decodeStorageValue(key: string, value: unknown): any {
  const unpacked =
    value && typeof value === 'object' && 'data' in value
      ? (value as { data: unknown }).data
      : value
  if (isEmojiGroupStorageKey(key) && typeof unpacked === 'string') {
    if (unpacked.startsWith(PREFIX)) {
      const bytes = Uint8Array.from(atob(unpacked.slice(PREFIX.length)), char => char.charCodeAt(0))
      const group = JSON.parse(strFromU8(inflateSync(bytes)))
      if (!group || typeof group !== 'object' || !Array.isArray(group.emojis))
        throw new Error('Invalid compressed emoji group')
      return group
    }
    if (/^eg\d+:/.test(unpacked)) throw new Error('Unsupported emoji group storage version')
  }
  return unpacked ?? null
}

// Tiny groups stay as plain objects, with no data/timestamp envelope. Compress only
// when the actual persisted JSON is smaller (Base64's overhead is included).
export function encodeEmojiGroupValue(value: unknown): unknown {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { emojis?: unknown }).emojis))
    return value
  const json = JSON.stringify(value)
  const bytes = strToU8(json)
  if (bytes.length < 1024) return value
  const compressed = PREFIX + toBase64(deflateSync(bytes, { level: 9 }))
  return strToU8(JSON.stringify(compressed)).length < bytes.length ? compressed : value
}

export function encodeStorageValue(key: string, value: unknown, timestamp = Date.now()): unknown {
  if (isEmojiGroupStorageKey(key)) return encodeEmojiGroupValue(decodeStorageValue(key, value))
  return { data: value, timestamp }
}
