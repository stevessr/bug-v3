// Codec check entry: exercises storageCodec roundtrip/migration in the browser.
import {
  decodeHistory,
  decodeSettings,
  encodeHistory,
  encodeSettings,
  shortenTwimgUrl,
  expandTwimgToken
} from '../../src/content/x/autoDownload/storageCodec'

const DEFAULTS = {
  enableAutoDownload: false,
  autoDownloadSuffixes: ['name=large', 'name=4096x4096']
}

const check = async (): Promise<Record<string, boolean>> => {
  const r: Record<string, boolean> = {}

  // 1. twimg URL 缩减 + 还原
  const full = 'https://pbs.twimg.com/media/HTokOeDbcAARx8A?format=jpg&name=4096x4096'
  const token = shortenTwimgUrl(full)
  r.twimgShorten = token === 'HTokOeDbcAARx8A~jpg~4096x4096'
  r.twimgExpand = expandTwimgToken(token) === full
  r.twimgNonMatchPassthrough =
    shortenTwimgUrl('https://idcflare.com/a.png') === 'https://idcflare.com/a.png'

  // 2. 历史压缩 roundtrip（40 条真实形态样本，15 字符 base64url mediaId）
  const entries: Array<[string, number]> = []
  const b64url = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  for (let i = 0; i < 40; i++) {
    let id = 'HT'
    for (let c = 0; c < 13; c++) id += b64url[(i * 13 + c * 7) % 64]
    const fmt = i % 3 === 0 ? 'png' : 'jpg'
    const name = i % 2 === 0 ? 'large' : '4096x4096'
    entries.push([
      `https://pbs.twimg.com/media/${id}?format=${fmt}&name=${name}`,
      1791018857094 + i * 60000
    ])
  }
  const hist = new Map(entries)
  const encoded = await encodeHistory(hist)
  r.historyCompressedV3 = encoded.startsWith('AD3 ')
  const decoded = await decodeHistory(encoded)
  r.historyRoundtrip =
    decoded.size === entries.length && entries.every(([url, ts]) => decoded.get(url) === ts)
  r.historySmaller = encoded.length < JSON.stringify(Object.fromEntries(hist)).length
  // v3 应显著优于旧 JSON（3x 以上）
  r.historyV3BeatsOld = encoded.length <= JSON.stringify(Object.fromEntries(hist)).length / 3

  // 3. 混合转义：非 twimg 条目在首/中/尾
  const mixed = new Map([
    ['https://idcflare.com/first.png', 1791018000000],
    ...entries,
    ['https://x.com/emoji/test.png', 1791104540000],
    ['https://idcflare.com/last.png', 1791104550000]
  ])
  const mixedEnc = await encodeHistory(mixed)
  const mixedDec = await decodeHistory(mixedEnc)
  r.mixedEscapeRoundtrip =
    mixedDec.size === mixed.size &&
    [...mixed.entries()].every(([url, ts]) => mixedDec.get(url) === ts)

  // 4. 小体量 payload：v3 打包，单条也应优于明文
  const tiny = new Map([['https://idcflare.com/uploads/a.png', 1791104548518]])
  const tinyEnc = await encodeHistory(tiny)
  r.tinyFallbackPlain = tinyEnc.startsWith('AD3 ')
  const tinyDec = await decodeHistory(tinyEnc)
  r.tinyRoundtrip = tinyDec.get('https://idcflare.com/uploads/a.png') === 1791104548518

  // 4. 旧 JSON 历史迁移
  const oldHistory = JSON.stringify({
    data: {
      'https://pbs.twimg.com/media/HTokOeDbcAARx8A?format=jpg&name=4096x4096': 1791018857094,
      'https://pbs.twimg.com/media/HTn3YQpacAEIVyu?format=jpg&name=large': 1791042388698
    },
    timestamp: 1791104548518
  })
  const oldDec = await decodeHistory(oldHistory)
  r.oldJsonHistory =
    oldDec.size === 2 &&
    oldDec.get('https://pbs.twimg.com/media/HTokOeDbcAARx8A?format=jpg&name=4096x4096') ===
      1791018857094

  // 5. 旧 JSON 设置迁移
  const oldSettings = JSON.stringify({
    data: { enableAutoDownload: true, autoDownloadSuffixes: ['name=large', 'name=orig'] },
    timestamp: 123
  })
  const s1 = decodeSettings(oldSettings, DEFAULTS)
  r.oldJsonSettings =
    s1.enableAutoDownload === true &&
    JSON.stringify(s1.autoDownloadSuffixes) === JSON.stringify(['name=large', 'name=orig'])

  // 6. 新设置格式 roundtrip
  const se = encodeSettings({
    enableAutoDownload: true,
    autoDownloadSuffixes: ['name=large', 'name=orig']
  })
  r.settingsCompact = se === 'ADS1 1\u0001name=large,name=orig'
  const sd = decodeSettings(se, DEFAULTS)
  r.settingsRoundtrip =
    sd.enableAutoDownload === true &&
    JSON.stringify(sd.autoDownloadSuffixes) === JSON.stringify(['name=large', 'name=orig'])

  // 7. 旧分离后缀（JSON 字符串 / 逗号分隔）
  const s2 = decodeSettings(
    JSON.stringify({ enableAutoDownload: true, autoDownloadSuffixes: 'name=large,name=orig' }),
    DEFAULTS
  )
  r.legacyStringSuffixes =
    JSON.stringify(s2.autoDownloadSuffixes) === JSON.stringify(['name=large', 'name=orig'])

  // 8. 损坏压缩数据安全（v2 与 v1 均需安全）
  r.corruptSafe = (await decodeHistory('AD1 !!!not-base64!!!')).size === 0
  r.corruptSafeV2 = (await decodeHistory('AD2 !!!not-packed!!!')).size === 0
  r.corruptSafeV3 = (await decodeHistory('AD3 !!!not-packed!!!')).size === 0

  // 9. 明文行格式（无 CompressionStream 环境的存储形态）
  const plainDec = await decodeHistory('https://a.com/x.png\u0001500\nhttps://b.com/y.png\u0001700')
  r.plainLineDecode = plainDec.get('https://b.com/y.png') === 1200

  return r
}

interface CodecCheckWindow {
  __storageCodecCheck: () => Promise<Record<string, boolean>>
}

;(window as unknown as CodecCheckWindow).__storageCodecCheck = check
