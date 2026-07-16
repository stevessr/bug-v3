import { createE } from '../../dom/createEl'
import { customAlert } from '../../ui/dialog'
import { notify } from '../../ui/notify'
import { uploader } from '../core'

import type { DiscourseUploadRouteContext } from '@/content/discourse/utils/nativeUpload'

export async function handleUrlImport(
  urlTextarea: HTMLTextAreaElement,
  urlImportBtn: HTMLButtonElement,
  urlProgressList: HTMLElement,
  routeContext: DiscourseUploadRouteContext = 'auto'
) {
  const text = urlTextarea.value.trim()
  if (!text) {
    await customAlert('请先输入图片 URL')
    return
  }

  const urls = text
    .split('\n')
    .map(u => u.trim())
    .filter(u => u.length > 0)

  if (urls.length === 0) {
    await customAlert('未找到有效的 URL')
    return
  }

  urlImportBtn.disabled = true
  urlImportBtn.textContent = '导入中...'
  urlImportBtn.style.background = '#6b7280'
  urlImportBtn.style.cursor = 'not-allowed'

  urlProgressList.innerHTML = ''
  let successCount = 0
  let failCount = 0

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    const row = createE('div', {
      style: `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        font-size: 12px;
        border-bottom: 1px solid #f3f4f6;
      `
    })

    const statusIcon = createE('span', { text: '⏳' })
    const label = createE('span', {
      text: url.length > 50 ? url.slice(0, 50) + '...' : url,
      style: `
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: #6b7280;
      `
    })
    row.appendChild(statusIcon)
    row.appendChild(label)
    urlProgressList.appendChild(row)

    try {
      // Download image via fetch
      statusIcon.textContent = '⬇️'
      const resp = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'image/*,*/*' }
      })

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`)
      }

      const blob = await resp.blob()
      if (!blob.type.startsWith('image/')) {
        throw new Error('不是有效的图片')
      }

      // Extract filename from URL
      let filename = ''
      try {
        const u = new URL(url)
        const name = u.pathname.split('/').pop()
        if (name && name.includes('.')) filename = name
      } catch {
        /* ignore */
      }
      if (!filename) {
        const ext = blob.type.split('/')[1] || 'png'
        filename = `downloaded-${Date.now()}-${i}.${ext}`
      }

      // Upload to Discourse
      statusIcon.textContent = '📤'
      await uploader.uploadDownloadedFile(blob, filename, routeContext)
      successCount++
      statusIcon.textContent = '✅'
      label.style.color = '#16a34a'
      label.textContent = filename
    } catch (error: any) {
      failCount++
      statusIcon.textContent = '❌'
      label.style.color = '#dc2626'
      label.textContent = `${label.textContent} — ${error.message || '失败'}`
    }
  }

  urlImportBtn.disabled = false
  urlImportBtn.textContent = '导入并上传'
  urlImportBtn.style.background = '#3b82f6'
  urlImportBtn.style.cursor = 'pointer'

  const summary = createE('div', {
    style: `
      padding: 8px;
      font-size: 13px;
      font-weight: 500;
      text-align: center;
      color: ${failCount === 0 ? '#16a34a' : successCount > 0 ? '#d97706' : '#dc2626'};
    `
  })
  summary.textContent = `完成：${successCount} 成功，${failCount} 失败`
  urlProgressList.appendChild(summary)

  notify(
    `URL 导入完成：${successCount} 成功，${failCount} 失败`,
    failCount === 0 ? 'success' : 'info'
  )
}
