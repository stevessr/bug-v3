/**
 * Tenor 贴纸搜索面板
 *
 * 作为 Discourse emoji picker 内部的额外"section"，提供 Tenor GIF/贴纸搜索能力。
 * 选中后下载 -> 上传到 Discourse -> 调用 insertEmojiIntoEditor 插入到编辑器。
 */

import { createE } from '../../utils/dom/createEl'

import { cachedState } from './ensure'
import { insertEmojiIntoEditor } from './editor'

import { isLinuxDoDiscourseBase, uploadLinuxDoMultipart } from '@/utils/discourseUpload'
import type { DiscourseUploadResponse } from '@/utils/discourseUpload'
import { fetchTenorMediaAsBlob, pickTenorPreview, tenorFeatured, tenorSearch } from '@/utils/tenor'
import type { TenorResult } from '@/utils/tenor'
import type { Emoji } from '@/types/type'

export const TENOR_SECTION_ID = '__tenor_search__'
export const TENOR_SECTION_ICON = '🎞️'
export const TENOR_SECTION_LABEL = 'Tenor 贴纸'

interface TenorPickerHandle {
  navButton: HTMLButtonElement
  section: HTMLDivElement
  destroy(): void
}

export interface CreateTenorSectionOptions {
  scrollableContent: HTMLElement
  onAfterInsert?: () => void
}

interface SettingsSnapshot {
  apiKey: string
  locale: string
  contentFilter: 'off' | 'low' | 'medium' | 'high'
}

function readTenorSettings(): SettingsSnapshot {
  const s = cachedState?.settings || ({} as any)
  return {
    apiKey: typeof s.tenorApiKey === 'string' ? s.tenorApiKey.trim() : '',
    locale: typeof s.tenorLocale === 'string' && s.tenorLocale ? s.tenorLocale : 'zh_CN',
    contentFilter:
      s.tenorContentFilter === 'off' ||
      s.tenorContentFilter === 'low' ||
      s.tenorContentFilter === 'medium' ||
      s.tenorContentFilter === 'high'
        ? s.tenorContentFilter
        : 'high'
  }
}

function buildEmojiFromUpload(result: TenorResult, uploaded: DiscourseUploadResponse): Emoji {
  const fallback = result.content_description || result.title || 'tenor_gif'
  const name = fallback.replace(/[^a-zA-Z0-9_一-龥]+/g, '_').slice(0, 32) || 'tenor_gif'
  return {
    id: `tenor-${result.id}`,
    packet: 0,
    name,
    url: uploaded.url,
    short_url: uploaded.short_url,
    originUrl: result.itemurl || result.url,
    width: uploaded.width,
    height: uploaded.height,
    groupId: 'tenor'
  }
}

async function uploadBlobToCurrentDiscourse(
  blob: Blob,
  filename: string
): Promise<DiscourseUploadResponse> {
  const base = window.location.origin
  const file = new File([blob], filename, { type: blob.type })

  if (isLinuxDoDiscourseBase(base)) {
    return uploadLinuxDoMultipart({
      baseUrl: base,
      file,
      fileName: filename,
      mimeType: blob.type
    })
  }

  const csrfMeta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null
  const csrf = csrfMeta?.content || ''
  const headers: Record<string, string> = {}
  if (csrf) headers['X-Csrf-Token'] = csrf

  const form = new FormData()
  form.append('upload_type', 'composer')
  form.append('relativePath', 'null')
  form.append('name', filename)
  form.append('type', blob.type)
  form.append('file', file, filename)

  const uploadUrl = `${base.replace(/\/$/, '')}/uploads.json?client_id=tenor-${Date.now()}`
  const resp = await fetch(uploadUrl, {
    method: 'POST',
    headers,
    body: form,
    credentials: 'include'
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`上传失败 (HTTP ${resp.status}): ${text.slice(0, 200)}`)
  }
  return (await resp.json()) as DiscourseUploadResponse
}

export function createTenorSection({
  scrollableContent,
  onAfterInsert
}: CreateTenorSectionOptions): TenorPickerHandle {
  const navButton = createE('button', {
    class: 'btn no-text btn-flat emoji-picker__section-btn',
    attrs: {
      tabindex: '-1',
      'data-section': TENOR_SECTION_ID
    },
    type: 'button',
    ti: TENOR_SECTION_LABEL
  }) as HTMLButtonElement
  navButton.textContent = TENOR_SECTION_ICON

  const section = createE('div', {
    class: 'emoji-picker__section emoji-picker__section--tenor',
    attrs: {
      'data-section': TENOR_SECTION_ID,
      role: 'region',
      'aria-label': TENOR_SECTION_LABEL
    },
    style: 'content-visibility: auto; contain-intrinsic-size: 1px 240px;'
  }) as HTMLDivElement

  const titleContainer = createE('div', {
    class: 'emoji-picker__section-title-container'
  })
  const title = createE('h2', {
    class: 'emoji-picker__section-title'
  })
  title.textContent = TENOR_SECTION_LABEL
  titleContainer.appendChild(title)
  section.appendChild(titleContainer)

  // 搜索框
  const searchBar = createE('div', {
    style:
      'display:flex;gap:6px;align-items:center;padding:6px 8px;position:sticky;top:0;background:var(--secondary, #fff);z-index:1;'
  })
  const tenorInput = createE('input', {
    class: 'filter-input',
    ph: '搜索 Tenor 贴纸…',
    type: 'text',
    style: 'flex:1;min-width:0;'
  }) as HTMLInputElement
  const tenorSearchBtn = createE('button', {
    class: 'btn btn-flat',
    type: 'button',
    text: '搜索'
  }) as HTMLButtonElement
  searchBar.appendChild(tenorInput)
  searchBar.appendChild(tenorSearchBtn)
  section.appendChild(searchBar)

  // 状态信息
  const statusEl = createE('div', {
    style: 'padding: 8px 12px; color:#888; font-size:12px; line-height:1.4;'
  })
  section.appendChild(statusEl)

  // 结果网格
  const grid = createE('div', {
    class: 'emoji-picker__section-emojis emoji-picker__section-emojis--tenor',
    style:
      'display:grid;grid-template-columns:repeat(auto-fill, minmax(96px, 1fr));gap:6px;padding:6px 8px;contain: layout paint;'
  }) as HTMLDivElement
  section.appendChild(grid)

  let currentAbort: AbortController | null = null
  let searchTimer: number | null = null
  let lastQuery = ''
  let destroyed = false

  // IntersectionObserver 用于懒加载 Tenor 缩略图
  const lazyObserver = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        const img = entry.target as HTMLImageElement
        const src = img.dataset.src
        if (src) {
          img.src = src
          img.removeAttribute('data-src')
        }
        lazyObserver.unobserve(img)
      })
    },
    { root: scrollableContent, rootMargin: '160px', threshold: 0.01 }
  )

  function setStatus(text: string, color: string = '#888') {
    statusEl.textContent = text
    statusEl.style.color = color
  }

  function clearGrid() {
    while (grid.firstChild) grid.removeChild(grid.firstChild)
  }

  function renderResults(results: TenorResult[]) {
    clearGrid()
    if (!results.length) {
      setStatus('未找到匹配的贴纸', '#888')
      return
    }
    setStatus('', '#888')
    const fragment = document.createDocumentFragment()
    results.forEach(result => {
      const preview = pickTenorPreview(result)
      if (!preview) return
      const item = createE('div', {
        style:
          'position:relative;cursor:pointer;border-radius:6px;overflow:hidden;background:rgba(0,0,0,0.04);aspect-ratio:1/1;'
      })
      const img = createE('img', {
        alt: result.content_description || result.title || 'tenor sticker',
        ti: result.content_description || result.title || '',
        ld: 'lazy',
        style: 'width:100%;height:100%;object-fit:cover;display:block;background:rgba(0,0,0,0.05);'
      }) as HTMLImageElement
      img.dataset.src = preview.thumb
      img.decoding = 'async'
      img.draggable = false
      lazyObserver.observe(img)
      item.appendChild(img)

      const overlay = createE('div', {
        style:
          'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);color:#fff;font-size:12px;opacity:0;transition:opacity .15s;pointer-events:none;'
      })
      overlay.textContent = '上传中…'
      item.appendChild(overlay)

      item.addEventListener('click', async () => {
        if (destroyed) return
        const apiKey = readTenorSettings().apiKey
        if (!apiKey) {
          setStatus('请先在设置中填写 Tenor API Key', '#ef4444')
          return
        }
        try {
          overlay.style.opacity = '1'
          const { blob, filename } = await fetchTenorMediaAsBlob(preview.full)
          const uploaded = await uploadBlobToCurrentDiscourse(blob, filename)
          const emoji = buildEmojiFromUpload(result, uploaded)
          insertEmojiIntoEditor(emoji)
          onAfterInsert?.()
        } catch (e: any) {
          console.warn('[Tenor] insert failed', e)
          setStatus(`插入失败：${e?.message || e}`, '#ef4444')
        } finally {
          overlay.style.opacity = '0'
        }
      })

      fragment.appendChild(item)
    })
    grid.appendChild(fragment)
  }

  async function runQuery(query: string) {
    const trimmed = query.trim()
    lastQuery = trimmed
    if (currentAbort) {
      currentAbort.abort()
      currentAbort = null
    }
    const settings = readTenorSettings()
    if (!settings.apiKey) {
      clearGrid()
      setStatus('请在扩展选项中配置 Tenor API Key 后再使用', '#ef4444')
      return
    }
    const abort = new AbortController()
    currentAbort = abort
    setStatus(trimmed ? `搜索中：${trimmed}` : '加载热门贴纸…')

    try {
      const resp = trimmed
        ? await tenorSearch({
            query: trimmed,
            apiKey: settings.apiKey,
            locale: settings.locale,
            contentFilter: settings.contentFilter,
            limit: 24,
            signal: abort.signal
          })
        : await tenorFeatured({
            apiKey: settings.apiKey,
            locale: settings.locale,
            contentFilter: settings.contentFilter,
            limit: 24,
            signal: abort.signal
          })
      if (abort.signal.aborted || destroyed || trimmed !== lastQuery) return
      renderResults(resp.results)
    } catch (e: any) {
      if (e?.name === 'AbortError') return
      console.warn('[Tenor] query failed', e)
      clearGrid()
      setStatus(`请求失败：${e?.message || e}`, '#ef4444')
    } finally {
      if (currentAbort === abort) currentAbort = null
    }
  }

  function scheduleSearch(value: string) {
    if (searchTimer !== null) {
      window.clearTimeout(searchTimer)
      searchTimer = null
    }
    searchTimer = window.setTimeout(() => {
      searchTimer = null
      runQuery(value)
    }, 280) as unknown as number
  }

  tenorInput.addEventListener('input', e => {
    const v = (e.target as HTMLInputElement).value || ''
    scheduleSearch(v)
  })
  tenorInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      if (searchTimer !== null) {
        window.clearTimeout(searchTimer)
        searchTimer = null
      }
      runQuery(tenorInput.value || '')
    }
  })
  tenorSearchBtn.addEventListener('click', () => {
    if (searchTimer !== null) {
      window.clearTimeout(searchTimer)
      searchTimer = null
    }
    runQuery(tenorInput.value || '')
  })

  navButton.addEventListener('click', () => {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (!grid.childElementCount) {
      runQuery(tenorInput.value || '')
    }
    setTimeout(() => tenorInput.focus(), 80)
  })

  return {
    navButton,
    section,
    destroy() {
      destroyed = true
      if (currentAbort) {
        currentAbort.abort()
        currentAbort = null
      }
      if (searchTimer !== null) {
        window.clearTimeout(searchTimer)
        searchTimer = null
      }
      lazyObserver.disconnect()
    }
  }
}

export function isTenorEnabled(): boolean {
  const s = cachedState?.settings as any
  return Boolean(s && s.enableTenorSearch)
}
