export function initSaveLastDiscourse() {
  try {
    if (document.getElementById('save-last-discourse-btn')) return

    const uploadSelectors = [
      'a.image-source-link',
      '.lightbox-wrapper a.lightbox',
      '.composer .upload',
      '.d-editor',
      '.upload-button',
      'input[type=file]'
    ]

    function createButton() {
      const btn = document.createElement('button')
      btn.id = 'save-last-discourse-btn'
      btn.textContent = '保存为最近 Discourse'
      btn.addEventListener('click', () => {
        const base = window.location.origin
        const meta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null
        const csrf = meta
          ? meta.content
          : (document.cookie.match(/csrf_token=([^;]+)/) || [])[1] || ''
        const payload = { base, cookie: document.cookie, csrf }
        try {
          ;(window as any).chrome.runtime.sendMessage({ action: 'saveLastDiscourse', payload })
          btn.textContent = '已保存'
          setTimeout(() => (btn.textContent = '保存为最近 Discourse'), 2000)
        } catch (e) {
          void e
        }
      })
      return btn
    }

    for (const sel of uploadSelectors) {
      const el = document.querySelector(sel)
      if (el && el.parentElement) {
        const btn = createButton()
        el.parentElement.insertBefore(btn, el.nextSibling)
        return
      }
    }

    // fallback: append to header/body
    const container = document.querySelector('header') || document.body
    if (container) {
      container.appendChild(createButton())
    }
  } catch (e) {
    void e
  }
}
