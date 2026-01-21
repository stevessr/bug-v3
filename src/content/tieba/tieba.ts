import { extractNameFromUrl } from '../x/utils'
import { DQSA, createE, DEBI, DOA } from '../utils/createEl'

const SELECTOR = 'div.lazy-img-wrapper'
const DOWNLOAD_BUTTON_ID = 'tieba-emoji-download-btn'
const DOWNLOAD_MODAL_ID = 'tieba-emoji-download-modal'
const DOWNLOAD_STYLE_ID = 'tieba-emoji-download-style'
const SCAN_DELAY_MS = 200
const INIT_DELAY_MS = 200

const injectedImages = new Map<string, TiebaImageItem>()

function isTiebaPage(): boolean {
  try {
    const host = window.location.hostname.toLowerCase()
    return host.includes('tieba.baidu.com')
  } catch {
    return false
  }
}

function normalizeUrl(raw: string): string | null {
  if (!raw) return null
  let url = raw.trim()
  if (url.startsWith('//')) url = `https:${url}`
  else if (url.startsWith('/')) url = `${window.location.origin}${url}`
  if (!/^https?:\/\//i.test(url)) return null
  return url
}

function extractTiebaImageUrl(container: Element): string | null {
  const img = container.querySelector('img') as HTMLImageElement | null
  if (!img) return null
  const raw = img.getAttribute('data-src') || img.getAttribute('src') || img.src || ''
  return normalizeUrl(raw)
}

function collectImageFromContainer(container: Element): void {
  try {
    if (!container) return

    const url = extractTiebaImageUrl(container)
    if (!url) return

    const name = extractNameFromUrl(url)
    // Keep a cached list for the download picker.
    if (!injectedImages.has(url)) {
      injectedImages.set(url, { name, url })
    }
  } catch (e) {
    console.error('[TiebaAddEmoji] collectImageFromContainer failed', e)
  }
}

function scanTiebaImages(): void {
  try {
    const containers = Array.from(DQSA(SELECTOR))
    containers.forEach(container => collectImageFromContainer(container))
  } catch (e) {
    console.error('[TiebaAddEmoji] scanTiebaImages failed', e)
  }
}

type TiebaImageItem = {
  name: string
  url: string
}

function getInjectedTiebaImages(): TiebaImageItem[] {
  return Array.from(injectedImages.values())
}

function ensureDownloadStyles(): void {
  if (DEBI(DOWNLOAD_STYLE_ID)) return
  const css = `
    #${DOWNLOAD_BUTTON_ID}{
      position:fixed;right:16px;bottom:16px;z-index:100001;
      background:#111827;color:#fff;border:none;border-radius:10px;
      padding:10px 12px;font-size:13px;cursor:pointer;
      box-shadow:0 6px 16px rgba(0,0,0,0.2);
    }
    #${DOWNLOAD_BUTTON_ID}:hover{background:#0f172a}
    #${DOWNLOAD_MODAL_ID}{
      position:fixed;inset:0;z-index:100002;display:flex;align-items:center;justify-content:center;
      background:rgba(0,0,0,0.45);
    }
    #${DOWNLOAD_MODAL_ID} .tieba-emoji-download-panel{
      width:min(720px,92vw);max-height:80vh;background:#fff;border-radius:12px;
      box-shadow:0 10px 30px rgba(0,0,0,0.25);display:flex;flex-direction:column;
      overflow:hidden;
    }
    #${DOWNLOAD_MODAL_ID} .tieba-emoji-download-header{
      display:flex;align-items:center;justify-content:space-between;
      padding:12px 14px;border-bottom:1px solid #e5e7eb;font-weight:600;
    }
    #${DOWNLOAD_MODAL_ID} .tieba-emoji-download-actions{
      display:flex;gap:8px;align-items:center;
    }
    #${DOWNLOAD_MODAL_ID} .tieba-emoji-download-actions button{
      border:none;background:#111827;color:#fff;border-radius:8px;padding:6px 10px;cursor:pointer;
      font-size:12px;
    }
    #${DOWNLOAD_MODAL_ID} .tieba-emoji-download-actions button.secondary{
      background:#e5e7eb;color:#111827;
    }
    #${DOWNLOAD_MODAL_ID} .tieba-emoji-download-list{
      padding:12px 14px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));
      gap:10px;flex:1;min-height:120px;
    }
    #${DOWNLOAD_MODAL_ID} .tieba-emoji-download-item{
      position:relative;border:1px solid #e5e7eb;border-radius:10px;padding:8px;display:flex;flex-direction:column;gap:6px;
      cursor:pointer;user-select:none;background:#fafafa;overflow:hidden;
    }
    #${DOWNLOAD_MODAL_ID} .tieba-emoji-download-item:hover{border-color:#cbd5f5;background:#f8fafc;}
    #${DOWNLOAD_MODAL_ID} .tieba-emoji-download-item.selected{
      border-color:#2563eb;box-shadow:0 0 0 2px rgba(37,99,235,0.25);
    }
    #${DOWNLOAD_MODAL_ID} .tieba-emoji-download-check{
      position:absolute;inset:0;opacity:0;cursor:pointer;
    }
    #${DOWNLOAD_MODAL_ID} .tieba-emoji-download-badge{
      position:absolute;top:8px;left:8px;background:#2563eb;color:#fff;border-radius:6px;
      padding:2px 6px;font-size:11px;line-height:1;pointer-events:none;
    }
    #${DOWNLOAD_MODAL_ID} .tieba-emoji-download-thumb{
      width:100%;height:120px;object-fit:cover;border-radius:6px;background:#f3f4f6;
    }
    #${DOWNLOAD_MODAL_ID} .tieba-emoji-download-meta{
      display:flex;align-items:center;gap:6px;font-size:12px;color:#111827;
    }
    #${DOWNLOAD_MODAL_ID} .tieba-emoji-download-name{
      flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    }
    #${DOWNLOAD_MODAL_ID} .tieba-emoji-download-footer{
      padding:10px 14px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;
      display:flex;justify-content:space-between;align-items:center;
    }
  `
  DOA(createE('style', { id: DOWNLOAD_STYLE_ID, text: css }))
}

function closeDownloadModal(): void {
  const modal = DEBI(DOWNLOAD_MODAL_ID)
  if (modal && modal.parentNode) modal.parentNode.removeChild(modal)
}

function createDownloadModal(): void {
  if (DEBI(DOWNLOAD_MODAL_ID)) return
  ensureDownloadStyles()

  const modal = createE('div', { id: DOWNLOAD_MODAL_ID })
  const panel = createE('div', { class: 'tieba-emoji-download-panel' })
  const header = createE('div', { class: 'tieba-emoji-download-header' })
  const title = createE('div', { text: '选择要下载的图片' })
  const actions = createE('div', { class: 'tieba-emoji-download-actions' })
  const btnSelectAll = createE('button', { class: 'secondary', text: '全选' })
  const btnDownload = createE('button', { text: '打包下载' })
  const btnClose = createE('button', { class: 'secondary', text: '关闭' })
  actions.appendChild(btnSelectAll)
  actions.appendChild(btnDownload)
  actions.appendChild(btnClose)
  header.appendChild(title)
  header.appendChild(actions)

  const list = createE('div', { class: 'tieba-emoji-download-list' })
  const footer = createE('div', { class: 'tieba-emoji-download-footer' })
  const status = createE('div', { text: '已选 0 项' })
  const hint = createE('div', { text: '仅显示已注入“添加表情”的图片' })
  footer.appendChild(status)
  footer.appendChild(hint)

  panel.appendChild(header)
  panel.appendChild(list)
  panel.appendChild(footer)
  modal.appendChild(panel)
  DOA(modal)

  const items = getInjectedTiebaImages()
  if (items.length === 0) {
    list.appendChild(createE('div', { text: '未发现可下载图片' }))
  } else {
    items.forEach(item => {
      const checkbox = createE('input', {
        type: 'checkbox',
        class: 'tieba-emoji-download-check'
      }) as HTMLInputElement
      checkbox.checked = true
      const badge = createE('span', { class: 'tieba-emoji-download-badge', text: '已选' })
      const thumb = createE('img', { class: 'tieba-emoji-download-thumb', src: item.url, alt: item.name })
      const name = createE('span', { class: 'tieba-emoji-download-name', text: item.name })
      const meta = createE('div', { class: 'tieba-emoji-download-meta' })
      meta.appendChild(name)
      const card = createE('label', {
        class: 'tieba-emoji-download-item',
        dataset: { url: item.url, name: item.name }
      })
      card.appendChild(checkbox)
      card.appendChild(badge)
      card.appendChild(thumb)
      card.appendChild(meta)
      const syncSelectedState = () => {
        if (checkbox.checked) card.classList.add('selected')
        else card.classList.remove('selected')
        badge.style.display = checkbox.checked ? '' : 'none'
        updateSelectedCount(list, status)
      }
      checkbox.addEventListener('change', syncSelectedState)
      syncSelectedState()
      list.appendChild(card)
    })
    updateSelectedCount(list, status)
  }

  btnClose.addEventListener('click', () => closeDownloadModal())
  modal.addEventListener('click', e => {
    if (e.target === modal) closeDownloadModal()
  })

  btnSelectAll.addEventListener('click', () => {
    const checkboxes = list.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>
    const shouldCheck = Array.from(checkboxes).some(cb => !cb.checked)
    checkboxes.forEach(cb => {
      cb.checked = shouldCheck
    })
    btnSelectAll.textContent = shouldCheck ? '全不选' : '全选'
    updateSelectedCount(list, status)
  })

  btnDownload.addEventListener('click', async () => {
    const selected = getSelectedItems(list)
    if (selected.length === 0) {
      status.textContent = '请先选择要下载的图片'
      return
    }
    btnDownload.textContent = '处理中...'
    btnDownload.setAttribute('disabled', 'true')
    try {
      await downloadSelectedImages(selected, status)
    } finally {
      btnDownload.textContent = '打包下载'
      btnDownload.removeAttribute('disabled')
    }
  })
}

function updateSelectedCount(list: Element, status: HTMLElement): void {
  const selected = getSelectedItems(list)
  status.textContent = `已选 ${selected.length} 项`
}

function getSelectedItems(list: Element): TiebaImageItem[] {
  const items: TiebaImageItem[] = []
  const cards = Array.from(list.querySelectorAll('.tieba-emoji-download-item')) as HTMLElement[]
  cards.forEach(card => {
    const checkbox = card.querySelector('input[type="checkbox"]') as HTMLInputElement | null
    if (!checkbox || !checkbox.checked) return
    const url = card.dataset.url || ''
    const name = card.dataset.name || 'image'
    if (url) items.push({ name, url })
  })
  return items
}

function padBytes(encoder: TextEncoder, s: string, len: number): Uint8Array {
  const bytes = encoder.encode(s)
  if (bytes.length > len) return bytes.slice(0, len)
  const out = new Uint8Array(len)
  out.set(bytes)
  return out
}

function numberToOctal(encoder: TextEncoder, num: number, length: number): Uint8Array {
  const oct = num.toString(8)
  const padded = oct.padStart(length - 1, '0') + '\0'
  return encoder.encode(padded)
}

function computeChecksum(encoder: TextEncoder, header: Uint8Array): Uint8Array {
  const copy = new Uint8Array(header)
  for (let i = 148; i < 156; i++) copy[i] = 0x20
  let sum = 0
  for (let i = 0; i < copy.length; i++) sum += copy[i]
  const oct = sum.toString(8)
  const padded = oct.padStart(6, '0') + '\0' + ' '
  return encoder.encode(padded)
}

function createTarHeader(
  encoder: TextEncoder,
  filename: string,
  fileSize: number
): Uint8Array {
  const header = new Uint8Array(512)
  header.set(padBytes(encoder, filename, 100), 0)
  header.set(numberToOctal(encoder, 0o644, 8), 100)
  header.set(numberToOctal(encoder, 0, 8), 108)
  header.set(numberToOctal(encoder, 0, 8), 116)
  header.set(numberToOctal(encoder, fileSize, 12), 124)
  header.set(numberToOctal(encoder, Math.floor(Date.now() / 1000), 12), 136)
  header.set(encoder.encode('        '), 148)
  header[156] = 0x30
  header.set(encoder.encode('ustar'), 257)
  header.set(encoder.encode('00'), 263)
  const chksum = computeChecksum(encoder, header)
  header.set(chksum, 148)
  return header
}

function generateSafeFilename(encoder: TextEncoder, name: string, url: string, index: number): string {
  const safeBase = name.split('/').join('_').split('\0').join('_')
  const extMatch = (url || '').match(/\.([a-zA-Z0-9]{1,5})(?:\?|$)/)
  const ext = extMatch ? extMatch[1] : 'png'
  const extWithDot = `.${ext}`
  const maxNameBytes = 100
  let filename = safeBase + extWithDot
  if (encoder.encode(filename).length > maxNameBytes) {
    let out = ''
    for (const ch of safeBase) {
      const candidate = out + ch
      if (encoder.encode(candidate + extWithDot).length > maxNameBytes) break
      out = candidate
    }
    const baseFinal = out || `image-${index}`
    filename = baseFinal + extWithDot
  }
  return filename
}

async function fetchImageBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url, { mode: 'cors', headers: { Accept: 'image/*' } })
    if (!res.ok) return null
    return await res.blob()
  } catch {
    return null
  }
}

async function downloadSelectedImages(items: TiebaImageItem[], status: HTMLElement): Promise<void> {
  const encoder = new TextEncoder()
  status.textContent = `正在打包 0/${items.length}`
  const supportsStream =
    typeof ReadableStream !== 'undefined' && typeof (window as any).CompressionStream !== 'undefined'
  const now = new Date()
  const stamp = now.toISOString().replace(/[:.]/g, '-')
  const fileBase = `tieba-images-${stamp}`

  const tarStream = new ReadableStream({
    async start(controller) {
      try {
        let processed = 0
        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          const blob = await fetchImageBlob(item.url)
          if (!blob) {
            processed++
            status.textContent = `正在打包 ${processed}/${items.length}`
            continue
          }
          const filename = generateSafeFilename(encoder, item.name, item.url, i)
          const header = createTarHeader(encoder, filename, blob.size)
          controller.enqueue(header)
          const reader = blob.stream().getReader()
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              controller.enqueue(value)
            }
          } finally {
            reader.releaseLock()
          }
          const remainder = blob.size % 512
          if (remainder !== 0) controller.enqueue(new Uint8Array(512 - remainder))
          processed++
          status.textContent = `正在打包 ${processed}/${items.length}`
        }
        controller.enqueue(new Uint8Array(512))
        controller.enqueue(new Uint8Array(512))
        controller.close()
      } catch (e) {
        controller.error(e)
      }
    }
  })

  let finalBlob: Blob
  let filename: string
  if (supportsStream) {
    const compressionStream = new (window as any).CompressionStream('gzip')
    const compressed = tarStream.pipeThrough(compressionStream)
    finalBlob = await new Response(compressed).blob()
    filename = `${fileBase}.tar.gz`
  } else {
    finalBlob = await new Response(tarStream).blob()
    filename = `${fileBase}.tar`
  }

  const url = URL.createObjectURL(finalBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  status.textContent = `打包完成：${items.length} 项`
}

function ensureDownloadButton(): void {
  if (DEBI(DOWNLOAD_BUTTON_ID)) return
  ensureDownloadStyles()
  const btn = createE('button', { id: DOWNLOAD_BUTTON_ID, text: '下载表情图' })
  btn.addEventListener('click', () => createDownloadModal())
  DOA(btn)
}

let tiebaObserver: MutationObserver | null = null
let debounceTimer: number | null = null
let keepAliveTimer: number | null = null

function observeTieba(): void {
  if (tiebaObserver) return
  tiebaObserver = new MutationObserver(mutations => {
    let shouldScan = false
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return
          const el = node as Element
          if (el.matches && el.matches(SELECTOR)) shouldScan = true
          else if (el.querySelector && el.querySelector(SELECTOR)) shouldScan = true
          else if (el.tagName === 'IMG') shouldScan = true
        })
      } else if (mutation.type === 'attributes') {
        const tgt = mutation.target as Element
        if (tgt.tagName === 'IMG') shouldScan = true
      }
      if (shouldScan) break
    }

    if (shouldScan) {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => {
        scanTiebaImages()
        ensureDownloadButton()
        debounceTimer = null
      }, SCAN_DELAY_MS)
    }
  })

  try {
    tiebaObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'data-src']
    })
  } catch (e) {
    console.error('[TiebaAddEmoji] observeTieba failed to attach observer', e)
  }
}

function startKeepAlive(): void {
  if (keepAliveTimer) return
  keepAliveTimer = window.setInterval(() => {
    // Some pages dynamically destroy/recreate DOM nodes; keep re-checking.
    ensureDownloadButton()
    scanTiebaImages()
  }, 2500)
}

export function initTieba(): void {
  try {
    if (!isTiebaPage()) return
    setTimeout(() => {
      scanTiebaImages()
      observeTieba()
      ensureDownloadButton()
      startKeepAlive()
    }, INIT_DELAY_MS)
    console.log('[TiebaAddEmoji] initialized')
  } catch (e) {
    console.error('[TiebaAddEmoji] init failed', e)
  }
}
