// 通用图片直链页面表情按钮注入脚本（自治）
// 仅在非 pixiv 图片直链页面自动执行

interface AddEmojiButtonData {
  name: string
  url: string
}

function setupButtonClick(button: HTMLElement, data: AddEmojiButtonData) {
  button.addEventListener('click', async e => {
    e.preventDefault()
    e.stopPropagation()
    const orig = button.innerHTML
    const origStyle = button.style.cssText
    try {
      // 这里假定 chrome.runtime.sendMessage 可用
      await (window as any).chrome?.runtime?.sendMessage({
        action: 'addEmojiFromWeb',
        emojiData: data
      })
      button.innerHTML = '已添加'
      button.style.background = 'linear-gradient(135deg,#10b981,#059669)'
      setTimeout(() => {
        button.innerHTML = orig
        button.style.cssText = origStyle
      }, 1500)
    } catch (err) {
      button.innerHTML = '失败'
      button.style.background = 'linear-gradient(135deg,#ef4444,#dc2626)'
      setTimeout(() => {
        button.innerHTML = orig
        button.style.cssText = origStyle
      }, 1500)
    }
  })
}

function createOverlayBtn(data: AddEmojiButtonData, target: Element) {
  const btn = document.createElement('button')
  btn.className = 'x-emoji-add-btn'
  btn.type = 'button'
  btn.title = '添加到未分组表情'
  btn.innerHTML = '➕'
  btn.style.position = 'absolute'
  btn.style.right = '6px'
  btn.style.top = '6px'
  btn.style.zIndex = '9999'
  btn.style.cursor = 'pointer'
  btn.style.borderRadius = '6px'
  btn.style.padding = '6px 8px'
  btn.style.background = 'rgba(0,0,0,0.8)'
  btn.style.color = '#fff'
  btn.style.border = 'none'
  btn.style.fontWeight = '700'
  btn.style.boxSizing = 'border-box'
  btn.style.opacity = '0'
  btn.style.transition = 'opacity 0.2s ease'
  btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'
  btn.style.backdropFilter = 'blur(4px)'
  btn.style.minWidth = '32px'
  btn.style.minHeight = '32px'
  btn.style.maxWidth = '48px'
  btn.style.maxHeight = '48px'
  btn.style.display = 'inline-flex'
  btn.style.alignItems = 'center'
  btn.style.justifyContent = 'center'
  btn.style.pointerEvents = 'auto'
  setupButtonClick(btn, data)
  document.body.appendChild(btn)

  // 悬浮显示/隐藏
  let isHovered = false
  const showButton = () => {
    isHovered = true
    btn.style.opacity = '1'
  }
  const hideButton = () => {
    isHovered = false
    btn.style.opacity = '0'
  }
  target.addEventListener('mouseenter', showButton)
  target.addEventListener('mouseleave', hideButton)
  btn.addEventListener('mouseenter', showButton)
  btn.addEventListener('mouseleave', hideButton)

  // 定位
  function update() {
    if (!document.body.contains(target)) {
      btn.remove()
      return
    }
    const r = (target as HTMLElement).getBoundingClientRect()
    btn.style.top = window.scrollY + r.top + 6 + 'px'
    btn.style.left = window.scrollX + r.right - btn.offsetWidth - 6 + 'px'
    btn.style.display = 'inline-flex'
    if (!isHovered) btn.style.opacity = '0'
    requestAnimationFrame(update)
  }
  update()
  return btn
}

// 自动检测并注入按钮
;(function () {
  const host = window.location.hostname.toLowerCase()
  if (host.includes('pximg.net') || host.includes('pixiv.net')) return
  const imgExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
  const url = window.location.href.split('?')[0].toLowerCase()
  if (!imgExt.some(ext => url.endsWith(ext))) return
  const imgs = Array.from(document.querySelectorAll('img'))
  if (imgs.length !== 1) return
  setTimeout(() => {
    const img = document.querySelector('img')
    if (!img) return
    const src = img.src || img.getAttribute('src') || ''
    if (!src) return
    const name = src.split('/').pop()?.split('?')[0] || '表情'
    createOverlayBtn({ name, url: src }, img)
    console.log('[Emoji拓展] images/image-inject.ts 已注入表情按钮', { name, src })
  }, 200)
})()
