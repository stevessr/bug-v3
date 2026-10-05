/**
 * 自动下载存储编码器
 *
 * 高压缩率存储格式：
 * - twimg URL 特定缩减：`https://pbs.twimg.com/media/<id>?format=<f>&name=<n>` → `<id>~<f>~<n>`（69 → 29 字符）
 * - 时间戳排序后按差值（delta）存储，再经 deflate-raw 压缩（v2 UTF-16 打包 / v1 base64url 兜底）
 * - 压缩无收益时回退到明文（v1 base64 会膨胀；v2 打包无膨胀，仅极端体量回退明文）
 *
 * 存储格式（v3）：
 * - `AD3 <UTF-16 15-bit 打包(bit-packed body)>`   — 历史最优（90-bit mediaId + 6-bit tag + varint delta，~586 字节/41 条）
 * - `AD2 <UTF-16 15-bit 打包(deflate-raw(body))>` — v2 行式兜底（~696 字节/41 条）
 * - `AD1 <base64url(deflate-raw(body))>`          — v1 行式兜底
 * - `ADS1 <payload>`                              — 明文设置（payload: `<enable>\u0001<suffixes 逗号连接>`）
 * - 其他（JSON `{data,...}` / 纯对象）              — 旧格式，读取时自动迁移
 */

/** twimg media URL 固定形态：https://pbs.twimg.com/media/<id>?format=<fmt>&name=<name> */
const TWIMG_URL_RE =
  /^https:\/\/pbs\.twimg\.com\/media\/([A-Za-z0-9_-]+)\?format=([a-z0-9]+)&name=([a-z0-9x]+)$/

const COMPRESSED_HISTORY_PREFIX = 'AD1 '
/** UTF-16 15-bit 打包历史前缀（v2）：省去 base64 的 33% 膨胀 */
const PACKED_HISTORY_PREFIX = 'AD2 '
/** bit-packed 历史前缀（v3）：90-bit mediaId + 6-bit tag + varint delta */
const BITPACKED_HISTORY_PREFIX = 'AD3 '
const PLAIN_SETTINGS_PREFIX = 'ADS1 '

/** 条目分隔符 / 键值分隔符（控制字符，压缩后不会与 base64url 冲突） */
const ENTRY_SEP = '\u0001'
const LINE_SEP = '\n'

function isSettingsData(value: unknown): value is Partial<AutoDownloadSettingsData> {
  if (typeof value !== 'object' || value === null) return false
  return 'enableAutoDownload' in value || 'autoDownloadSuffixes' in value
}

export function isTwimgMediaUrl(url: string): boolean {
  return TWIMG_URL_RE.test(url)
}

/**
 * twimg URL 特定缩减：仅保留 media id / format / name
 * 例：`https://pbs.twimg.com/media/HTokOeDbcAARx8A?format=jpg&name=4096x4096` → `HTokOeDbcAARx8A~jpg~4096x4096`
 * 非匹配 URL 原样返回。
 */
export function shortenTwimgUrl(url: string): string {
  const m = url.match(TWIMG_URL_RE)
  if (!m) return url
  return `${m[1]}~${m[2]}~${m[3]}`
}

/** 缩减 token 还原为完整 twimg URL；非 token 原样返回。 */
export function expandTwimgToken(token: string): string {
  const parts = token.split('~')
  if (parts.length !== 3 || !/^[A-Za-z0-9_-]+$/.test(parts[0])) return token
  return `https://pbs.twimg.com/media/${parts[0]}?format=${parts[1]}&name=${parts[2]}`
}

// ── base64url（无填充，URL 安全） ────────────────────────────────────────────

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  const binary = atob(s)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

// ── UTF-16 15-bit 打包 ──────────────────────────────────────────────────────
// 每 15 bit 数据塞进一个 UTF-16 码元的低 15 位，码元范围 0x20..0x801F
// （>= 0x20 避开 C0 控制字符，< 0xD800 不产生代理对）。localStorage 值本身
// 是 UTF-16 存储，每字符 2 字节，15 bit/字符 = 2.13 字节/数据字节，
// 相比 base64url 的 2.67 字节/数据字节再省约 20%。

const PACK15_BASE = 0x20
/** 打包分块大小，避免 String.fromCharCode(...units) 栈溢出 */
const PACK15_CHUNK_UNITS = 8192

function pack15(bytes: Uint8Array): string {
  const parts: string[] = []
  let units: number[] = []
  let acc = 0
  let bits = 0
  for (let i = 0; i < bytes.length; i++) {
    acc |= bytes[i] << bits
    bits += 8
    while (bits >= 15) {
      units.push(PACK15_BASE + (acc & 0x7fff))
      acc >>>= 15
      bits -= 15
      if (units.length >= PACK15_CHUNK_UNITS) {
        parts.push(String.fromCharCode(...units))
        units = []
      }
    }
  }
  if (bits > 0) units.push(PACK15_BASE + (acc & 0x7fff))
  if (units.length > 0) parts.push(String.fromCharCode(...units))
  return parts.join('')
}

function unpack15(s: string): Uint8Array {
  const out = new Uint8Array(Math.floor((s.length * 15) / 8))
  let written = 0
  let acc = 0
  let bits = 0
  for (let i = 0; i < s.length; i++) {
    acc |= (s.charCodeAt(i) - PACK15_BASE) << bits
    bits += 15
    while (bits >= 8) {
      out[written++] = acc & 0xff
      acc >>>= 8
      bits -= 8
    }
  }
  return written === out.length ? out : out.slice(0, written)
}

// ── v3 bit-packed 历史（90-bit mediaId + 6-bit tag + varint delta） ─────────
// twimg mediaId 是 15 字符 base64url（90 bit 真实数据，非 11 字节纯 base64 ——
// 最后字符携带 2 个数据位）。v3 将每条存为：
//   twimg:    [90-bit mediaId][3-bit fmt][3-bit name][varint ts-delta]
//   非 twimg: [96-bit 全零标记][1 字节 urlLen][utf8 url][varint ts-delta]
// 直接 pack15（无需 deflate：bit-packed 后熵已榨干，deflate 反而膨胀）。

/** v3 fmt 3-bit 索引表（0-7） */
const V3_FMT_LIST = ['jpg', 'png', 'gif', 'webp'] as const
/** v3 name 3-bit 索引表（0-7） */
const V3_NAME_LIST = ['large', 'orig', '4096x4096', 'small', 'medium', 'thumb'] as const

/** twimg mediaId 固定长度：15 字符 base64url = 90 bit */
const V3_ID_CHARS = 15
const V3_ID_BITS = V3_ID_CHARS * 6
/** v3 每条 tag 位宽：3-bit fmt + 3-bit name */
const V3_TAG_BITS = 6
/** v3 转义标记位宽：96 bit 全零（12 字节），解码时识别为非 twimg 条目 */
const V3_ESCAPE_BITS = 96
/** v3 body 最大长度守卫（1 MiB），防解压炸弹 */
const V3_MAX_BODY_BYTES = 1024 * 1024

const V3_FMT_INDEX: Record<string, number> = {
  jpg: 0,
  png: 1,
  gif: 2,
  webp: 3
}
const V3_NAME_INDEX: Record<string, number> = {
  large: 0,
  orig: 1,
  '4096x4096': 2,
  small: 3,
  medium: 4,
  thumb: 5
}

/** base64url 字符表（与 twimg mediaId 一致：`-` `_` 替代 `+` `/`） */
const V3_B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

function appendBits(target: number[], value: number, count: number): void {
  for (let i = count - 1; i >= 0; i--) target.push((value >> i) & 1)
}

/** mediaId（15 字符 base64url）→ 90 bit 序列；含非法字符返回 null */
function mediaIdBits(id: string): number[] | null {
  if (id.length !== V3_ID_CHARS) return null
  const bits: number[] = []
  for (let i = 0; i < id.length; i++) {
    const idx = V3_B64URL.indexOf(id[i])
    if (idx < 0) return null
    appendBits(bits, idx, 6)
  }
  return bits
}

/** 90 bit 序列 → mediaId（15 字符 base64url）；位数不足返回 null */
function bitsToMediaId(bits: number[], offset: number): string | null {
  if (offset + V3_ID_BITS > bits.length) return null
  let out = ''
  for (let c = 0; c < V3_ID_CHARS; c++) {
    let idx = 0
    for (let b = 0; b < 6; b++) idx = (idx << 1) | bits[offset + c * 6 + b]
    out += V3_B64URL[idx]
  }
  return out
}

/** 写入 varint（LSB 先行，7 bit 一组，最高位为继续标志）。用 % 128：JS 位运算截断 32 位，会损坏 > 2^31 的时间差 */
function varintBytes(value: number): number[] {
  const out: number[] = []
  let n = value
  do {
    let byte = n % 128
    n = Math.floor(n / 128)
    if (n) byte += 128
    out.push(byte)
  } while (n)
  return out
}

/** 从字节数组读取 varint，返回 [值, 下一偏移]；越界/超长返回 null */
function readVarint(bytes: Uint8Array, offset: number): [number, number] | null {
  let n = 0
  let shift = 0
  let i = offset
  for (;;) {
    if (i >= bytes.length) return null
    const byte = bytes[i++]
    n += (byte & 0x7f) * Math.pow(2, shift)
    if (!(byte & 0x80)) return [n, i]
    shift += 7
    if (shift > 63) return null
  }
}

/** bits 序列 → 字节数组（MSB 先行，末位补零） */
function bitsToBytes(bits: number[]): Uint8Array {
  const out = new Uint8Array(Math.ceil(bits.length / 8))
  for (let i = 0; i < bits.length; i++) {
    if (bits[i]) out[i >> 3] |= 1 << (7 - (i & 7))
  }
  return out
}

/** 字节数组 → bits 序列（MSB 先行） */
function bytesToBits(bytes: Uint8Array): number[] {
  const bits: number[] = []
  for (let i = 0; i < bytes.length; i++) {
    for (let b = 7; b >= 0; b--) bits.push((bytes[i] >> b) & 1)
  }
  return bits
}

/**
 * v3 编码：bit-packed body。
 * 输入已按时间戳升序排列的条目。返回原始字节（调用方负责 pack15）。
 */
function encodeBitPackedBody(entries: Array<[string, number]>): Uint8Array {
  const bits: number[] = []
  const tail: number[] = []
  let prev = 0

  for (const [url, ts] of entries) {
    const delta = ts - prev
    prev = ts

    const m = url.match(TWIMG_URL_RE)
    if (m) {
      const idBitsArr = mediaIdBits(m[1])
      const fmtIdx = V3_FMT_INDEX[m[2]]
      const nameIdx = V3_NAME_INDEX[m[3]]
      if (idBitsArr && fmtIdx !== undefined && nameIdx !== undefined) {
        bits.push(...idBitsArr)
        appendBits(bits, fmtIdx, 3)
        appendBits(bits, nameIdx, 3)
        tail.push(...varintBytes(delta))
        continue
      }
    }

    // 非 twimg / 非规范形态：96-bit 全零转义标记 + [urlLen][utf8 url][varint delta]
    appendBits(bits, 0, V3_ESCAPE_BITS)
    const urlBytes = new TextEncoder().encode(url)
    tail.push(urlBytes.length, ...urlBytes, ...varintBytes(delta))
  }

  return new Uint8Array([...bitsToBytes(bits), ...tail])
}

// ── deflate-raw 流式压缩 ────────────────────────────────────────────────────

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate-raw') as ReadableWritablePair<Uint8Array, Uint8Array>
  const writer = cs.writable.getWriter()
  writer.write(bytes)
  writer.close()
  return readAll(cs.readable)
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw') as ReadableWritablePair<Uint8Array, Uint8Array>
  const writer = ds.writable.getWriter()
  writer.write(bytes)
  writer.close()
  return readAll(ds.readable)
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = []
  let total = 0
  const reader = stream.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    total += value.byteLength
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

// ── 历史编解码 ───────────────────────────────────────────────────────────────

/**
 * 编码历史记录（Map<string, number>，key 为完整 URL）。
 * twimg URL 先缩减，按时间戳升序排列后每条只存与前一条的差值。
 * v3：bit-packed（90-bit mediaId + 6-bit tag + varint delta）直接 pack15；
 * v2：行式 deflate-raw + pack15 兜底；再退 v1 base64url、明文行。
 */
export async function encodeHistory(history: Map<string, number>): Promise<string> {
  const entries = Array.from(history.entries()).sort((a, b) => a[1] - b[1])

  // v3 bit-packed（无 deflate：熵已榨干，deflate 反而膨胀）
  const v3 = BITPACKED_HISTORY_PREFIX + pack15(encodeBitPackedBody(entries))
  if (v3.length < computePlainBodyLength(entries)) return v3

  let prev = 0
  const lines = entries.map(([url, ts]) => {
    const delta = ts - prev
    prev = ts
    return `${shortenTwimgUrl(url)}${ENTRY_SEP}${delta}`
  })
  const body = lines.join(LINE_SEP)

  if (typeof CompressionStream === 'undefined') {
    return body
  }

  try {
    const deflated = await deflateRaw(new TextEncoder().encode(body))
    // v2 UTF-16 15-bit 打包（每字符 2 字节存储，15 bit 数据）
    const packed = PACKED_HISTORY_PREFIX + pack15(deflated)
    if (packed.length < body.length) return packed
    // v1 base64url 兜底对比
    const v1 = COMPRESSED_HISTORY_PREFIX + bytesToBase64Url(deflated)
    // 压缩无收益时回退明文
    return v1.length < body.length ? v1 : body
  } catch {
    return body
  }
}

/** 明文行格式体量（用于 v3 收益判断） */
function computePlainBodyLength(entries: Array<[string, number]>): number {
  let prev = 0
  let total = 0
  for (const [url, ts] of entries) {
    const delta = ts - prev
    prev = ts
    total += shortenTwimgUrl(url).length + 1 + String(delta).length + 1
  }
  return Math.max(total - 1, 0)
}

/**
 * 解码历史记录。支持：
 * - `AD3 ` bit-packed 格式（unpack15 + 还原 90-bit mediaId + varint delta 还原绝对时间戳）
 * - `AD2 ` UTF-16 15-bit 打包格式（unpack + inflate + 行式还原）
 * - `AD1 ` base64url 压缩格式
 * - 明文行格式（`<token|url>\u0001<ts>`）
 * - 旧 JSON 格式（`{data: {...}}` 或直接对象）
 */
export async function decodeHistory(stored: string): Promise<Map<string, number>> {
  if (!stored) return new Map()

  if (stored.startsWith(BITPACKED_HISTORY_PREFIX)) {
    try {
      const bytes = unpack15(stored.slice(BITPACKED_HISTORY_PREFIX.length))
      return parseBitPackedBody(bytes)
    } catch {
      return new Map()
    }
  }

  if (stored.startsWith(PACKED_HISTORY_PREFIX)) {
    try {
      const bytes = unpack15(stored.slice(PACKED_HISTORY_PREFIX.length))
      const body = new TextDecoder().decode(await inflateRaw(bytes))
      return parseHistoryLines(body)
    } catch {
      return new Map()
    }
  }

  if (stored.startsWith(COMPRESSED_HISTORY_PREFIX)) {
    try {
      const bytes = base64UrlToBytes(stored.slice(COMPRESSED_HISTORY_PREFIX.length))
      const body = new TextDecoder().decode(await inflateRaw(bytes))
      return parseHistoryLines(body)
    } catch {
      return new Map()
    }
  }

  // 明文行格式：首行即含 \u0001 或不以 '{' 开头
  if (!stored.startsWith('{') && stored.includes(ENTRY_SEP)) {
    return parseHistoryLines(stored)
  }

  // 旧 JSON 格式
  try {
    const parsed: unknown = JSON.parse(stored)
    const data =
      parsed && typeof parsed === 'object' && 'data' in parsed
        ? (parsed as { data: unknown }).data
        : parsed
    if (typeof data !== 'object' || data === null) return new Map()
    const map = new Map<string, number>()
    for (const [url, ts] of Object.entries(data)) {
      if (typeof ts === 'number') map.set(url, ts)
    }
    return map
  } catch {
    return new Map()
  }
}

/** 解析明文行：每行 `<token|url>\u0001<delta|absolute ts>`，按行序还原时间戳。 */
function parseHistoryLines(body: string): Map<string, number> {
  const map = new Map<string, number>()
  let prev = 0
  for (const line of body.split(LINE_SEP)) {
    if (!line) continue
    const sepIdx = line.indexOf(ENTRY_SEP)
    if (sepIdx <= 0) continue
    const token = line.slice(0, sepIdx)
    const rawTs = line.slice(sepIdx + 1)
    const ts = Number(rawTs)
    if (!Number.isFinite(ts)) continue
    // v1 格式按时间戳升序存储，存储的是与上一条的差值
    const absolute = prev + ts
    prev = absolute
    map.set(expandTwimgToken(token), absolute)
  }
  return map
}

/**
 * 解析 v3 bit-packed body：
 * 每条 twimg：[90-bit mediaId][3-bit fmt][3-bit name][varint delta]
 * 每条非 twimg：[96-bit 全零标记][1 字节 urlLen][utf8 url][varint delta]
 * head 区 = 条目数 * 96 bit，tail 按条目顺序消费 varint。条目数未知，
 * 从最大 96 对齐候选向下试探第一个使全部条目消费自洽且恰好到达末尾的切分。
 * 损坏数据（越界/超长/超限）返回空 Map。
 */
function parseBitPackedBody(bytes: Uint8Array): Map<string, number> {
  if (bytes.length === 0 || bytes.length > V3_MAX_BODY_BYTES) return new Map()

  const bits = bytesToBits(bytes)
  const headEntryBits = V3_ID_BITS + V3_TAG_BITS // 96 bit
  const maxEntries = Math.floor(bits.length / headEntryBits)
  for (let candidate = maxEntries; candidate >= 0; candidate--) {
    const result = tryParseBitPackedEntries(bits, bytes, candidate)
    if (result) return result
  }
  return new Map()
}

/**
 * 以给定条目数解析 v3 body：head = entryCount * 96 bit，tail 按条目顺序消费。
 * 全部条目消费自洽且恰好到达末尾时返回 Map，否则返回 null。
 */
function tryParseBitPackedEntries(
  bits: number[],
  bytes: Uint8Array,
  entryCount: number
): Map<string, number> | null {
  const headBitsLen = entryCount * (V3_ID_BITS + V3_TAG_BITS)
  const map = new Map<string, number>()
  let prev = 0
  let byteOffset = headBitsLen / 8

  for (let e = 0; e < entryCount; e++) {
    const bitOffset = e * (V3_ID_BITS + V3_TAG_BITS)

    // 检查 96-bit 块是否全零（非 twimg 转义标记）
    let allZero = true
    for (let b = 0; b < V3_ESCAPE_BITS; b++) {
      if (bits[bitOffset + b]) {
        allZero = false
        break
      }
    }

    if (allZero) {
      // 非 twimg：[1 字节 urlLen][utf8 url][varint delta]
      if (byteOffset >= bytes.length) return null
      const urlLen = bytes[byteOffset]
      if (byteOffset + 1 + urlLen > bytes.length) return null
      const url = new TextDecoder().decode(bytes.slice(byteOffset + 1, byteOffset + 1 + urlLen))
      const r = readVarint(bytes, byteOffset + 1 + urlLen)
      if (!r) return null
      const [delta, next] = r
      prev += delta
      map.set(url, prev)
      byteOffset = next
    } else {
      const r = readVarint(bytes, byteOffset)
      if (!r) return null
      const [delta, next] = r
      prev += delta

      const id = bitsToMediaId(bits, bitOffset)
      if (!id) return null
      let fmtIdx = 0
      let nameIdx = 0
      for (let b = 0; b < 3; b++) {
        fmtIdx = (fmtIdx << 1) | bits[bitOffset + V3_ID_BITS + b]
        nameIdx = (nameIdx << 1) | bits[bitOffset + V3_ID_BITS + 3 + b]
      }
      const fmt = V3_FMT_LIST[fmtIdx]
      const name = V3_NAME_LIST[nameIdx]
      if (!fmt || !name) return null
      map.set(`https://pbs.twimg.com/media/${id}?format=${fmt}&name=${name}`, prev)
      byteOffset = next
    }
  }

  // tail 必须恰好消费到末尾（pack15 位填充可能多出 1 个尾部 0x00 字节）
  if (byteOffset !== bytes.length) {
    const padded = bytes.length - 1
    if (byteOffset !== padded || bytes[padded] !== 0) return null
  }
  return map
}

// ── 设置编解码 ───────────────────────────────────────────────────────────────

export interface AutoDownloadSettingsData {
  enableAutoDownload: boolean
  autoDownloadSuffixes: string[]
}

/**
 * 编码设置为明文紧凑格式：`ADS1 <enable>\u0001<suffixes 逗号连接>`
 * 例：`ADS1 1\u0001name=large,name=4096x4096`（34 字节 vs 旧 JSON 117 字节）
 */
export function encodeSettings(settings: AutoDownloadSettingsData): string {
  const suffixes = Array.isArray(settings.autoDownloadSuffixes)
    ? settings.autoDownloadSuffixes.filter(Boolean)
    : []
  return `${PLAIN_SETTINGS_PREFIX}${settings.enableAutoDownload ? 1 : 0}${ENTRY_SEP}${suffixes.join(',')}`
}

/**
 * 解码设置。支持：
 * - `ADS1 ` 明文紧凑格式
 * - 旧 JSON 格式（`{data: {...}}` 或直接对象）
 * - 旧分离存储（autoDownloadSuffixes 可能为 JSON 字符串或逗号分隔字符串）
 */
export function decodeSettings(
  stored: string | null,
  defaults: AutoDownloadSettingsData
): AutoDownloadSettingsData {
  if (stored && stored.startsWith(PLAIN_SETTINGS_PREFIX)) {
    const payload = stored.slice(PLAIN_SETTINGS_PREFIX.length)
    const sepIdx = payload.indexOf(ENTRY_SEP)
    if (sepIdx >= 0) {
      const enable = payload.slice(0, sepIdx) === '1'
      const suffixes = parseSuffixList(payload.slice(sepIdx + 1))
      return { enableAutoDownload: enable, autoDownloadSuffixes: suffixes }
    }
  }

  if (stored) {
    // 旧 JSON 格式
    try {
      const parsed: unknown = JSON.parse(stored)
      const data =
        parsed && typeof parsed === 'object' && 'data' in parsed
          ? (parsed as { data: unknown }).data
          : parsed
      if (isSettingsData(data)) {
        return {
          enableAutoDownload: data.enableAutoDownload ?? defaults.enableAutoDownload,
          autoDownloadSuffixes: parseSuffixList(
            data.autoDownloadSuffixes,
            defaults.autoDownloadSuffixes
          )
        }
      }
    } catch {
      // 非 JSON，忽略，使用默认值
    }
  }

  return { ...defaults }
}

/** 解析后缀列表：数组原样；JSON 字符串解析；逗号分隔切分。空值回退默认。 */
function parseSuffixList(raw: unknown, defaults?: string[]): string[] {
  let suffixes: string[] | string = []
  if (typeof raw === 'string') {
    try {
      suffixes = JSON.parse(raw) as unknown as string[]
    } catch {
      suffixes = raw.split(',').map(s => s.trim())
    }
  } else if (Array.isArray(raw)) {
    suffixes = raw
  }
  if (Array.isArray(suffixes)) {
    const list = suffixes.filter((s): s is string => typeof s === 'string' && !!s)
    if (list.length > 0) return list
  }
  return defaults ? [...defaults] : []
}
