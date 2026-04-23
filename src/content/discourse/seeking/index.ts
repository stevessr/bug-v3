/**
 * LinuxDo 追觅 - 监控 Linux.do 用户活动
 * 模块化重构版本
 */

import { createE, DOA } from '../../utils/dom/createEl'
import { requestSettingFromBackground } from '../../utils/core/requestSetting'

import { CONFIG, categoryMap, categoryColors } from './config'
import { state, saveConfig, loadConfig } from './state'
import {
  css,
  setShadowRoot,
  log,
  formatTimeAgo,
  getTimeAgoColor,
  cleanHtml,
  extractImg,
  getActionIcon,
  formatActionInfo
} from './ui'
import { fetchUser } from './network'
import { channel, broadcastState, broadcastNewAction } from './sync'

let visualUpdateInterval: ReturnType<typeof setInterval> | null = null
const pushedIds = new Set<string>()
let leaderCheckTimeout: number | null = null
let shadowRoot: ShadowRoot | null = null
let ntfyBusy = false

async function sendNtfyNotification(action: any, link: string, excerpt: string) {
  if (!state.enableNtfy || !state.isLeader) return
  const topic = state.ntfyTopic?.trim()
  if (!topic) return

  const server = (state.ntfyServer || 'https://ntfy.sh').trim().replace(/\/+$/, '')
  const endpoint = `${server}/${encodeURIComponent(topic)}`
  const body = `${action.username}: ${action.title}\n${excerpt}`.trim()

  if (ntfyBusy) return
  ntfyBusy = true
  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: {
        Title: `Linux.do · ${action.username}`,
        Click: link,
        Tags: String(action.action_type || '')
      },
      body
    })
  } catch (error) {
    console.warn('[LinuxDoSeeking] ntfy push failed:', error)
  } finally {
    ntfyBusy = false
  }
}

// --- 核心逻辑 ---

function getUserCycleDuration(username: string): number {
  const mult = state.multipliers[username] || 1
  return state.refreshIntervalMs * mult
}

function getUniqueId(action: any): string {
  if (action.id) return action.id
  if (action.topic_id && action.post_number) return `${action.topic_id}_${action.post_number}`
  return `ts_${Date.now()}`
}

// --- 导航函数 ---
function navigateToLink(link: string) {
  // 确保链接格式正确
  const normalizedLink = link.startsWith('/') ? link : `/${link}`

  // 延迟检查 Discourse 路由，确保页面完全加载
  const tryDiscourseRoute = () => {
    try {
      if (
        (window as any).Discourse &&
        (window as any).Discourse.router &&
        typeof (window as any).Discourse.router.transitionTo === 'function'
      ) {
        console.log('[LD-Seeking] Using Discourse router for:', normalizedLink)
        ;(window as any).Discourse.router.transitionTo(normalizedLink)
        return true
      }
    } catch (e) {
      console.warn('[LD-Seeking] Discourse router error:', e)
    }
    return false
  }

  // 立即尝试
  if (tryDiscourseRoute()) return

  // 如果立即失败，等待一下再试（Discourse 可能还在加载）
  setTimeout(() => {
    if (tryDiscourseRoute()) return

    // 回退方案：使用原生导航
    if (normalizedLink.startsWith('/t/') || normalizedLink.startsWith('/u/')) {
      try {
        console.log('[LD-Seeking] Using pushState for:', normalizedLink)
        history.pushState(null, '', normalizedLink)
        // 触发页面导航事件
        window.dispatchEvent(new PopStateEvent('popstate'))
        return
      } catch (e) {
        console.warn('[LD-Seeking] pushState error:', e)
      }
    }

    // 最后的回退方案
    console.log('[LD-Seeking] Using window.open as fallback for:', normalizedLink)
    window.open(`${CONFIG.HOST}${normalizedLink}`, '_blank')
  }, 100)
}

// --- 通知和弹幕 ---
function sendNotification(action: any) {
  const uid = getUniqueId(action)
  if (pushedIds.has(uid)) return
  pushedIds.add(uid)
  if (pushedIds.size > 200) {
    const first = pushedIds.values().next().value
    if (first) pushedIds.delete(first)
  }

  let avatar =
    'https://cdn3.ldstatic.com/original/4X/0/4/6/0461ede0fd44342c749aa3097b60adcea7376e42.webp'
  if (action.avatar_template) avatar = CONFIG.HOST + action.avatar_template.replace('{size}', '64')
  const excerpt = cleanHtml(action.excerpt)
  const link = `${CONFIG.HOST}/t/${action.topic_id}/${action.post_number}`

  void sendNtfyNotification(action, link, excerpt.substring(0, 120))

  if (state.enableDanmaku && shadowRoot) {
    const layer = shadowRoot.getElementById('dm-container')
    if (layer) {
      const isLikeOrReaction = action.action_type === 1 || typeof action.action_type === 'string'
      const isSelfUser =
        state.selfUser && action.acting_username.toLowerCase() === state.selfUser.toLowerCase()
      if (isLikeOrReaction && isSelfUser) {
        const iconPop = createE('div', {
          class: 'dm-icon-pop',
          style: `left: ${10 + Math.random() * 70}vw; top: ${10 + Math.random() * 60}vh;`,
          in: getActionIcon(action.action_type)
        })
        layer.appendChild(iconPop)
        setTimeout(() => iconPop.remove(), 3000)
      }

      const item = createE('div', {
        class: 'dm-item',
        style: `top: ${5 + Math.random() * 80}vh; animation-duration: ${8 + Math.random() * 4}s;`
      })
      item.onclick = () => window.open(link, '_blank')

      const actionInfo = formatActionInfo(action)
      const excerptClass =
        action.action_type === 4 || action.action_type === 5 ? 'dm-excerpt' : 'dm-excerpt-cited'
      item.innerHTML = `
        <div class="dm-top">
          <img src="${avatar}" class="dm-avatar">
          <div class="dm-info">
            <div class="dm-user">${actionInfo.html}</div>
            <div class="dm-title">${action.title}</div>
          </div>
        </div>
        ${excerpt ? `<div class="${excerptClass}">${excerpt}</div>` : ''}
      `
      layer.appendChild(item)
      setTimeout(() => item.remove(), 16000)
    }
  }

  if (state.enableSysNotify && document.hidden) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: avatar,
      title: `${action.username} @ Linux.do`,
      message: `${action.title}\n${excerpt.substring(0, 50)}`
    })
  }
}

// --- 数据处理 ---
async function processUser(user: string, isInitial = false): Promise<boolean> {
  const result = await fetchUser(user, isInitial)
  if (result === 'SKIPPED') return false
  const actions = result
  if (!actions || actions.length === 0) return false

  const latest = actions[0]
  const latestId = getUniqueId(latest)
  const lastSavedId = state.lastIds[user]
  let hasUpdates = false

  if (!lastSavedId) {
    state.lastIds[user] = latestId
    hasUpdates = true
  } else if (latestId !== lastSavedId && !isInitial) {
    const diff = []
    for (const act of actions) {
      if (getUniqueId(act) === lastSavedId) break
      diff.push(act)
    }
    if (diff.length > 0) {
      log(`[${user}] has ${diff.length} new`, 'success')
      diff.reverse().forEach((act, i) =>
        setTimeout(() => {
          sendNotification(act)
          broadcastNewAction(act)
        }, i * 1000)
      )
      state.lastIds[user] = latestId
      hasUpdates = true
    }
  }
  state.data[user] = actions
  log(`[${user}] has ${actions.length} actions`, 'info')
  return hasUpdates
}

async function tickAll() {
  if (!state.isLeader) {
    channel.postMessage({ type: 'cmd_refresh_all' })
    return
  }
  if (state.isProcessing) return
  state.isProcessing = true
  const dot = shadowRoot?.querySelector('.sb-status-dot')
  if (dot) dot.className = 'sb-status-dot loading'

  let hasUpdates = false
  const now = Date.now()
  for (const user of state.users) {
    const updated = await processUser(user, true)
    if (updated) hasUpdates = true
    state.nextFetchTime[user] = now + getUserCycleDuration(user) + Math.random() * 10000
  }
  if (hasUpdates) saveConfig()

  renderFeed()
  broadcastState()

  if (dot) dot.className = 'sb-status-dot ok'
  state.isProcessing = false
}

async function scheduler() {
  if (!state.isLeader || state.isProcessing || state.users.length === 0) return
  const now = Date.now()
  const dueUsers = state.users.filter(u => !state.nextFetchTime[u] || now >= state.nextFetchTime[u])
  if (dueUsers.length === 0) return

  state.isProcessing = true
  const user = dueUsers[0]
  const dot = shadowRoot?.querySelector('.sb-status-dot')
  if (dot) dot.className = 'sb-status-dot loading'

  const hasUpdates = await processUser(user, false)
  state.nextFetchTime[user] = Date.now() + getUserCycleDuration(user) + Math.random() * 10000
  if (hasUpdates) saveConfig()

  renderFeed()
  broadcastState()
  if (dot) dot.className = 'sb-status-dot ok'
  state.isProcessing = false
}

function takeLeadership() {
  if (state.isLeader) return
  if (leaderCheckTimeout) {
    clearTimeout(leaderCheckTimeout)
    leaderCheckTimeout = null
  }
  state.isLeader = true
  channel.postMessage({ type: 'leader_takeover' })
  scheduler()
}

function attemptLeadership() {
  channel.postMessage({ type: 'leader_check' })
  leaderCheckTimeout = window.setTimeout(() => {
    state.isLeader = true
    leaderCheckTimeout = null
    tickAll()
  }, 200)
}

function removeUser(name: string) {
  if (!state.isLeader) {
    channel.postMessage({ type: 'cmd_remove_user', username: name })
    return
  }
  state.users = state.users.filter(u => u !== name)
  delete state.lastIds[name]
  delete state.multipliers[name]
  saveConfig()
  renderSidebarRows()
  renderFeed()
  broadcastState()
}

function toggleUserVisibility(name: string) {
  if (state.hiddenUsers.has(name)) state.hiddenUsers.delete(name)
  else state.hiddenUsers.add(name)
  saveConfig()

  const row = shadowRoot?.getElementById(`row-${name}`)
  if (row) {
    const isHidden = state.hiddenUsers.has(name)
    row.className = `sb-user-row ${isHidden ? '' : 'active'}`
    const nameEl = row.querySelector('.sb-user-name')
    if (nameEl) {
      nameEl.className = `sb-user-name ${isHidden ? 'disabled' : ''}`
      ;(nameEl as HTMLElement).style.color = isHidden ? '' : ''
    }
    const timer = shadowRoot?.getElementById(`timer-${name}`)
    if (timer) {
      const circle = timer.querySelector('.timer-progress')
      if (circle)
        circle.setAttribute('stroke', isHidden ? 'var(--primary-medium)' : 'var(--tertiary)')
    }
  }
  renderFeed()
  broadcastState()
}

async function refreshSingleUser(username: string) {
  if (!state.isLeader) {
    channel.postMessage({ type: 'cmd_refresh_user', username })
    return
  }
  if (state.isProcessing) return
  state.isProcessing = true
  const dot = shadowRoot?.querySelector('.sb-status-dot')
  if (dot) dot.className = 'sb-status-dot loading'
  const hasUpdates = await processUser(username, false)
  state.nextFetchTime[username] =
    Date.now() + getUserCycleDuration(username) + Math.random() * 10000
  if (hasUpdates) saveConfig()
  renderFeed()
  broadcastState()
  if (dot) dot.className = 'sb-status-dot ok'
  state.isProcessing = false
}

// --- UI 渲染 ---

function renderSidebarRows() {
  if (!shadowRoot) return
  const div = shadowRoot.getElementById('sb-tags')
  if (!div) return
  div.innerHTML = ''

  state.users.forEach(u => {
    const isHidden = state.hiddenUsers.has(u)
    const userColor = 'var(--tertiary)'
    const row = createE('div', {
      id: `row-${u}`,
      class: `sb-user-row ${isHidden ? '' : 'active'}`
    })

    const timerSize = 10,
      timerStroke = 2
    const timerRadius = (timerSize - timerStroke) / 2
    const timerCircum = 2 * Math.PI * timerRadius

    const timerSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    timerSvg.setAttribute('width', timerSize.toString())
    timerSvg.setAttribute('height', timerSize.toString())
    timerSvg.setAttribute('class', 'sb-timer-circle')
    timerSvg.id = `timer-${u}`
    timerSvg.style.cursor = 'pointer'
    timerSvg.setAttribute('data-circumference', timerCircum.toString())
    timerSvg.innerHTML = `
      <title>刷新间隔</title>
      <circle cx="${timerSize / 2}" cy="${timerSize / 2}" r="${timerRadius}"
        fill="none" stroke="var(--primary-low)" stroke-width="${timerStroke}"/>
      <circle class="timer-progress" cx="${timerSize / 2}" cy="${timerSize / 2}" r="${timerRadius}"
        fill="none" stroke="${isHidden ? 'var(--primary-medium)' : userColor}" stroke-width="${timerStroke}"
        stroke-dasharray="${timerCircum}" stroke-dashoffset="${timerCircum}"
        transform="rotate(-90 ${timerSize / 2} ${timerSize / 2})"/>
    `
    timerSvg.onclick = e => {
      e.stopPropagation()
      refreshSingleUser(u)
    }

    const activityEl = createE('div', {
      class: 'sb-user-activity',
      id: `activity-${u}`,
      in: '<span title="最近发帖">--</span><span title="最近动态">--</span><span title="最近在线">--</span>'
    })

    const nameEl = createE('div', {
      class: `sb-user-name ${isHidden ? 'disabled' : ''}`,
      text: u
    })

    row.appendChild(timerSvg)
    row.appendChild(nameEl)
    row.appendChild(activityEl)
    row.onclick = () => toggleUserVisibility(u)
    div.appendChild(row)
  })
}

// 优化：避免重复绑定事件监听器
let feedClickHandlerBound = false

function renderFeed() {
  if (!shadowRoot) return
  const div = shadowRoot.getElementById('sb-list')
  if (!div) return
  const all: any[] = []
  Object.entries(state.data).forEach(([user, arr]) => {
    if (!state.hiddenUsers.has(user)) all.push(...arr)
  })
  all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  if (all.length === 0) {
    div.innerHTML = `<div style="text-align:center;color:var(--primary-medium);margin-top:40px;font-size:12px;">暂无数据或正在连接...</div>`
    return
  }

  // 优化：仅在第一次调用时绑定事件委托，避免重复绑定
  if (!feedClickHandlerBound) {
    div.addEventListener('click', e => {
      const card = (e.target as HTMLElement).closest('.sb-card')
      if (card) {
        const link = card.getAttribute('data-link')
        if (link) {
          navigateToLink(link)
        }
      }
    })
    feedClickHandlerBound = true
  }

  // 优化：使用增量更新而非完全替换 innerHTML
  const existingCards = new Map<string, HTMLElement>()
  div.querySelectorAll('.sb-card').forEach(card => {
    const link = card.getAttribute('data-link')
    if (link) existingCards.set(link, card as HTMLElement)
  })

  const fragment = document.createDocumentFragment()
  all.forEach(item => {
    let avatar =
      'https://cdn3.ldstatic.com/original/3X/9/d/9dd4973138ccd78e8907865261d7b14d45a96d1c.png'
    if (item.avatar_template) avatar = CONFIG.HOST + item.avatar_template.replace('{size}', '48')

    const date = new Date(item.created_at)
    const now = new Date()
    const timeStr =
      date.toDateString() === now.toDateString()
        ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
        : date.toLocaleString('en-US', { month: 'short', day: '2-digit' })

    const catName = categoryMap.get(item.category_id) || '未分区'
    const catColor = categoryColors[catName] || '#9e9e9e'

    const excerpt = cleanHtml(item.excerpt)
    const imgUrl = extractImg(item.excerpt)
    const link = `/t/${item.topic_id}/${item.post_number}`
    const actionInfo = formatActionInfo(item)
    const excerptClass =
      item.action_type === 4 || item.action_type === 5 ? 'sb-card-excerpt' : 'sb-card-excerpt-cited'

    // 检查是否已存在相同的卡片，如果存在则复用
    const existing = existingCards.get(link)
    if (existing) {
      fragment.appendChild(existing)
      existingCards.delete(link)
    } else {
      // 新建卡片元素
      const cardDiv = createE('div', {
        class: 'sb-card',
        attrs: { 'data-link': link },
        in: `
        <div class="sb-card-head">
          <img src="${avatar}" class="sb-avatar">
          <div class="sb-card-info">
            <div class="sb-user-box">${actionInfo.html}</div>
            <div class="sb-card-title">${item.title}</div>
          </div>
        </div>
        ${excerpt ? `<div class="${excerptClass}">${excerpt}</div>` : ''}
        ${imgUrl ? `<img src="${imgUrl}" class="sb-card-img" loading="lazy">` : ''}
        <div class="sb-card-foot">
          <span class="sb-badge" style="color:${catColor};background:${catColor}15">${catName}</span>
          <span class="sb-timestr">${timeStr}</span>
        </div>
      `
      })
      fragment.appendChild(cardDiv)
    }
  })

  // 一次性替换所有内容
  div.textContent = ''
  div.appendChild(fragment)
}

function startVisualUpdates() {
  if (visualUpdateInterval) return
  visualUpdateInterval = setInterval(() => {
    if (!shadowRoot) return
    state.users.forEach(u => {
      const timerEl = shadowRoot?.getElementById(`timer-${u}`)
      if (timerEl) {
        const titleEl = timerEl.querySelector('title')
        if (titleEl) {
          const duration = getUserCycleDuration(u)
          const timerTitle = `刷新间隔：${(duration / 1000).toFixed(0)}s`
          if (titleEl.textContent !== timerTitle) {
            titleEl.textContent = timerTitle
          }
        }
      }

      const activityEl = shadowRoot?.getElementById(`activity-${u}`)
      if (!activityEl) return
      const isHidden = state.hiddenUsers.has(u)
      const profile = state.userProfiles[u]
      const userData = state.data[u]

      if (profile) {
        const spans = activityEl.querySelectorAll('span')
        if (spans.length >= 3) {
          const postedIso = profile.last_posted_at
          const actionIso = userData?.[0]?.created_at
          const seenIso = profile.last_seen_at

          const postedAgo = postedIso ? formatTimeAgo(postedIso) : '--'
          if (spans[0].textContent !== postedAgo) spans[0].textContent = postedAgo
          ;(spans[0] as HTMLElement).style.color = isHidden
            ? 'var(--primary-medium)'
            : getTimeAgoColor(postedIso)

          const lastActionAgo = actionIso ? formatTimeAgo(actionIso) : '--'
          if (spans[1].textContent !== lastActionAgo) spans[1].textContent = lastActionAgo
          ;(spans[1] as HTMLElement).style.color = isHidden
            ? 'var(--primary-medium)'
            : getTimeAgoColor(actionIso)

          const seenAgo = seenIso ? formatTimeAgo(seenIso) : '--'
          if (spans[2].textContent !== seenAgo) spans[2].textContent = seenAgo
          ;(spans[2] as HTMLElement).style.color = isHidden
            ? 'var(--primary-medium)'
            : getTimeAgoColor(seenIso)
        }
      }
    })
  }, 1000)
  console.log('[LinuxDo] Visual updates started')
}

function stopVisualUpdates() {
  if (visualUpdateInterval) {
    clearInterval(visualUpdateInterval)
    visualUpdateInterval = null
    console.log('[LinuxDo] Visual updates stopped')
  }
}

function startVisualLoops() {
  const updateTimers = () => {
    if (!shadowRoot) return
    const now = Date.now()
    state.users.forEach(u => {
      const timerEl = shadowRoot?.getElementById(`timer-${u}`)
      if (!timerEl) return
      const progressCircle = timerEl.querySelector('.timer-progress')
      if (!progressCircle) return

      const next = state.nextFetchTime[u]
      const totalDuration = getUserCycleDuration(u)
      const circumference = parseFloat(timerEl.getAttribute('data-circumference') || '0')

      if (next) {
        const remaining = Math.max(0, next - now)
        const progress = Math.min(1, Math.max(0, remaining / totalDuration))
        const offset = circumference * (1 - progress)
        ;(progressCircle as HTMLElement).style.strokeDashoffset = offset.toString()
      } else {
        ;(progressCircle as HTMLElement).style.strokeDashoffset = '0'
      }
    })
    requestAnimationFrame(updateTimers)
  }
  requestAnimationFrame(updateTimers)
}

function createUI() {
  const host = createE('div', {
    id: 'ld-seeking-host',
    class: `pos-${state.sidebarPosition}`
  })
  DOA(host)
  const root = host.attachShadow({ mode: 'open' })
  setShadowRoot(root)
  shadowRoot = root

  const style = createE('style', { text: css })
  shadowRoot.appendChild(style)

  const container = createE('div', {
    in: `
    <div id="dm-container" class="dm-container"></div>
    <div id="ld-sidebar" class="${state.isCollapsed ? 'collapsed' : ''}">
        <div id="ld-toggle-ball" title="切换侧边栏">👀</div>
        <div class="sb-header">
            <div class="sb-title-row">
                <div class="sb-title"><div class="sb-status-dot ok"></div> 追觅 · Seeking</div>
                <div class="sb-tools">
                    <button id="btn-dm" class="sb-icon-btn ${state.enableDanmaku ? 'active' : ''}" title="弹幕">💬</button>
                    <button id="btn-sys" class="sb-icon-btn ${state.enableSysNotify ? 'active' : ''}" title="通知">🔔</button>
                    <button id="btn-refresh" class="sb-icon-btn" title="刷新">🔄</button>
                </div>
            </div>
            <div id="sb-tags" class="sb-tags"></div>
        </div>
        <div id="sb-list" class="sb-list"></div>
        <div id="sb-console" class="sb-console"></div>
    </div>`
  })
  shadowRoot.appendChild(container)

  // 绑定事件
  shadowRoot.getElementById('ld-toggle-ball')?.addEventListener('click', () => {
    const bar = shadowRoot?.getElementById('ld-sidebar')
    if (bar) {
      bar.classList.toggle('collapsed')
      state.isCollapsed = bar.classList.contains('collapsed')
      sessionStorage.setItem('ld_is_collapsed', String(state.isCollapsed))

      // 优化：折叠时仅暂停视觉更新，调度器继续运行以监控用户动态
      if (state.isCollapsed) {
        stopVisualUpdates()
      } else {
        startVisualUpdates()
      }
    }
  })

  shadowRoot
    .getElementById('btn-dm')
    ?.addEventListener('click', function (this: GlobalEventHandlers, _ev: MouseEvent) {
      const el = this as HTMLElement
      state.enableDanmaku = !state.enableDanmaku
      el.className = `sb-icon-btn ${state.enableDanmaku ? 'active' : ''}`
      saveConfig()
      channel.postMessage({
        type: 'cmd_config_sync',
        key: 'enableDanmaku',
        value: state.enableDanmaku
      })
    })

  shadowRoot
    .getElementById('btn-sys')
    ?.addEventListener('click', function (this: GlobalEventHandlers, _ev: MouseEvent) {
      const el = this as HTMLElement
      state.enableSysNotify = !state.enableSysNotify
      el.className = `sb-icon-btn ${state.enableSysNotify ? 'active' : ''}`
      if (
        state.enableSysNotify &&
        'Notification' in window &&
        Notification.permission !== 'granted'
      ) {
        Notification.requestPermission()
      }
      saveConfig()
      channel.postMessage({
        type: 'cmd_config_sync',
        key: 'enableSysNotify',
        value: state.enableSysNotify
      })
    })

  const refreshBtn = shadowRoot?.getElementById('btn-refresh')
  if (refreshBtn) {
    refreshBtn.onclick = () => tickAll()
  }

  renderSidebarRows()
  startVisualLoops()
  window.addEventListener('focus', takeLeadership)

  log('Engine started.', 'success')

  // 调度器始终运行以监控用户动态，视觉更新仅在侧边栏展开时启动
  setInterval(() => scheduler(), 1000)
  if (!state.isCollapsed) {
    startVisualUpdates()
  }
}

// 导出初始化函数
let seekingInitialized = false

export async function initLinuxDoSeeking() {
  // 检查是否在 linux.do 域名
  if (!window.location.hostname.includes('linux.do')) {
    return
  }
  if (seekingInitialized || document.getElementById('ld-seeking-host')) {
    console.warn('[LinuxDoSeeking] Already initialized, skip')
    return
  }
  seekingInitialized = true

  // 从设置加载配置
  const saved = await loadConfig()
  state.users = (saved.users as string[]) || []
  state.lastIds = (saved.lastIds as Record<string, string>) || {}
  state.enableSysNotify = saved.enableSysNotify !== false
  state.enableDanmaku = saved.enableDanmaku !== false
  state.hiddenUsers = new Set((saved.hiddenUsers as string[]) || [])

  // 从扩展设置加载用户列表
  try {
    const users = await requestSettingFromBackground('linuxDoSeekingUsers')
    if (Array.isArray(users) && users.length > 0) {
      state.users = users.slice(0, CONFIG.MAX_USERS)
    }

    const enableDanmaku = await requestSettingFromBackground('enableLinuxDoSeekingDanmaku')
    if (typeof enableDanmaku === 'boolean') {
      state.enableDanmaku = enableDanmaku
    }

    const enableSysNotify = await requestSettingFromBackground('enableLinuxDoSeekingSysNotify')
    if (typeof enableSysNotify === 'boolean') {
      state.enableSysNotify = enableSysNotify
    }

    const enableNtfy = await requestSettingFromBackground('enableLinuxDoSeekingNtfy')
    if (typeof enableNtfy === 'boolean') {
      state.enableNtfy = enableNtfy
    }

    const ntfyTopic = await requestSettingFromBackground('linuxDoSeekingNtfyTopic')
    if (typeof ntfyTopic === 'string') {
      state.ntfyTopic = ntfyTopic
    }

    const ntfyServer = await requestSettingFromBackground('linuxDoSeekingNtfyServer')
    if (typeof ntfyServer === 'string') {
      state.ntfyServer = ntfyServer
    }

    const refreshInterval = await requestSettingFromBackground('linuxDoSeekingRefreshIntervalMs')
    if (typeof refreshInterval === 'number' && refreshInterval >= 10000) {
      state.refreshIntervalMs = refreshInterval
    }

    const position = await requestSettingFromBackground('linuxDoSeekingPosition')
    if (
      position === 'left' ||
      position === 'right' ||
      position === 'top' ||
      position === 'bottom'
    ) {
      state.sidebarPosition = position
    }

    const actionFilter = await requestSettingFromBackground('linuxDoSeekingActionFilter')
    if (
      actionFilter === '1' ||
      actionFilter === '4' ||
      actionFilter === '5' ||
      actionFilter === '1,5' ||
      actionFilter === '1,4,5'
    ) {
      state.actionFilter = actionFilter
    }
  } catch (e) {
    console.warn('[LinuxDoSeeking] Failed to load settings from background', e)
  }

  attemptLeadership()
  createUI()

  console.log('[LinuxDoSeeking] Initialized')
}

// --- BroadcastChannel 消息处理 ---
channel.onmessage = event => {
  const msg = event.data
  if (msg.type === 'leader_check') {
    if (state.isLeader) channel.postMessage({ type: 'leader_here' })
  } else if (msg.type === 'leader_here') {
    if (leaderCheckTimeout) {
      clearTimeout(leaderCheckTimeout)
      leaderCheckTimeout = null
    }
    state.isLeader = false
    channel.postMessage({ type: 'data_request' })
  } else if (msg.type === 'data_request') {
    if (state.isLeader) broadcastState()
  } else if (msg.type === 'leader_resign') {
    setTimeout(() => attemptLeadership(), Math.random() * 300)
  } else if (msg.type === 'leader_takeover') {
    if (state.isLeader) {
      state.isLeader = false
      if (leaderCheckTimeout) clearTimeout(leaderCheckTimeout)
      broadcastState()
    }
  } else if (msg.type === 'data_update') {
    if (!state.isLeader) {
      if (msg.users && JSON.stringify(msg.users) !== JSON.stringify(state.users)) {
        state.users = msg.users || []
        renderSidebarRows()
      }
      state.data = msg.data
      state.lastIds = msg.lastIds
      if (msg.hiddenUsers) state.hiddenUsers = new Set(msg.hiddenUsers)
      if (msg.nextFetchTime) state.nextFetchTime = msg.nextFetchTime
      if (msg.multipliers) state.multipliers = msg.multipliers
      if (msg.userProfiles) state.userProfiles = msg.userProfiles
      renderFeed()
    }
  } else if (msg.type === 'new_action') {
    if (!state.isLeader && state.enableDanmaku) sendNotification(msg.action)
  } else if (msg.type === 'cmd_refresh_all') {
    if (state.isLeader) tickAll()
  } else if (msg.type === 'cmd_refresh_user') {
    if (state.isLeader) refreshSingleUser(msg.username)
  } else if (msg.type === 'cmd_config_sync') {
    if (msg.key === 'enableDanmaku') state.enableDanmaku = msg.value
    if (msg.key === 'enableSysNotify') state.enableSysNotify = msg.value
    saveConfig()
    if (shadowRoot) {
      const btn = shadowRoot.getElementById(msg.key === 'enableDanmaku' ? 'btn-dm' : 'btn-sys')
      if (btn) btn.className = `sb-icon-btn ${msg.value ? 'active' : ''}`
    }
  } else if (msg.type === 'cmd_add_user') {
    if (
      state.isLeader &&
      !state.users.includes(msg.username) &&
      state.users.length < CONFIG.MAX_USERS
    ) {
      fetchUser(msg.username, true)
        .then(res => {
          if (res && res !== 'SKIPPED') {
            state.users.push(msg.username)
            saveConfig()
            renderSidebarRows()
            tickAll()
          }
        })
        .catch(error => {
          console.error('[LinuxDo] Failed to fetch user:', msg.username, error)
        })
    } else if (state.users.length >= CONFIG.MAX_USERS) {
      log(`Max ${CONFIG.MAX_USERS} users reached.`, 'error')
    }
  } else if (msg.type === 'cmd_remove_user') {
    if (state.isLeader) removeUser(msg.username)
  }
}

window.addEventListener('beforeunload', () => {
  if (state.isLeader) channel.postMessage({ type: 'leader_resign' })
})
