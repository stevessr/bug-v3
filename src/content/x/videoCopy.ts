

declare const chrome: any

function isXPage(): boolean {
  try {
    const host = window.location.hostname.toLowerCase()
    // Include X/Twitter and common media hosts so direct image/video pages are handled
    return (
      host === 'x.com' ||
      host.endsWith('.twitter.com') ||
      host.includes('twitter.com') ||
      host === 'pbs.twimg.com' ||
      host.endsWith('.twimg.com') ||
      host.includes('twimg.com') ||
      host.includes('pbs.twimg')
    )
  } catch {
    return false
  }
}

function getVideoUrl(video: HTMLVideoElement): string | null {
  // prefer explicit <source> src, then video.currentSrc, then video.src
  try {
    const source = video.querySelector('source') as HTMLSourceElement | null
    if (source && source.src) return source.src
    if (video.currentSrc) return video.currentSrc
    if ((video as HTMLVideoElement).src) return (video as HTMLVideoElement).src
  } catch {
    // ignore
  }
  return null
}

async function downloadBlob(url: string): Promise<void> {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`网络请求失败: ${response.status} ${response.statusText}`)
    const blob = await response.blob()

    // Create download link
    const downloadUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = `video_${Date.now()}.mp4` // Default filename

    // Trigger download
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // Clean up
    URL.revokeObjectURL(downloadUrl)
  } catch (error) {
    // Log and inform user via alert
    try {
      console.error('[XVideoCopy] 下载失败', error)
    } catch {
      // ignore logger failures
    }
    try {
      const msg = error && (error as Error).message ? (error as Error).message : String(error)
      safeAlert('下载失败: ' + msg)
    } catch {
      // ignore alert failures
    }
    throw error
  }
}

function safeAlert(message: string) {
  try {
    // Send message to background to show notification (best-effort)
    if (
      (window as any).chrome &&
      (window as any).chrome.runtime &&
      (window as any).chrome.runtime.sendMessage
    ) {
      try {
        ;(window as any).chrome.runtime.sendMessage({
          type: 'SHOW_NOTIFICATION',
          payload: {
            message
          }
        })
        return
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

function setupCopyClick(btn: HTMLElement, url: string) {
  btn.addEventListener('click', async e => {
    e.preventDefault()
    e.stopPropagation()
    const orig = btn.innerHTML
    const origStyle = btn.style.background

    try {
      // Check if URL is a blob URL
      if (url.startsWith('blob:')) {
        btn.innerHTML = '下载中...'
        btn.style.background = 'linear-gradient(135deg,#3b82f6,#1d4ed8)'

        await downloadBlob(url)

        btn.innerHTML = '已下载'
        btn.style.background = 'linear-gradient(135deg,#10b981,#059669)'
        setTimeout(() => {
          btn.innerHTML = orig
          btn.style.background = origStyle
        }, 1400)
      } else {
        // Regular URL - copy to clipboard
        await navigator.clipboard.writeText(url)
        btn.innerHTML = '已复制'
        btn.style.background = 'linear-gradient(135deg,#10b981,#059669)'
        setTimeout(() => {
          btn.innerHTML = orig
          btn.style.background = origStyle
        }, 1400)
      }
    } catch (err) {
      console.error('[XVideoCopy] 操作失败', err)
      btn.innerHTML = '失败'
      btn.style.background = 'linear-gradient(135deg,#ef4444,#dc2626)'
      setTimeout(() => {
        btn.innerHTML = orig
        btn.style.background = origStyle
      }, 1400)
    }
  })
}

function createCopyBtn(url: string) {
  const btn = document.createElement('button')
  btn.className = 'x-video-copy-btn'
  btn.type = 'button'
  // Update title based on URL type
  btn.title = url.startsWith('blob:') ? '下载视频' : '复制视频地址'
  btn.innerHTML = '📋'
  btn.style.cssText =
    'position:absolute;right:6px;top:6px;z-index:99999;cursor:pointer;border-radius:6px;padding:6px 8px;background:rgba(0,0,0,0.6);color:#fff;border:none;font-weight:700;'
  setupCopyClick(btn, url)
  return btn
}

function createInlineBtn(url: string) {
  const btn = document.createElement('button')
  btn.className = 'x-video-copy-inline-btn'
  btn.type = 'button'
  // Update title based on URL type
  btn.title = url.startsWith('blob:') ? '下载视频' : '复制视频地址'
  btn.innerHTML = '📋'
  // inline style so it sits beside text
  btn.style.cssText = [
    'display:inline-block;vertical-align:middle;margin-left:8px;cursor:pointer;border-radius:6px;padding:2px 6px;',
    'background:rgba(0,0,0,0.06);color:var(--text-color,#0f1419);border:1px solid rgba(0,0,0,0.08);font-weight:600;'
  ].join('')
  setupCopyClick(btn, url)
  return btn
}

function addButtonToVideo(video: HTMLVideoElement) {
  try {
    // avoid duplicates
    const parent = video.parentElement || video
    if ((parent as Element).querySelector('.x-video-copy-btn')) return

    const url = getVideoUrl(video)
    if (!url) return

    const container = parent as HTMLElement
    const computed = window.getComputedStyle(container)
    if (computed.position === 'static' || !computed.position) container.style.position = 'relative'
    const btn = createCopyBtn(url)
    container.appendChild(btn)
    // also try injecting inline buttons into several ancestor levels (与文字并列)
    try {
      addInlineButtonsToAncestors(video, url)
    } catch (e) {
      void e
    }
  } catch (e) {
    void e
  }
}

function addInlineButtonsToAncestors(video: HTMLVideoElement, url: string) {
  // climb up a few ancestor levels and, when we find elements that contain text siblings,
  // insert an inline copy button next to that text so it appears '并列' with text.
  let node: HTMLElement | null = video.parentElement
  const maxLevels = 4

  // First, try to find a tweet text container in ancestors and insert next to it.
  for (let i = 0; i < maxLevels && node; i++) {
    try {
      // if this ancestor already has our inline button, skip
      if (node.querySelector('.x-video-copy-inline-btn')) {
        const p = node.parentElement
        if (!p) break
        node = p
        continue
      }

      const tweetText = node.querySelector('[data-testid="tweetText"]') as HTMLElement | null
      if (tweetText) {
        // insert button after the tweet text element so it sits alongside the text
        if (!tweetText.querySelector('.x-video-copy-inline-btn')) {
          const inline = createInlineBtn(url)
          try {
            // place as a sibling after the tweetText element
            tweetText.insertAdjacentElement('afterend', inline)
          } catch {
            // fallback: append to parent of tweetText
            const parent = tweetText.parentElement
            if (parent) parent.appendChild(inline)
          }
        }
        return
      }
    } catch (e) {
      void e
    }

    const p = node.parentElement
    if (!p) break
    node = p
  }

  // Fallback: original heuristic — search ancestors for text-bearing children and inject inline button
  node = video.parentElement
  for (let i = 0; i < maxLevels && node; i++) {
    try {
      if (node.querySelector('.x-video-copy-inline-btn')) {
        const p = node.parentElement
        if (!p) break
        node = p
        continue
      }

      const hasTextChild = Array.from(node.childNodes).some(n => {
        if (n.nodeType === Node.TEXT_NODE) return !!(n.textContent && n.textContent.trim())
        if (n.nodeType === Node.ELEMENT_NODE) {
          const el = n as HTMLElement
          return !!(el.innerText && el.innerText.trim())
        }
        return false
      })

      if (hasTextChild) {
        const inline = createInlineBtn(url)
        const children = Array.from(node.children)
        let inserted = false
        for (let j = 0; j < children.length; j++) {
          const c = children[j] as HTMLElement
          if (c.innerText && c.innerText.trim()) {
            c.insertAdjacentElement('afterend', inline)
            inserted = true
            break
          }
        }
        if (!inserted) node.appendChild(inline)
      }
    } catch (e) {
      void e
    }

    const p = node.parentElement
    if (!p) break
    node = p
  }
}

function scanAndInjectVideo() {
  const videos = Array.from(document.querySelectorAll('video')) as HTMLVideoElement[]
  videos.forEach(v => {
    // skip very small or hidden videos
    try {
      const rect = v.getBoundingClientRect()
      if (rect.width < 20 || rect.height < 20) return
    } catch {
      // ignore
    }
    addButtonToVideo(v)
  })
}

function observeVideos() {
  const obs = new MutationObserver(ms => {
    let changed = false
    ms.forEach(m => {
      if (m.type === 'childList' || m.type === 'attributes') changed = true
    })
    if (changed) setTimeout(scanAndInjectVideo, 120)
  })
  obs.observe(document.body, { childList: true, subtree: true, attributes: true })
}

export function initVideoCopy() {
  try {
    if (!isXPage()) {
      console.log('[XVideoCopy] skipping init: not X/Twitter host')
      return
    }
    setTimeout(scanAndInjectVideo, 200)
    observeVideos()
    console.log('[XVideoCopy] initialized')
  } catch (e) {
    console.error('[XVideoCopy] init failed', e)
  }
}
