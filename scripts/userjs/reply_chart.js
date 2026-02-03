// ==UserScript==
// @name         Discourse 话题预览按钮 (Topic Preview Button) - 侧边栏 & JSON 版 (左侧按钮版)
// @namespace    https://github.com/stevessr/bug-v3
// @version      1.7.3
// @description  为 Discourse 话题列表添加预览按钮与快捷回复功能，支持侧边栏无感停靠与 JSON 预览，支持最小化到侧边悬浮球，支持多话题标签页切换
// @author       stevessr
// @match        https://linux.do/*
// @match        https://meta.discourse.org/*
// @match        https://*.discourse.org/*
// @match        http://localhost:5173/*
// @exclude      https://linux.do/a/*
// @match        https://idcflare.com/*
// @grant        none
// @license      MIT
// @run-at       document-end
// ==/UserScript==

;(function () {
  'use strict'

  // ===== Utility Functions =====

  function createEl(tag, opts) {
    const el = document.createElement(tag)
    if (!opts) return el
    if (opts.className) el.className = opts.className
    if (opts.text) el.textContent = opts.text
    if (opts.value) el.value = opts.value
    if (opts.style) el.style.cssText = opts.style
    if (opts.attrs) for (const k in opts.attrs) el.setAttribute(k, opts.attrs[k])
    if (opts.dataset) for (const k in opts.dataset) el.dataset[k] = opts.dataset[k]
    if (opts.innerHTML) el.innerHTML = opts.innerHTML
    if (opts.title) el.title = opts.title
    if (opts.id) el.id = opts.id
    if (opts.rows && 'rows' in el) el.rows = opts.rows
    if (opts.placeholder && 'placeholder' in el) el.placeholder = opts.placeholder
    if (opts.on) {
      for (const [evt, handler] of Object.entries(opts.on)) {
        el.addEventListener(evt, handler)
      }
    }
    return el
  }

  function ensureStyleInjected(id, css) {
    if (document.getElementById(id)) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = css
    document.documentElement.appendChild(style)
  }

  // ===== Styles =====

  const STYLES = `
/* 遮罩层 */
.raw-preview-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 2147483647; transition: background 0.2s ease, justify-content 0.2s;
}
.raw-preview-overlay.hidden { display: none !important; }
.raw-preview-overlay.dock-right { justify-content: flex-end; background: transparent; pointer-events: none; }

/* 模态框主体 */
.raw-preview-modal {
  width: 85%; height: 90%; background: var(--color-bg, #fff);
  border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3);
  display: flex; overflow: hidden; pointer-events: auto;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.raw-preview-overlay.dock-right .raw-preview-modal {
  width: 600px; max-width: 100vw; height: 100vh;
  border-radius: 0; border-left: 1px solid rgba(0,0,0,0.1);
  box-shadow: -4px 0 20px rgba(0,0,0,0.1);
}

/* 布局：左侧标签栏 + 右侧内容区 */
.preview-layout-sidebar {
  width: 160px; background: var(--secondary, #f8f8f8);
  border-right: 1px solid rgba(0,0,0,0.08);
  display: flex; flex-direction: column; flex-shrink: 0;
}
.preview-layout-content {
  flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative;
}

/* 标签栏样式 */
.sidebar-header {
  padding: 10px; font-size: 12px; font-weight: bold; color: #999;
  border-bottom: 1px solid rgba(0,0,0,0.05); display: flex; justify-content: space-between;
}
.sidebar-list { flex: 1; overflow-y: auto; padding: 4px; }
.sidebar-tab {
  padding: 8px 10px; margin-bottom: 2px; border-radius: 6px;
  cursor: pointer; font-size: 13px; color: var(--primary, #333);
  display: flex; align-items: center; gap: 6px; transition: background 0.2s;
}
.sidebar-tab:hover { background: rgba(0,0,0,0.05); }
.sidebar-tab.active { background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1); font-weight: 600; color: var(--tertiary, #0088cc); }
.tab-title { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tab-close {
  width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 10px; color: #999; opacity: 0; transition: all 0.2s;
}
.sidebar-tab:hover .tab-close { opacity: 1; }
.tab-close:hover { background: #fee; color: #d00; }

/* 底部工具栏（最小化/关闭） */
.sidebar-footer {
  padding: 8px; border-top: 1px solid rgba(0,0,0,0.08);
  display: flex; gap: 4px; justify-content: center;
}

/* 单个话题的视图容器 */
.topic-view-wrapper {
  display: flex; flex-direction: column; height: 100%; width: 100%;
}
.topic-view-wrapper.hidden { display: none; }

/* 恢复按钮 */
.raw-preview-restore-btn {
  position: fixed; top: 50%; right: 0; transform: translateY(-50%);
  width: 24px; height: 60px; background: var(--tertiary, #0088cc); color: #fff;
  border-radius: 8px 0 0 8px; cursor: pointer; z-index: 2147483648;
  display: none; align-items: center; justify-content: center;
  box-shadow: -2px 0 10px rgba(0,0,0,0.2); font-size: 14px;
}
.raw-preview-restore-btn:hover { width: 36px; background: var(--tertiary-hover, #006699); }

/* 头部样式 */
.raw-preview-header {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  background: #fff; border-bottom: 1px solid rgba(0,0,0,0.08); flex-shrink: 0;
}
.raw-preview-title {
  flex: 1; font-weight: 600; font-size: 14px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  color: var(--primary, #333);
}

/* Iframe */
.raw-preview-iframe { border: none; width: 100%; height: 100%; flex: 1 1 auto; background: var(--reader-mode-bg-color); }

/* 按钮通用 */
.raw-preview-btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 4px 10px; font-size: 12px; border-radius: 6px;
  border: 1px solid rgba(0,0,0,0.1); background: var(--d-button-secondary-bg-color, #fff);
  cursor: pointer; color: var(--primary, #333);
}
.raw-preview-btn:hover { background: var(--d-hover, #f0f0f0); }

/* 下拉框 */
.raw-preview-select {
  padding: 3px 6px; font-size: 12px; border-radius: 6px;
  border: 1px solid rgba(0,0,0,0.1); height: 28px; outline: none;
}

/* 快捷回复 */
.quick-reply-panel {
  display: flex; flex-direction: column; padding: 10px 12px;
  border-top: 1px solid rgba(0,0,0,0.1); background: var(--color-bg, #fff); flex-shrink: 0;
}
.quick-reply-list-container { max-height: 0; overflow-y: auto; transition: max-height 0.3s; }
.quick-reply-list-container.expanded { max-height: 150px; margin-bottom: 8px; border-bottom: 1px solid #eee; }
.quick-reply-item {
  padding: 6px 10px; margin-bottom: 4px; border-radius: 4px;
  background: var(--secondary-very-high, #f9f9f9); cursor: pointer; display: flex; justify-content: space-between;
}
.quick-reply-item:hover { background: var(--tertiary-low, #e6f7ff); }
.quick-reply-input-area { display: flex; gap: 8px; align-items: flex-end; }
.quick-reply-input {
  flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 6px;
  min-height: 38px; height: 38px; max-height: 100px; resize: none; font-family: inherit;
}
.quick-reply-input:focus { border-color: var(--tertiary, #0088cc); outline: none; height: 70px; }
.qr-send-btn {
  height: 38px; padding: 0 16px; border-radius: 19px; border: none;
  background: var(--tertiary, #0088cc); color: #fff; font-weight: bold; cursor: pointer;
}
/* Timer Styles */
.timer-container {
  position: fixed; bottom: 20px; right: 20px;
  display: flex; flex-direction: column; gap: 10px;
  z-index: 2147483649; pointer-events: none;
}
.timer-item {
  background: rgba(0,0,0,0.85); color: #fff;
  padding: 10px 15px; border-radius: 8px;
  font-size: 13px; pointer-events: auto;
  box-shadow: 0 4px 12px rgba(0,0,0,0.25);
  min-width: 220px; transition: all 0.3s;
  backdrop-filter: blur(4px); border: 1px solid rgba(255,255,255,0.1);
}
.timer-item.success { background: rgba(82, 196, 26, 0.95); }
.timer-item.error { background: rgba(255, 77, 79, 0.95); cursor: pointer; }
`
  ensureStyleInjected('raw-preview-styles', STYLES)

  // ===== Logic State =====

  let overlay = null
  let restoreBtn = null
  let isDockRight = localStorage.getItem('preview_dock_right') === 'true'

  let timerContainer = null
  const timers = new Map()

  function getTimerContainer() {
    if (!timerContainer) {
      timerContainer = createEl('div', { className: 'timer-container' })
      document.body.appendChild(timerContainer)
    }
    return timerContainer
  }

  function addTimer(topicId, raw, seconds, replyToPostNumber) {
    const container = getTimerContainer()
    const timerId = Date.now() + Math.random().toString()

    const replyInfo = replyToPostNumber ? `(回复 #${replyToPostNumber})` : ''

    const el = createEl('div', {
      className: 'timer-item',
      innerHTML: `
            <div style="font-weight:bold;margin-bottom:4px">Topic #${topicId} 定时回复 ${replyInfo}</div>
            <div class="timer-status">等待中：<span class="countdown">${seconds}</span>s</div>
            <div class="timer-content" style="font-size:12px;opacity:0.8;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px">${raw}</div>
        `
    })
    container.appendChild(el)

    let remaining = seconds
    const interval = setInterval(async () => {
      remaining--
      const cd = el.querySelector('.countdown')
      if (cd) cd.textContent = remaining

      if (remaining <= 0) {
        clearInterval(interval)
        el.querySelector('.timer-status').textContent = '正在发送...'

        try {
          // Get token afresh in case it changed
          const token = document.querySelector('meta[name="csrf-token"]')?.content
          if (!token) throw new Error('Token not found')

          const fd = new URLSearchParams()
          fd.append('raw', raw)
          fd.append('topic_id', topicId)
          fd.append('archetype', 'regular')
          fd.append('nested_post', 'true')
          if (replyToPostNumber) {
            fd.append('reply_to_post_number', replyToPostNumber)
          }

          const res = await fetch('/posts', {
            method: 'POST',
            headers: {
              'x-csrf-token': token,
              'x-requested-with': 'XMLHttpRequest',
              'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
            body: fd.toString()
          })

          if (!res.ok) {
            const txt = await res.text()
            throw new Error(txt || res.statusText)
          }

          // Success
          el.classList.add('success')
          el.innerHTML = `
                    <div style="font-weight:bold">✅ 发送成功</div>
                    <div style="font-size:12px">Topic #${topicId}</div>
                `
          setTimeout(() => {
            el.style.opacity = '0'
            el.style.transform = 'translateY(20px)'
            setTimeout(() => el.remove(), 300)
          }, 3000)
        } catch (err) {
          // Error
          el.classList.add('error')
          el.innerHTML = `
                    <div style="font-weight:bold">❌ 发送失败 (点击查看)</div>
                    <div style="font-size:12px">Topic #${topicId}</div>
                `
          el.onclick = () => {
            alert(`发送失败\n\nTopic: ${topicId}\nContent: ${raw}\nError: ${err.message}`)
            el.remove()
          }
        }
      }
    }, 1000)

    timers.set(timerId, { interval, el })
  }
  // tabs = [ { id, title, slug } ]
  let tabs = []
  let activeTabId = null
  // views = { [topicId]: { wrapper, iframe, page, mode, ... } }
  let views = {}

  // ===== Helper URLs =====

  function rawUrl(topicId, page) {
    return new URL(`/raw/${topicId}?page=${page}`, window.location.origin).toString()
  }

  function jsonUrl(topicId, page, slug) {
    const s = slug || 'topic'
    return new URL(`/t/${s}/${topicId}.json?page=${page}`, window.location.origin).toString()
  }

  // ===== Core System =====

  function initOverlay() {
    if (overlay) return

    overlay = createEl('div', {
      className: `raw-preview-overlay ${isDockRight ? 'dock-right' : ''}`
    })
    const modal = createEl('div', { className: 'raw-preview-modal' })

    // 1. Sidebar
    const sidebar = createEl('div', { className: 'preview-layout-sidebar' })

    // Sidebar Header
    const sbHeader = createEl('div', { className: 'sidebar-header' })
    sbHeader.innerHTML = `<span>已打开话题</span>`
    // Clear all button
    const clearBtn = createEl('span', { text: '清空', style: 'cursor:pointer;color:#d00;' })
    clearBtn.onclick = closeAllTabs
    sbHeader.appendChild(clearBtn)

    // Sidebar List
    const sbList = createEl('div', { className: 'sidebar-list', id: 'preview-sidebar-list' })

    // Sidebar Footer (Dock & Min & Close)
    const sbFooter = createEl('div', { className: 'sidebar-footer' })
    const btnDock = createEl('button', {
      className: 'raw-preview-btn btn-dock-toggle',
      text: isDockRight ? '◫ 居中' : '◫ 侧边',
      style: 'flex:1'
    })
    btnDock.onclick = toggleDockMode
    const btnMin = createEl('button', { className: 'raw-preview-btn', text: '—', title: '最小化' })
    btnMin.onclick = () => toggleMinimize(true)
    const btnCloseAll = createEl('button', {
      className: 'raw-preview-btn close-btn',
      text: '✕',
      title: '关闭所有'
    })
    btnCloseAll.onclick = closeOverlay

    sbFooter.append(btnDock, btnMin, btnCloseAll)
    sidebar.append(sbHeader, sbList, sbFooter)

    // 2. Content Area
    const contentArea = createEl('div', {
      className: 'preview-layout-content',
      id: 'preview-content-area'
    })

    modal.append(sidebar, contentArea)
    overlay.appendChild(modal)
    document.body.appendChild(overlay)

    // Events
    overlay.addEventListener('click', e => {
      if (e.target === overlay && !isDockRight) closeOverlay()
    })
    window.addEventListener('keydown', handleKeydown)
  }

  function toggleDockMode() {
    isDockRight = !isDockRight
    localStorage.setItem('preview_dock_right', isDockRight)
    if (!overlay) return
    overlay.classList.toggle('dock-right', isDockRight)
    const btn = overlay.querySelector('.btn-dock-toggle')
    if (btn) btn.textContent = isDockRight ? '◫ 居中' : '◫ 侧边'
  }

  function toggleMinimize(minimize) {
    if (!overlay) return
    if (minimize) {
      overlay.classList.add('hidden')
      if (!restoreBtn) createRestoreBtn()
      restoreBtn.style.display = 'flex'
      restoreBtn.title = `恢复预览 (${tabs.length})`
    } else {
      overlay.classList.remove('hidden')
      if (restoreBtn) restoreBtn.style.display = 'none'
    }
  }

  function createRestoreBtn() {
    restoreBtn = createEl('div', { className: 'raw-preview-restore-btn', text: '◀' })
    restoreBtn.onclick = () => toggleMinimize(false)
    document.body.appendChild(restoreBtn)
  }

  function closeOverlay() {
    if (overlay) {
      overlay.remove()
      overlay = null
    }
    if (restoreBtn) {
      restoreBtn.remove()
      restoreBtn = null
    }
    window.removeEventListener('keydown', handleKeydown)
    // Reset state
    tabs = []
    views = {}
    activeTabId = null
  }

  function closeAllTabs() {
    tabs = []
    views = {}
    activeTabId = null
    const list = document.getElementById('preview-sidebar-list')
    const area = document.getElementById('preview-content-area')
    if (list) list.innerHTML = ''
    if (area) area.innerHTML = ''
  }

  function handleKeydown(e) {
    if (!overlay) return
    const tag = e.target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'contenteditable') return
    if (e.key === 'Escape') closeOverlay()
  }

  // ===== Topic Management =====

  function openTopic(topicId, slug, title) {
    initOverlay()
    toggleMinimize(false)

    if (views[topicId]) {
      activateTopic(topicId)
      return
    }

    const newTab = { id: topicId, slug: slug || 'topic', title: title || `话题 #${topicId}` }
    tabs.push(newTab)

    createTopicView(newTab)
    renderSidebar()
    activateTopic(topicId)
  }

  function createTopicView(tab) {
    const area = document.getElementById('preview-content-area')
    if (!area) return

    const wrapper = createEl('div', {
      className: 'topic-view-wrapper hidden',
      id: `view-${tab.id}`
    })

    const viewState = {
      id: tab.id,
      page: 1,
      mode: 'iframe',
      slug: tab.slug,
      jsonIsLoading: false,
      jsonReachedEnd: false
    }

    // --- Header ---
    const header = createEl('div', { className: 'raw-preview-header' })
    const titleEl = createEl('div', { className: 'raw-preview-title', text: tab.title })
    const ctrls = createEl('div', {
      className: 'raw-preview-ctrls',
      style: 'display:flex;gap:6px;'
    })

    const modeSelect = createEl('select', { className: 'raw-preview-select' })
    modeSelect.append(
      createEl('option', { text: 'Raw 视图', value: 'iframe' }),
      createEl('option', { text: 'JSON 视图', value: 'json' })
    )
    modeSelect.value = 'iframe'
    modeSelect.onchange = e => {
      viewState.mode = e.target.value
      viewState.page = 1
      loadContent(viewState, iframe)
    }

    const btnPrev = createEl('button', { className: 'raw-preview-btn', text: '◀' })
    btnPrev.onclick = () => {
      if (viewState.page > 1) {
        viewState.page--
        loadContent(viewState, iframe)
      }
    }
    const btnNext = createEl('button', { className: 'raw-preview-btn', text: '▶' })
    btnNext.onclick = () => {
      viewState.page++
      loadContent(viewState, iframe)
    }

    ctrls.append(modeSelect, btnPrev, btnNext)
    header.append(titleEl, ctrls)

    // --- Iframe ---
    const iframe = createEl('iframe', {
      className: 'raw-preview-iframe',
      attrs: { sandbox: 'allow-same-origin allow-scripts' }
    })

    // --- Quick Reply ---
    const qrPanel = createQuickReplyUI(tab.id, isJsonMode => {
      if (isJsonMode && viewState.mode === 'json') {
        loadContent(viewState, iframe)
      }
    })

    wrapper.append(header, iframe, qrPanel)
    area.appendChild(wrapper)

    views[tab.id] = { wrapper, iframe, state: viewState }

    loadContent(viewState, iframe)
  }

  function activateTopic(topicId) {
    activeTabId = topicId

    const allTabs = document.querySelectorAll('.sidebar-tab')
    allTabs.forEach(t => {
      if (t.dataset.id == topicId) t.classList.add('active')
      else t.classList.remove('active')
    })

    for (const tid in views) {
      if (tid == topicId) {
        views[tid].wrapper.classList.remove('hidden')
      } else {
        views[tid].wrapper.classList.add('hidden')
      }
    }
  }

  function closeTopic(e, topicId) {
    e.stopPropagation()

    tabs = tabs.filter(t => t.id !== topicId)

    if (views[topicId]) {
      views[topicId].wrapper.remove()
      delete views[topicId]
    }

    if (tabs.length === 0) {
      closeOverlay()
    } else if (activeTabId === topicId) {
      activateTopic(tabs[tabs.length - 1].id)
    }

    renderSidebar()
  }

  function renderSidebar() {
    const list = document.getElementById('preview-sidebar-list')
    if (!list) return
    list.innerHTML = ''

    tabs.forEach(tab => {
      const item = createEl('div', {
        className: `sidebar-tab ${tab.id === activeTabId ? 'active' : ''}`,
        dataset: { id: tab.id }
      })
      item.onclick = () => activateTopic(tab.id)

      const t = createEl('span', { className: 'tab-title', text: tab.title })
      const c = createEl('span', { className: 'tab-close', text: '✕', title: '关闭' })
      c.onclick = e => closeTopic(e, tab.id)

      item.append(t, c)
      list.appendChild(item)
    })
  }

  // ===== Content Loading Logic (Raw & JSON) =====

  function loadContent(viewState, iframeEl) {
    if (viewState.mode === 'iframe') {
      iframeEl.src = rawUrl(viewState.id, viewState.page)
    } else {
      renderJsonView(viewState, iframeEl)
    }
  }

  async function renderJsonView(viewState, iframeEl) {
    const doc = iframeEl.contentDocument || iframeEl.contentWindow?.document
    doc.open()
    doc.write(`
      <!doctype html>
      <html><head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
          .post-item { border-bottom: 1px solid #eee; padding: 15px 0; }
          .post-meta {
            font-size: 13px; color: #666; margin-bottom: 8px; display: flex; align-items: center;
            cursor: pointer; padding: 6px; border-radius: 4px; user-select: none; transition: background-color 0.2s;
          }
          .post-meta:hover { background-color: #f0f0f0; }
          .post-body { line-height: 1.6; font-size: 14px; overflow-x: auto; }

          /* === 修复 Lightbox 图片渲染 === */
          .post-body img { max-width: 100%; height: auto; }
          .lightbox-wrapper {
            display: flex; flex-direction: column;
            max-width: 100%; margin: 12px 0;
            overflow: hidden; clear: both;
          }
          .lightbox-wrapper .lightbox {
            display: block; position: relative; max-width: 100%;
          }
          .lightbox-wrapper img {
            max-width: 100% !important; height: auto !important;
            border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          }

          /* === 修复 Meta 高度过高问题 === */
          .lightbox-wrapper .meta {
            font-size: 11px; color: #888;
            margin-top: 4px;
            /* 浅色背景，非常紧凑 */
            background: rgba(0,0,0,0.03);
            padding: 2px 6px; border-radius: 4px;
            display: inline-flex; align-items: center; align-self: flex-start;
            line-height: 1.2;
            width: fit-content;
          }
          /* 核心修复：隐藏 iframe 缺失定义的 SVG 图标，防止撑开高度 */
          .lightbox-wrapper .meta svg {
            display: none !important;
          }
          .lightbox-wrapper .meta .filename {
            font-weight: 500; margin-right: 6px;
            max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            color: #555;
          }

          pre { background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; }
          .loading { text-align: center; color: #999; padding: 20px; }
          .post-toggle { display: inline-block; width: 16px; height: 16px; text-align: center; margin-right: 6px; transition: transform 0.2s ease; color: #0088cc; }
          .post-item.collapsed .post-body { display: none; }
          .post-item.collapsed .post-toggle { transform: rotate(-90deg); color: #999; }
          .post-info { flex: 1; pointer-events: auto; }
          .reply-btn {
              float: right; margin-left: 10px; padding: 2px 8px; font-size: 12px;
              color: #666; cursor: pointer; border: 1px solid #ddd; border-radius: 4px;
          }
          .reply-btn:hover { background: #e6f7ff; color: #0088cc; border-color: #0088cc; }
        </style>
      </head><body>
        <div id="json-container"></div>
        <div id="loading-indicator" class="loading">加载中...</div>
      </body></html>
    `)
    doc.close()

    doc.addEventListener('click', e => {
      // Handle Reply Button Click
      const replyBtn = e.target.closest('.reply-btn')
      if (replyBtn) {
        e.stopPropagation()
        const postNumber = replyBtn.dataset.postNumber
        const username = replyBtn.dataset.username
        // Send message to parent
        window.parent.postMessage(
          { type: 'reply-to-post', topicId: viewState.id, postNumber, username },
          '*'
        )
        return
      }

      const header = e.target.closest('.post-meta')
      if (header) {
        const item = header.closest('.post-item')
        if (item) item.classList.toggle('collapsed')
      }
      // 阻止点击 lightbox 跳转
      const lb = e.target.closest('.lightbox')
      if (lb) {
        e.preventDefault()
      }
    })

    viewState.jsonReachedEnd = false
    viewState.jsonIsLoading = false
    await fetchAndAppendJson(viewState, iframeEl, true)

    const win = iframeEl.contentWindow
    if (win) {
      win.addEventListener('scroll', () => {
        if (viewState.jsonIsLoading || viewState.jsonReachedEnd) return
        const d = win.document
        if (win.innerHeight + win.scrollY >= d.body.offsetHeight - 100) {
          viewState.page++
          fetchAndAppendJson(viewState, iframeEl, false)
        }
      })
    }
  }

  async function fetchAndAppendJson(viewState, iframeEl, isFirst) {
    if (viewState.jsonIsLoading) return
    viewState.jsonIsLoading = true

    const doc = iframeEl.contentDocument || iframeEl.contentWindow?.document
    const container = doc.getElementById('json-container')
    const indicator = doc.getElementById('loading-indicator')
    if (indicator) indicator.style.display = 'block'

    try {
      const res = await fetch(jsonUrl(viewState.id, viewState.page, viewState.slug))
      if (!res.ok) throw new Error('API Error')
      const data = await res.json()
      const posts = data?.post_stream?.posts || []

      if (posts.length === 0) {
        viewState.jsonReachedEnd = true
        if (indicator) indicator.textContent = '--- 已到底部 ---'
        return
      }

      const html = posts
        .map(p => {
          const body = p.cooked || '<p><em>Content unavailable</em></p>'
          return `
          <div class="post-item" id="post-${p.post_number}">
            <div class="post-meta" title="点击折叠/展开">
              <span class="post-toggle">▼</span>
              <div class="post-info">
                <strong>#${p.post_number} ${p.username}</strong>
                <span class="reply-btn" data-post-number="${p.post_number}" data-username="${p.username}">回复</span>
                <span style="float:right">${p.created_at.substring(0, 10)}</span>
              </div>
            </div>
            <div class="post-body">${body}</div>
          </div>
        `
        })
        .join('')

      container.insertAdjacentHTML('beforeend', html)
      if (indicator) indicator.style.display = 'none'
    } catch (e) {
      if (indicator) indicator.textContent = '加载失败：' + e.message
      viewState.jsonReachedEnd = true
    } finally {
      viewState.jsonIsLoading = false
    }
  }

  // ===== Quick Reply Factory =====

  function createQuickReplyUI(topicId, onSuccess) {
    const panel = createEl('div', { className: 'quick-reply-panel' })
    const listContainer = createEl('div', { className: 'quick-reply-list-container' })
    const inputArea = createEl('div', { className: 'quick-reply-input-area' })

    const input = createEl('textarea', {
      className: 'quick-reply-input',
      placeholder: '输入回复 (Ctrl+Enter 发送)',
      rows: 1
    })
    const sendBtn = createEl('button', { className: 'qr-send-btn', text: '发送' })

    // Reply state
    let replyingTo = null // { postNumber, username }

    // Listen for reply events from iframe
    window.addEventListener('message', e => {
      if (e.data && e.data.type === 'reply-to-post' && e.data.topicId === topicId) {
        replyingTo = { postNumber: e.data.postNumber, username: e.data.username }
        updateInputState()
        input.focus()
      }
    })

    const statusEl = createEl('div', {
      className: 'reply-status',
      style: 'font-size:12px;color:#0088cc;margin-bottom:4px;display:none;align-items:center;'
    })
    panel.appendChild(statusEl)

    function updateInputState() {
      if (replyingTo) {
        statusEl.style.display = 'flex'
        statusEl.innerHTML = `<span>回复 <span style="font-weight:bold">@${replyingTo.username}</span> (#${replyingTo.postNumber})</span>`
        const cancelBtn = createEl('span', {
          text: '取消',
          style: 'margin-left:8px;cursor:pointer;color:#999'
        })
        cancelBtn.onclick = () => {
          replyingTo = null
          updateInputState()
        }
        statusEl.appendChild(cancelBtn)
        input.placeholder = `回复 @${replyingTo.username}...`
      } else {
        statusEl.style.display = 'none'
        input.placeholder = '输入回复 (Ctrl+Enter 发送)'
      }
    }

    const timeBtn = createEl('button', {
      className: 'raw-preview-btn',
      innerHTML: '⏱️',
      title: '定时回复',
      style: 'height:38px;width:38px;border-radius:50%;font-size:16px;'
    })
    timeBtn.onclick = () => {
      const raw = input.value.trim()
      if (!raw) return alert('请输入回复内容')
      const secStr = prompt('请输入倒计时秒数:', '10')
      if (!secStr) return
      const seconds = parseInt(secStr, 10)
      if (isNaN(seconds) || seconds <= 0) return alert('无效的秒数')

      addTimer(topicId, raw, seconds, replyingTo?.postNumber)
      input.value = ''
      replyingTo = null
      updateInputState()
    }

    const toggleBtn = createEl('button', {
      className: 'raw-preview-btn',
      innerHTML: '☰',
      title: '预设',
      style: 'height:38px;width:38px;border-radius:50%;'
    })

    // Presets
    let presets = JSON.parse(
      localStorage.getItem('preview_quick_replies') || '["感谢分享！","学到了。","Mark。"]'
    )
    let isExpanded = false

    function renderPresets() {
      listContainer.innerHTML = ''
      presets.forEach((txt, idx) => {
        const item = createEl('div', { className: 'quick-reply-item' })
        const t = createEl('span', { text: txt, style: 'flex:1' })
        t.onclick = () => {
          input.value = txt
          input.focus()
        }
        const d = createEl('span', { text: '×', style: 'color:#999;padding:0 5px' })
        d.onclick = e => {
          e.stopPropagation()
          presets.splice(idx, 1)
          localStorage.setItem('preview_quick_replies', JSON.stringify(presets))
          renderPresets()
        }
        item.append(t, d)
        listContainer.appendChild(item)
      })
      if (input.value.trim()) {
        const saveBtn = createEl('div', {
          className: 'quick-reply-item',
          text: '+ 保存当前输入为预设',
          style: 'justify-content:center;color:#0088cc;font-weight:bold'
        })
        saveBtn.onclick = () => {
          const v = input.value.trim()
          if (v && !presets.includes(v)) {
            presets.push(v)
            localStorage.setItem('preview_quick_replies', JSON.stringify(presets))
            renderPresets()
          }
        }
        listContainer.appendChild(saveBtn)
      }
    }

    toggleBtn.onclick = () => {
      isExpanded = !isExpanded
      listContainer.classList.toggle('expanded', isExpanded)
      if (isExpanded) renderPresets()
    }
    input.addEventListener('input', () => {
      if (isExpanded) renderPresets()
    })

    const doSend = async () => {
      const raw = input.value.trim()
      if (!raw) return
      sendBtn.disabled = true
      sendBtn.text = '...'
      const token = document.querySelector('meta[name="csrf-token"]')?.content
      if (!token) {
        alert('未登录')
        return
      }

      try {
        const fd = new URLSearchParams()
        fd.append('raw', raw)
        fd.append('topic_id', topicId)
        fd.append('archetype', 'regular')
        fd.append('nested_post', 'true')
        if (replyingTo) {
          fd.append('reply_to_post_number', replyingTo.postNumber)
        }
        await fetch('/posts', {
          method: 'POST',
          headers: {
            'x-csrf-token': token,
            'x-requested-with': 'XMLHttpRequest',
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
          },
          body: fd.toString()
        })
        input.value = ''
        sendBtn.text = '发送'
        replyingTo = null
        updateInputState() // Clear reply state
        if (onSuccess) onSuccess(true)
      } catch (e) {
        alert('发送失败')
        sendBtn.text = '重试'
      } finally {
        sendBtn.disabled = false
      }
    }

    sendBtn.onclick = doSend
    input.onkeydown = e => {
      if (e.ctrlKey && e.key === 'Enter') doSend()
    }
    inputArea.append(toggleBtn, input, timeBtn, sendBtn)
    panel.append(listContainer, statusEl, inputArea)
    return panel
  }

  // ===== Injection =====

  function inject() {
    const rows = document.querySelectorAll('tr[data-topic-id]')
    rows.forEach(row => {
      if (row.querySelector('.raw-preview-trigger')) return
      const tid = row.dataset.topicId
      if (!tid) return

      const link = row.querySelector('a.title')
      let slug = 'topic'
      let title = `话题 #${tid}`
      if (link) {
        const m = link.href.match(/\/t\/([^/]+)\/(\d+)/)
        if (m) slug = m[1]
        title = link.innerText || title
      }

      // 改动 1: 样式改为右边距，因为按钮在文字左侧
      const btn = createEl('button', {
        className: 'raw-preview-btn raw-preview-trigger',
        text: '预览',
        style: 'margin-right:8px;font-size:11px;'
      })
      btn.onclick = e => {
        e.preventDefault()
        e.stopPropagation()
        openTopic(tid, slug, title)
      }

      if (link && link.parentElement) {
        link.parentElement.style.display = 'flex'
        link.parentElement.style.alignItems = 'center'
        link.style.flex = '1'
        // 改动 2: 使用 insertBefore 将按钮插入到 link (标题) 之前
        link.parentElement.insertBefore(btn, link)
      } else {
        row.appendChild(btn)
      }
    })
  }

  if (document.querySelector('meta[name*="discourse"]')) {
    setInterval(inject, 2000)
    setTimeout(inject, 500)
  }
})()
