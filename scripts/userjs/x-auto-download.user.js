// ==UserScript==
// @name         X.com Auto Download
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Automatically download images from X.com based on configured suffixes
// @author       Code
// @match        https://x.com/*
// @match        https://twitter.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_download
// @grant        GM_registerMenuCommand
// ==/UserScript==

;(function () {
  'use strict'

  // --- Utils ---
  function normalizeUrl(raw) {
    if (!raw) return null
    raw = raw.trim()
    const urlMatch = raw.match(/url\((?:\s*['"]?)(.*?)(?:['"]?\s*)\)/)
    if (urlMatch) raw = urlMatch[1]
    if (raw.startsWith('//')) raw = 'https:' + raw
    else if (raw.startsWith('/')) raw = window.location.origin + raw

    if (raw.includes(',')) raw = raw.split(',')[0]
    raw = raw.split(' ')[0]
    raw = raw.replace(/:large$|:orig$/i, '')

    if (!/^https?:\/\//i.test(raw)) return null

    try {
      const u = new URL(raw)
      const host = u.hostname.toLowerCase()
      const allowed = ['pbs.twimg.com', 'twimg.com', 'twitter.com', 'x.com', 'pbs.twimg']
      const ok = allowed.some(a => host.endsWith(a) || host.includes(a))
      if (!ok) return null
    } catch {
      return null
    }

    return raw
  }

  // --- Storage codec (与扩展 storageCodec.ts 相同的 v3 格式) ---
  // twimg URL 缩减 + 时间戳差值；v3 bit-packed（90-bit ID + 6-bit tag + varint delta）
  // 直接 pack15；v2 行式 deflate + pack15 兜底；再退 v1 base64url、明文行。
  const TWIMG_URL_RE =
    /^https:\/\/pbs\.twimg\.com\/media\/([A-Za-z0-9_-]+)\?format=([a-z0-9]+)&name=([a-z0-9x]+)$/
  const COMPRESSED_HISTORY_PREFIX = 'AD1 '
  const PACKED_HISTORY_PREFIX = 'AD2 '
  const BITPACKED_HISTORY_PREFIX = 'AD3 '
  const PLAIN_SETTINGS_PREFIX = 'ADS1 '
  const ENTRY_SEP = '\u0001'
  const LINE_SEP = '\n'
  const PACK15_BASE = 0x20
  const PACK15_CHUNK_UNITS = 8192
  // v3 常量
  const V3_FMT_LIST = ['jpg', 'png', 'gif', 'webp']
  const V3_NAME_LIST = ['large', 'orig', '4096x4096', 'small', 'medium', 'thumb']
  const V3_ID_CHARS = 15
  const V3_ID_BITS = V3_ID_CHARS * 6
  const V3_TAG_BITS = 6
  const V3_ESCAPE_BITS = 96
  const V3_MAX_BODY_BYTES = 1024 * 1024
  const V3_B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  const V3_FMT_INDEX = { jpg: 0, png: 1, gif: 2, webp: 3 }
  const V3_NAME_INDEX = { large: 0, orig: 1, '4096x4096': 2, small: 3, medium: 4, thumb: 5 }

  function shortenTwimgUrl(url) {
    const m = url.match(TWIMG_URL_RE)
    if (!m) return url
    return `${m[1]}~${m[2]}~${m[3]}`
  }

  function expandTwimgToken(token) {
    const parts = token.split('~')
    if (parts.length !== 3 || !/^[A-Za-z0-9_-]+$/.test(parts[0])) return token
    return `https://pbs.twimg.com/media/${parts[0]}?format=${parts[1]}&name=${parts[2]}`
  }

  function bytesToBase64Url(bytes) {
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  function base64UrlToBytes(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/')
    while (s.length % 4) s += '='
    const binary = atob(s)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  }

  async function readAllBytes(stream) {
    const chunks = []
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

  async function deflateRawBytes(bytes) {
    const cs = new CompressionStream('deflate-raw')
    const writer = cs.writable.getWriter()
    writer.write(bytes)
    writer.close()
    return readAllBytes(cs.readable)
  }

  async function inflateRawBytes(bytes) {
    const ds = new DecompressionStream('deflate-raw')
    const writer = ds.writable.getWriter()
    writer.write(bytes)
    writer.close()
    return readAllBytes(ds.readable)
  }

  function parseHistoryLines(body) {
    const map = {}
    let prev = 0
    for (const line of body.split(LINE_SEP)) {
      if (!line) continue
      const sepIdx = line.indexOf(ENTRY_SEP)
      if (sepIdx <= 0) continue
      const token = line.slice(0, sepIdx)
      const ts = Number(line.slice(sepIdx + 1))
      if (!Number.isFinite(ts)) continue
      const absolute = prev + ts
      prev = absolute
      map[expandTwimgToken(token)] = absolute
    }
    return map
  }

  function pack15(bytes) {
    const parts = []
    let units = []
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

  function unpack15(s) {
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

  // --- v3 bit-packed helpers ---
  function appendBits(target, value, count) {
    for (let i = count - 1; i >= 0; i--) target.push((value >> i) & 1)
  }

  function mediaIdBits(id) {
    if (id.length !== V3_ID_CHARS) return null
    const bits = []
    for (let i = 0; i < id.length; i++) {
      const idx = V3_B64URL.indexOf(id[i])
      if (idx < 0) return null
      appendBits(bits, idx, 6)
    }
    return bits
  }

  function bitsToMediaId(bits, offset) {
    if (offset + V3_ID_BITS > bits.length) return null
    let out = ''
    for (let c = 0; c < V3_ID_CHARS; c++) {
      let idx = 0
      for (let b = 0; b < 6; b++) idx = (idx << 1) | bits[offset + c * 6 + b]
      out += V3_B64URL[idx]
    }
    return out
  }

  function varintBytes(value) {
    const out = []
    let n = value
    do {
      let byte = n % 128
      n = Math.floor(n / 128)
      if (n) byte += 128
      out.push(byte)
    } while (n)
    return out
  }

  function readVarint(bytes, offset) {
    let n = 0
    let shift = 0
    let i = offset
    for (;;) {
      if (i >= bytes.length) return null
      const byte = bytes[i++]
      n += (byte % 128) * Math.pow(2, shift)
      if (byte < 128) return [n, i]
      shift += 7
      if (shift > 63) return null
    }
  }

  function bitsToBytes(bits) {
    const out = new Uint8Array(Math.ceil(bits.length / 8))
    for (let i = 0; i < bits.length; i++) {
      if (bits[i]) out[i >> 3] |= 1 << (7 - (i & 7))
    }
    return out
  }

  function bytesToBits(bytes) {
    const bits = []
    for (let i = 0; i < bytes.length; i++) {
      for (let b = 7; b >= 0; b--) bits.push((bytes[i] >> b) & 1)
    }
    return bits
  }

  function encodeBitPackedBody(entries) {
    const bits = []
    const tail = []
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

  function tryParseBitPackedEntries(bits, bytes, entryCount) {
    const headEntryBits = V3_ID_BITS + V3_TAG_BITS
    const headBitsLen = entryCount * headEntryBits
    const map = {}
    let prev = 0
    let byteOffset = headBitsLen / 8

    for (let e = 0; e < entryCount; e++) {
      const bitOffset = e * headEntryBits

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
        prev += r[0]
        map[url] = prev
        byteOffset = r[1]
      } else {
        const r = readVarint(bytes, byteOffset)
        if (!r) return null
        const delta = r[0]
        byteOffset = r[1]
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
        map[`https://pbs.twimg.com/media/${id}?format=${fmt}&name=${name}`] = prev
      }
    }

    // tail 必须恰好消费到末尾（pack15 位填充可能多出 1 个尾部 0x00 字节）
    if (byteOffset !== bytes.length) {
      const padded = bytes.length - 1
      if (byteOffset !== padded || bytes[padded] !== 0) return null
    }
    return map
  }

  function parseBitPackedBody(bytes) {
    if (bytes.length === 0 || bytes.length > V3_MAX_BODY_BYTES) return {}
    const bits = bytesToBits(bytes)
    const headEntryBits = V3_ID_BITS + V3_TAG_BITS
    const maxEntries = Math.floor(bits.length / headEntryBits)
    for (let candidate = maxEntries; candidate >= 0; candidate--) {
      const result = tryParseBitPackedEntries(bits, bytes, candidate)
      if (result) return result
    }
    return {}
  }

  async function encodeHistoryAsync(historyObj) {
    const entries = Object.entries(historyObj).sort((a, b) => a[1] - b[1])

    // v3 bit-packed（无 deflate：熵已榨干，deflate 反而膨胀）
    const v3 = BITPACKED_HISTORY_PREFIX + pack15(encodeBitPackedBody(entries))
    let plainLen = 0
    let pv = 0
    for (const [url, ts] of entries) {
      const delta = ts - pv
      pv = ts
      plainLen += shortenTwimgUrl(url).length + 1 + String(delta).length + 1
    }
    plainLen = Math.max(plainLen - 1, 0)
    if (v3.length < plainLen) return v3

    let prev = 0
    const lines = entries.map(([url, ts]) => {
      const delta = ts - prev
      prev = ts
      return `${shortenTwimgUrl(url)}${ENTRY_SEP}${delta}`
    })
    const body = lines.join(LINE_SEP)
    if (typeof CompressionStream === 'undefined') return body
    try {
      const deflated = await deflateRawBytes(new TextEncoder().encode(body))
      // v2 UTF-16 15-bit 打包（每字符 2 字节存储，15 bit 数据）
      const packed = PACKED_HISTORY_PREFIX + pack15(deflated)
      if (packed.length < body.length) return packed
      // v1 base64url 兜底对比
      const v1 = COMPRESSED_HISTORY_PREFIX + bytesToBase64Url(deflated)
      return v1.length < body.length ? v1 : body
    } catch {
      return body
    }
  }

  async function decodeHistoryAsync(stored) {
    if (!stored) return {}
    if (stored.startsWith(BITPACKED_HISTORY_PREFIX)) {
      try {
        const bytes = unpack15(stored.slice(BITPACKED_HISTORY_PREFIX.length))
        return parseBitPackedBody(bytes)
      } catch {
        return {}
      }
    }
    if (stored.startsWith(PACKED_HISTORY_PREFIX)) {
      try {
        const bytes = unpack15(stored.slice(PACKED_HISTORY_PREFIX.length))
        const body = new TextDecoder().decode(await inflateRawBytes(bytes))
        return parseHistoryLines(body)
      } catch {
        return {}
      }
    }
    if (stored.startsWith(COMPRESSED_HISTORY_PREFIX)) {
      try {
        const bytes = base64UrlToBytes(stored.slice(COMPRESSED_HISTORY_PREFIX.length))
        const body = new TextDecoder().decode(await inflateRawBytes(bytes))
        return parseHistoryLines(body)
      } catch {
        return {}
      }
    }
    if (!stored.startsWith('{') && stored.includes(ENTRY_SEP)) {
      return parseHistoryLines(stored)
    }
    try {
      const parsed = JSON.parse(stored)
      const data = parsed && typeof parsed === 'object' ? (parsed.data ?? parsed) : null
      if (typeof data !== 'object' || data === null) return {}
      const map = {}
      for (const [url, ts] of Object.entries(data)) {
        if (typeof ts === 'number') map[url] = ts
      }
      return map
    } catch {
      return {}
    }
  }

  // --- AutoDownloadManager ---
  class AutoDownloadManager {
    constructor() {
      this.DOWNLOAD_HISTORY_KEY = 'x-autodownload-history'
      this.HISTORY_EXPIRY_TIME = 24 * 60 * 60 * 1000 // 24 hours
      this.settings = this.loadSettings()
      this.historyReady = this.loadHistory()
      this.cleanExpiredHistory()
    }

    async loadHistory() {
      try {
        const stored = GM_getValue(this.DOWNLOAD_HISTORY_KEY, '')
        this.historyObj = await decodeHistoryAsync(stored)
        this.cleanExpiredHistory()
      } catch (error) {
        console.error('[AutoDownloadManager] Failed to load history:', error)
        this.historyObj = {}
      }
    }

    loadSettings() {
      const defaults = ['name=large', 'name=4096x4096']
      const stored = GM_getValue('x-autodownload-settings', '')
      if (stored && stored.startsWith(PLAIN_SETTINGS_PREFIX)) {
        const payload = stored.slice(PLAIN_SETTINGS_PREFIX.length)
        const sepIdx = payload.indexOf(ENTRY_SEP)
        if (sepIdx >= 0) {
          return {
            enableAutoDownload: payload.slice(0, sepIdx) === '1',
            autoDownloadSuffixes: this.parseSuffixList(payload.slice(sepIdx + 1), defaults)
          }
        }
      }

      // 旧分离存储（GM keys）与新 JSON 格式兼容读取
      let suffixes = GM_getValue('autoDownloadSuffixes', defaults)
      if (typeof suffixes === 'string') {
        try {
          suffixes = JSON.parse(suffixes)
        } catch {
          suffixes = suffixes.split(',').map(s => s.trim())
        }
      }
      if (!Array.isArray(suffixes)) suffixes = defaults

      return {
        enableAutoDownload: GM_getValue('enableAutoDownload', false),
        autoDownloadSuffixes: suffixes
      }
    }

    parseSuffixList(raw, defaults) {
      let suffixes = raw
      if (typeof suffixes === 'string') {
        try {
          suffixes = JSON.parse(suffixes)
        } catch {
          suffixes = suffixes.split(',').map(s => s.trim())
        }
      }
      if (Array.isArray(suffixes)) {
        const list = suffixes.filter(s => typeof s === 'string' && !!s)
        if (list.length > 0) return list
      }
      return [...defaults]
    }

    updateSettings(key, value) {
      this.settings[key] = value
      // v1 明文紧凑格式：ADS1 <enable>\u0001<suffixes 逗号连接>
      const suffixes = Array.isArray(this.settings.autoDownloadSuffixes)
        ? this.settings.autoDownloadSuffixes.filter(Boolean)
        : []
      const encoded = `${PLAIN_SETTINGS_PREFIX}${this.settings.enableAutoDownload ? 1 : 0}${ENTRY_SEP}${suffixes.join(',')}`
      GM_setValue('x-autodownload-settings', encoded)
    }

    cleanExpiredHistory() {
      try {
        const history = this.historyObj || {}
        const now = Date.now()
        let changed = false

        for (const [url, timestamp] of Object.entries(history)) {
          if (now - timestamp >= this.HISTORY_EXPIRY_TIME) {
            delete history[url]
            changed = true
          }
        }

        if (changed) this.saveHistoryObj(history)
      } catch (error) {
        console.error('[AutoDownloadManager] Failed to clean history:', error)
      }
    }

    async saveHistoryObj(historyObj) {
      try {
        this.historyObj = historyObj
        GM_setValue(this.DOWNLOAD_HISTORY_KEY, await encodeHistoryAsync(historyObj))
      } catch (error) {
        console.error('[AutoDownloadManager] Failed to save history:', error)
      }
    }

    addToHistory(url) {
      try {
        const history = this.historyObj || {}
        history[url] = Date.now()
        this.saveHistoryObj(history)
      } catch (error) {
        console.error('[AutoDownloadManager] Failed to add to history:', error)
      }
    }

    isInHistory(url) {
      try {
        const history = this.historyObj || {}
        const timestamp = history[url]
        if (!timestamp) return false

        const now = Date.now()
        if (now - timestamp < this.HISTORY_EXPIRY_TIME) {
          return true
        } else {
          delete history[url]
          this.saveHistoryObj(history)
          return false
        }
      } catch (error) {
        console.error('[AutoDownloadManager] Failed to check history:', error)
        return false
      }
    }

    shouldDownload(url) {
      if (!this.settings.enableAutoDownload) return false
      if (this.isInHistory(url)) return false

      const suffixes = Array.isArray(this.settings.autoDownloadSuffixes)
        ? this.settings.autoDownloadSuffixes
        : []

      if (suffixes.length === 0) return false

      const decodedUrl = decodeURIComponent(url)

      return suffixes.some(suffix => {
        if (!suffix) return false
        return decodedUrl.includes(suffix)
      })
    }

    triggerAutoDownload(imageUrl) {
      if (!this.shouldDownload(imageUrl)) return

      console.log(`[AutoDownloadManager] Triggering download for: ${imageUrl}`)
      this.addToHistory(imageUrl)

      let filename = 'image'
      try {
        const parsedUrl = new URL(imageUrl)
        const pathname = parsedUrl.pathname
        const lastSegment = pathname.split('/').pop()
        if (lastSegment) {
          filename = lastSegment
        }
        const format = parsedUrl.searchParams.get('format')
        if (format && !filename.includes(`.${format}`)) {
          filename += `.${format}`
        }
      } catch (e) {
        console.warn('[AutoDownloadManager] Failed to parse URL for filename:', e)
      }

      GM_download({
        url: imageUrl,
        name: filename,
        onload: () => console.log(`[AutoDownloadManager] Download success: ${imageUrl}`),
        onerror: err => console.error(`[AutoDownloadManager] Download failed: ${imageUrl}`, err)
      })
    }
  }

  const autoDownloadManager = new AutoDownloadManager()

  // --- Settings UI ---
  class SettingsUI {
    constructor(manager) {
      this.manager = manager
      this.menuElement = null
      this.init()
    }

    init() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.inject())
      } else {
        this.inject()
      }
    }

    inject() {
      if (document.getElementById('x-autodownload-toggle')) return
      const toggleButton = this.createToggleButton()
      document.body.appendChild(toggleButton)
    }

    createToggleButton() {
      const button = document.createElement('div')
      button.id = 'x-autodownload-toggle'
      button.innerHTML = '⚙️'
      button.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                width: 40px;
                height: 40px;
                background: white;
                border: 1px solid #e1e8ed;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                font-size: 16px;
                transition: all 0.2s ease;
            `
      button.addEventListener('mouseenter', () => {
        button.style.transform = 'scale(1.1)'
        button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
      })
      button.addEventListener('mouseleave', () => {
        button.style.transform = 'scale(1)'
        button.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)'
      })
      button.addEventListener('click', () => this.toggleMenu())
      return button
    }

    createSettingsMenu() {
      const menu = document.createElement('div')
      menu.id = 'x-autodownload-settings-menu'
      menu.style.cssText = `
                position: fixed;
                top: 20px;
                right: 70px;
                z-index: 10000;
                background: white;
                border: 1px solid #e1e8ed;
                border-radius: 12px;
                padding: 16px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 14px;
                width: 320px;
                display: none;
                color: #0f1419;
            `

      const title = document.createElement('div')
      title.textContent = 'Auto Download Settings'
      title.style.fontWeight = '700'
      title.style.marginBottom = '16px'
      title.style.fontSize = '16px'
      menu.appendChild(title)

      // --- Enable Switch ---
      const switchContainer = document.createElement('div')
      switchContainer.style.display = 'flex'
      switchContainer.style.alignItems = 'center'
      switchContainer.style.marginBottom = '16px'

      const switchLabel = document.createElement('label')
      switchLabel.style.cssText =
        'display: flex; align-items: center; cursor: pointer; flex: 1; user-select: none;'

      const switchInput = document.createElement('input')
      switchInput.type = 'checkbox'
      switchInput.checked = this.manager.settings.enableAutoDownload
      switchInput.style.marginRight = '8px'

      switchLabel.appendChild(switchInput)
      switchLabel.appendChild(document.createTextNode('Enable Auto Download'))
      switchContainer.appendChild(switchLabel)
      menu.appendChild(switchContainer)

      // --- Suffix List Section ---
      const suffixSection = document.createElement('div')
      suffixSection.id = 'suffix-section'

      const suffixLabel = document.createElement('div')
      suffixLabel.textContent = 'URL Suffixes:'
      suffixLabel.style.cssText =
        'font-size: 13px; font-weight: 600; color: #536471; margin-bottom: 8px;'
      suffixSection.appendChild(suffixLabel)

      // List Container (Tags)
      const listContainer = document.createElement('div')
      listContainer.style.cssText = `
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                margin-bottom: 12px;
                max-height: 200px;
                overflow-y: auto;
            `
      suffixSection.appendChild(listContainer)

      // Input Row
      const inputRow = document.createElement('div')
      inputRow.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px;'

      const inputField = document.createElement('input')
      inputField.type = 'text'
      inputField.placeholder = 'Add suffix (e.g. name=large)'
      inputField.style.cssText = `
                flex: 1;
                padding: 6px 10px;
                border: 1px solid #cfd9de;
                border-radius: 4px;
                font-size: 13px;
                outline: none;
            `
      inputField.addEventListener('focus', () => (inputField.style.borderColor = '#1d9bf0'))
      inputField.addEventListener('blur', () => (inputField.style.borderColor = '#cfd9de'))

      const addBtn = document.createElement('button')
      addBtn.textContent = 'Add'
      addBtn.style.cssText = `
                padding: 6px 12px;
                background: #0f1419;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 600;
                font-size: 13px;
            `

      // Logic to add item
      const addItem = () => {
        const val = inputField.value.trim()
        if (!val) return

        const current = [...this.manager.settings.autoDownloadSuffixes]
        if (!current.includes(val)) {
          current.push(val)
          this.manager.updateSettings('autoDownloadSuffixes', current)
          renderList()
          inputField.value = ''
        }
      }

      addBtn.addEventListener('click', addItem)
      inputField.addEventListener('keypress', e => {
        if (e.key === 'Enter') addItem()
      })

      inputRow.appendChild(inputField)
      inputRow.appendChild(addBtn)
      suffixSection.appendChild(inputRow)
      menu.appendChild(suffixSection)

      // --- Render Logic ---
      const renderList = () => {
        listContainer.innerHTML = ''
        const suffixes = this.manager.settings.autoDownloadSuffixes

        if (suffixes.length === 0) {
          const emptyMsg = document.createElement('div')
          emptyMsg.textContent = 'No suffixes configured'
          emptyMsg.style.cssText =
            'color: #999; font-style: italic; font-size: 12px; padding: 4px 0;'
          listContainer.appendChild(emptyMsg)
          return
        }

        suffixes.forEach((suffix, index) => {
          const tag = document.createElement('div')
          tag.style.cssText = `
                        background: #eff3f4;
                        border: 1px solid #cfd9de;
                        border-radius: 16px;
                        padding: 4px 10px;
                        font-size: 12px;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                    `

          const text = document.createElement('span')
          text.textContent = suffix
          tag.appendChild(text)

          const delBtn = document.createElement('span')
          delBtn.innerHTML = '×'
          delBtn.style.cssText = `
                        cursor: pointer;
                        font-weight: bold;
                        color: #536471;
                        font-size: 14px;
                        line-height: 1;
                    `
          delBtn.addEventListener('mouseover', () => (delBtn.style.color = '#f4212e'))
          delBtn.addEventListener('mouseout', () => (delBtn.style.color = '#536471'))
          delBtn.addEventListener('click', () => {
            const current = [...this.manager.settings.autoDownloadSuffixes]
            current.splice(index, 1)
            this.manager.updateSettings('autoDownloadSuffixes', current)
            renderList()
          })

          tag.appendChild(delBtn)
          listContainer.appendChild(tag)
        })
      }

      // Switch Visibility Logic
      switchInput.addEventListener('change', e => {
        this.manager.updateSettings('enableAutoDownload', e.target.checked)
        this.updateSuffixesVisibility()
      })

      this.updateSuffixesVisibility = () => {
        const isEnabled = this.manager.settings.enableAutoDownload
        suffixSection.style.display = isEnabled ? 'block' : 'none'
        if (isEnabled) renderList()
      }

      // Initial render
      this.updateSuffixesVisibility()

      // --- Close Button ---
      const closeBtn = document.createElement('button')
      closeBtn.textContent = 'Close Settings'
      closeBtn.style.cssText = `
                display: block;
                width: 100%;
                padding: 8px;
                background: white;
                border: 1px solid #cfd9de;
                color: #536471;
                border-radius: 20px;
                cursor: pointer;
                font-size: 13px;
                margin-top: 16px;
                font-weight: 600;
                transition: background 0.2s;
            `
      closeBtn.addEventListener('mouseover', () => (closeBtn.style.background = '#f7f9f9'))
      closeBtn.addEventListener('mouseout', () => (closeBtn.style.background = 'white'))
      closeBtn.addEventListener('click', () => this.hideMenu())
      menu.appendChild(closeBtn)

      return menu
    }

    toggleMenu() {
      if (!this.menuElement) {
        this.menuElement = this.createSettingsMenu()
        document.body.appendChild(this.menuElement)
      }
      this.menuElement.style.display = this.menuElement.style.display === 'none' ? 'block' : 'none'
    }

    hideMenu() {
      if (this.menuElement) this.menuElement.style.display = 'none'
    }
  }

  new SettingsUI(autoDownloadManager)

  // --- Image Observer ---
  function observeImages() {
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
              // Element
              checkForImages(node)
            }
          })
        } else if (mutation.type === 'attributes' && mutation.target.tagName === 'IMG') {
          checkImage(mutation.target)
        }
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src']
    })

    // Initial scan
    checkForImages(document.body)
  }

  function checkForImages(root) {
    const imgs = root.querySelectorAll('img')
    imgs.forEach(checkImage)
    if (root.tagName === 'IMG') checkImage(root)
  }

  function checkImage(img) {
    const src = img.src
    if (!src) return
    const normalized = normalizeUrl(src)
    if (normalized) {
      autoDownloadManager.triggerAutoDownload(normalized)
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeImages)
  } else {
    observeImages()
  }
})()
