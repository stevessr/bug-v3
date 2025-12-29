/**
 * LinuxDo 追觅 - 监控 Linux.do 用户活动
 * 从 scripts/userjs/seek.user.js 移植，适配浏览器扩展环境
 */

import { requestSettingFromBackground } from '../../utils/requestSetting'

// --- 配置 ---
const CONFIG = {
  MAX_USERS: 5,
  SIDEBAR_WIDTH: '300px',
  REFRESH_INTERVAL_MS: 60 * 1000,
  LOG_LIMIT_PER_USER: 10,
  HOST: 'https://linux.do'
}

// 颜色定义
const nameColors = [
  'var(--gold)', // 用户自己
  'var(--tertiary)', // 关注用户 1
  'var(--love)', // 关注用户 2
  '#4d5ef7',
  '#c77dff',
  '#00ff88',
  '#f87ecaff'
]

// 类别定义
const categoryColors: Record<string, string> = {
  开发调优: '#32c3c3',
  国产替代: '#D12C25',
  资源荟萃: '#12A89D',
  网盘资源: '#16b176',
  文档共建: '#9cb6c4',
  跳蚤市场: '#ED207B',
  非我莫属: '#a8c6fe',
  读书成诗: '#e0d900',
  扬帆起航: '#ff9838',
  前沿快讯: '#BB8FCE',
  网络记忆: '#F7941D',
  福利羊毛: '#E45735',
  搞七捻三: '#3AB54A',
  社区孵化: '#ffbb00',
  运营反馈: '#808281',
  深海幽域: '#45B7D1',
  未分区: '#9e9e9e',
  积分乐园: '#fcca44',
  人工智能: '#00d4ff',
  软件分享: '#4dabf7'
}

const categoryMap = new Map<number, string>()
const category_dict: Record<string, number[]> = {
  开发调优: [4, 20, 31, 88],
  国产替代: [98, 99, 100, 101],
  深海幽域: [45, 57, 58, 59],
  资源荟萃: [14, 83, 84, 85],
  网盘资源: [94, 95, 96, 97],
  文档共建: [42, 75, 76, 77],
  非我莫属: [27, 72, 73, 74],
  读书成诗: [32, 69, 70, 71],
  前沿快讯: [34, 78, 79, 80],
  网络记忆: [92],
  福利羊毛: [36, 60, 61, 62],
  搞七捻三: [11, 35, 89, 21],
  社区孵化: [102, 103, 104, 105],
  跳蚤市场: [10, 13, 81, 82],
  运营反馈: [2, 15, 16, 27],
  扬帆起航: [46, 66, 67, 68],
  积分乐园: [106, 107, 108, 109]
}

for (const name in category_dict) {
  category_dict[name].forEach(id => categoryMap.set(id, name))
}

// --- 状态管理 ---
interface UserProfile {
  last_posted_at: string
  last_seen_at: string
}

interface State {
  users: string[]
  lastIds: Record<string, string>
  multipliers: Record<string, number>
  enableSysNotify: boolean
  enableDanmaku: boolean
  data: Record<string, any[]>
  isCollapsed: boolean
  isProcessing: boolean
  hiddenUsers: Set<string>
  selfUser: string | null
  nextFetchTime: Record<string, number>
  userProfiles: Record<string, UserProfile>
  isLeader: boolean
}

function getSelfUser(): string | null {
  try {
    const preloaded = document.getElementById('data-preloaded')
    if (preloaded) {
      const data = JSON.parse((preloaded as HTMLElement).dataset.preloaded || '{}')
      if (data.currentUser) {
        return JSON.parse(data.currentUser).username
      }
    }
  } catch (e) {
    // ignore
  }
  return null
}

let shadowRoot: ShadowRoot | null = null
const pushedIds = new Set<string>()

// 优化：定时器控制，在侧边栏折叠时暂停视觉更新以节省 CPU
// 注意：调度器 (scheduler) 需要持续运行以监控用户动态
let visualUpdateInterval: ReturnType<typeof setInterval> | null = null

const state: State = {
  users: [],
  lastIds: {},
  multipliers: {},
  enableSysNotify: true,
  enableDanmaku: true,
  data: {},
  isCollapsed: sessionStorage.getItem('ld_is_collapsed') !== 'false',
  isProcessing: false,
  hiddenUsers: new Set(),
  selfUser: getSelfUser(),
  nextFetchTime: {},
  userProfiles: {},
  isLeader: false
}

// 优化：视觉更新控制函数，在侧边栏折叠时暂停以节省 CPU
function startVisualUpdates() {
  if (visualUpdateInterval) return
  visualUpdateInterval = setInterval(() => {
    if (!shadowRoot) return
    state.users.forEach(u => {
      const timerEl = shadowRoot!.getElementById(`timer-${u}`)
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

      const activityEl = shadowRoot!.getElementById(`activity-${u}`)
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

// --- 工具函数 ---
function formatTimeAgo(isoTime: string | null): string {
  if (!isoTime) return '--'
  const diff = Date.now() - new Date(isoTime).getTime()
  if (diff < 0) return '0m'
  const secs = Math.floor(diff / 1000)
  const mins = Math.floor(secs / 60)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d`
  if (hours > 0) return `${hours}h`
  if (mins > 0) return `${mins}m`
  return `${secs}s`
}

function getTimeAgoColor(isoTime: string | null): string {
  if (!isoTime) return 'var(--primary-medium)'
  const diff = Date.now() - new Date(isoTime).getTime()
  const maxTime = 1 * 60 * 60 * 1000
  if (diff < maxTime) return 'var(--success)' // 最近1小时显示绿色
  return 'var(--primary-medium)'
}

function getUserColor(username: string): string {
  const idx = state.users.indexOf(username)
  return nameColors[1 + (idx % nameColors.length)]
}

function getIntervalMultiplier(lastSeenAt: string | null): number {
  const collapsedMult = state.isCollapsed ? 2 : 1
  if (!lastSeenAt) return 20 * collapsedMult
  const diff = Date.now() - new Date(lastSeenAt).getTime()
  const minutes = diff / (1000 * 60)
  if (minutes < 2) return 1 * collapsedMult
  if (minutes < 10) return 1.5 * collapsedMult
  if (minutes < 60) return 4 * collapsedMult
  if (minutes < 120) return 5 * collapsedMult
  return 20 * collapsedMult
}

function getUserCycleDuration(username: string): number {
  const mult = state.multipliers[username] || 1
  return CONFIG.REFRESH_INTERVAL_MS * mult
}

// --- BroadcastChannel ---
const CHANNEL_NAME = 'ld_seeking_channel'
const channel = new BroadcastChannel(CHANNEL_NAME)
let leaderCheckTimeout: number | null = null

async function saveConfig() {
  const store = {
    users: state.users,
    lastIds: state.lastIds,
    enableSysNotify: state.enableSysNotify,
    enableDanmaku: state.enableDanmaku,
    hiddenUsers: Array.from(state.hiddenUsers)
  }
  // 使用 chrome.storage.local 代替 GM_setValue
  await chrome.storage.local.set({ ld_v21_config: JSON.stringify(store) })
}

async function loadConfig() {
  try {
    const result = await chrome.storage.local.get('ld_v21_config')
    return JSON.parse(result.ld_v21_config || '{}')
  } catch {
    return {}
  }
}

function broadcastState() {
  channel.postMessage({
    type: 'data_update',
    data: state.data,
    lastIds: state.lastIds,
    hiddenUsers: Array.from(state.hiddenUsers),
    nextFetchTime: state.nextFetchTime,
    multipliers: state.multipliers,
    userProfiles: state.userProfiles,
    users: state.users
  })
}

// --- 网络请求 (使用 fetch 代替 GM_xmlhttpRequest) ---
async function safeFetch(url: string): Promise<any> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      Accept: 'application/json'
    }
  })

  if (response.status >= 200 && response.status < 300) {
    return await response.json()
  } else {
    throw new Error(`Status ${response.status}`)
  }
}

// CSS 样式
const css = `
    :host {
        all: initial;
        font-family: var(--font-family, system-ui, -apple-system, sans-serif);
        font-size: var(--font-down-1, 14px);
        z-index: 2147483647;
        position: fixed; top: 0; left: 0;
        pointer-events: none;
        width: 100vw; height: 100vh;
        color: var(--primary);
    }

    /* 侧边栏容器 */
    #ld-sidebar {
        position: fixed; top: 0; left: 0;
        width: ${CONFIG.SIDEBAR_WIDTH}; height: 100vh;
        background: var(--secondary);
        border-right: 1px solid var(--primary-low);
        display: flex; flex-direction: column;
        box-shadow: var(--shadow-menu-panel, 5px 0 25px rgba(0,0,0,0.1));
        transition: transform 0.3s cubic-bezier(0.2, 0, 0, 1);
        pointer-events: auto; overflow: visible;
    }
    #ld-sidebar.collapsed { transform: translateX(-${CONFIG.SIDEBAR_WIDTH}); }

    /* 切换按钮 */
    #ld-toggle-ball {
        position: absolute; right: -24px; top: 50vh;
        width: 24px; height: 48px;
        background: var(--header_background);
        border: 1px solid var(--primary-low);
        border-left: none;
        border-radius: 0 100px 100px 0;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        color: var(--tertiary);
        box-shadow: 2px 0 10px rgba(0,0,0,0.05);
        pointer-events: auto; transition: 0.2s;
    }
    #ld-toggle-ball:hover { width: 32px; background: var(--tertiary-low); }

    /* 头部 */
    .sb-header {
        padding: 8px;
        background: var(--header_background);
        flex-shrink: 0;
        border-bottom: 1px solid var(--primary-low);
    }
    .sb-title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .sb-title {
        font-weight: bold;
        font-size: var(--font-up-1, 15px);
        color: var(--header_primary);
        display: flex; align-items: center; gap: 8px;
    }

    .sb-status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--primary-medium); transition: 0.3s; }
    .sb-status-dot.ok { background: var(--success); box-shadow: 0 0 6px var(--success); }
    .sb-status-dot.loading { background: var(--gold); animation: pulse 1s infinite; }

    .sb-tools { display: flex; gap: 4px; }
    .sb-icon-btn {
        background: transparent;
        border: 1px solid transparent;
        color: var(--primary-medium);
        cursor: pointer; font-size: 14px;
        padding: 4px; border-radius: 4px; transition: 0.2s;
    }
    .sb-icon-btn:hover { color: var(--primary); background: var(--primary-low); }
    .sb-icon-btn.active { color: var(--tertiary); background: var(--tertiary-low); }

    /* 用户列表 */
    .sb-input-group { display: flex; gap: 5px; margin-bottom: 6px; }
    .sb-input {
        flex: 1;
        background: var(--primary-very-low);
        border: 1px solid var(--primary-low);
        color: var(--primary);
        padding: 4px 10px; border-radius: 4px;
        outline: none; font-size: 12px;
    }
    .sb-input:focus { border-color: var(--tertiary); background: var(--secondary); }

    .sb-btn-add {
        background: var(--tertiary);
        color: var(--secondary);
        border: none; border-radius: 4px;
        width: 24px; cursor: pointer; font-weight: bold;
    }
    .sb-btn-add:hover { background: var(--tertiary-hover); }

    .sb-tags {
        display: block; margin-top: 5px;
        border: 1px solid var(--primary-low);
        border-radius: 6px; overflow: hidden;
        background: var(--secondary);
    }
    .sb-user-row {
        display: flex; align-items: center; justify-content: space-between;
        padding: 4px 6px;
        border-bottom: 1px solid var(--primary-low);
        border-left: 3px solid var(--primary-low-mid);
        background: var(--secondary);
    }
    .sb-user-row:last-child { border-bottom: none; }
    .sb-user-row:hover { background: var(--primary-very-low); }
    .sb-user-row.active { background: var(--tertiary-very-low); border-left: 3px solid var(--tertiary); }

    .sb-timer-circle { flex-shrink: 0; margin: 0 6px 0 2px; }
    .sb-timer-circle:hover { opacity: 0.8; }

    .sb-user-name {
        font-size: 12px; color: var(--primary);
        cursor: pointer; flex: 1;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .sb-user-name.disabled { color: var(--primary-low-mid); text-decoration: line-through; }
    .sb-user-row.active .sb-user-name { font-weight: 600; color: var(--primary); }

    .sb-user-activity { font-size: 10px; color: var(--primary-medium); display: flex; gap: 4px; margin-left: auto; flex-shrink: 0; }
    .sb-user-activity span { white-space: nowrap; width: 32px; text-align: right; font-family: monospace; }

    /* 卡片列表 */
    .sb-list {
        flex: 1; padding: 8px;
        background: var(--secondary);
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: var(--primary-low-mid) transparent;
    }
    .sb-list::-webkit-scrollbar { width: 4px; }
    .sb-list::-webkit-scrollbar-thumb { background: var(--primary-low-mid); border-radius: 2px; }

    .sb-card {
        display: flex; flex-direction: column; gap: 4px;
        background: var(--d-badge-card-background-color, #fff);
        border: 1px solid var(--primary-low);
        border-radius: 6px;
        padding: 10px; margin-bottom: 8px;
        color: var(--primary);
        transition: 0.2s; position: relative; overflow: hidden;
    }
    .sb-card:hover {
        transform: translateX(4px);
        background: var(--d-hover);
        border-color: var(--tertiary);
    }

    .sb-card-head { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: var(--primary-high); }
    .sb-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--primary-low); object-fit: cover; flex-shrink: 0; }
    .sb-avatar-sm { width: 16px; height: 16px; border-radius: 50%; vertical-align: middle; }

    .sb-card-info { display: flex; flex-direction: column; gap: 2px; overflow: hidden; flex: 1; }
    .sb-user-box {
        display: flex; align-items: center; gap: 4px;
        color: var(--primary-high); font-weight: 600;
        line-height: 1.2;
    }
    .sb-user-box .svg-icon { width: 12px; height: 12px; fill: var(--primary-medium); margin: 0 2px; }
    .sb-user-box .action-emoji { width: 14px; height: 14px; vertical-align: middle; }

    .sb-card-title { font-size: 13px; font-weight: 700; color: var(--primary); line-height: 1.4; }
    .sb-card-excerpt {
        font-size: 12px; color: var(--primary-medium);
        line-height: 1.5;
        display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        margin-top: 2px;
    }
    .sb-card-excerpt-cited {
        font-size: 12px; color: var(--primary-medium);
        line-height: 1.5;
        display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        border-left: 3px solid var(--primary-low);
        padding-left: 8px; margin-top: 2px;
    }
    .sb-card-img {
        width: 100%; height: 100px;
        object-fit: cover; border-radius: 4px;
        margin-top: 6px; border: 1px solid var(--primary-low);
    }
    .sb-card-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 6px; }
    .sb-badge {
        font-size: 10px; padding: 2px 6px; border-radius: 4px;
        background: var(--primary-low); color: var(--primary);
    }
    .sb-timestr { font-size: 11px; color: var(--primary-medium); }

    /* 弹幕 */
    .dm-container { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; overflow: hidden; z-index: 10; }
    .dm-item {
        position: absolute; left: 100vw;
        display: flex; flex-direction: column; gap: 4px;
        background: var(--secondary);
        border: 1px solid var(--primary-low);
        padding: 10px 15px; border-radius: 30px;
        color: var(--primary);
        box-shadow: var(--shadow-card);
        max-width: 500px; min-width: 260px;
        pointer-events: auto; cursor: pointer;
        will-change: transform; animation: dm-fly 12s linear forwards;
        backdrop-filter: blur(5px); overflow: hidden;
        opacity: 0.95;
    }
    .dm-item:hover { z-index: 20; background: var(--tertiary-very-low); border-color: var(--tertiary); animation-play-state: paused; }

    .dm-top { display: flex; align-items: flex-start; gap: 8px; }
    .dm-avatar { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; background: var(--primary-low); }
    .dm-info { display: flex; flex-direction: column; overflow: hidden; flex: 1; }
    .dm-user { font-size: 12px; color: var(--primary-high); font-weight: 600; margin-bottom: 2px; display: flex; align-items: center; gap: 4px; }
    .dm-title { font-size: 13px; font-weight: 700; color: var(--primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .dm-excerpt { font-size: 12px; color: var(--primary-medium); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.3; }
    .dm-excerpt-cited { font-size: 12px; color: var(--primary-medium); border-left: 3px solid var(--primary-low); padding-left: 6px; }

    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    @keyframes dm-fly { from { transform: translateX(0); } to { transform: translateX(-140vw); } }
    @keyframes dm-pop { 0% { opacity: 1; transform: scale(1.2); } 100% { opacity: 0; transform: scale(0.8) translateY(-30px); } }

    .dm-icon-pop { position: absolute; pointer-events: none; animation: dm-pop 3s ease-out forwards; }
    .dm-icon-pop .svg-icon { width: 100px; height: 100px; fill: var(--love); filter: drop-shadow(0 4px 20px rgba(250,108,141,0.4)); }
    .dm-icon-pop .action-emoji { width: 100px; height: 100px; filter: drop-shadow(0 4px 20px rgba(0,0,0,0.2)); }

    /* 调试日志 */
    .sb-console {
        height: 20px; background: var(--secondary);
        border-top: 1px solid var(--primary-low);
        padding: 5px; font-family: monospace; font-size: 10px;
        overflow-y: auto; color: var(--primary-medium);
    }
    .log-ok { color: var(--success); } .log-err { color: var(--danger); }
`

// 日志函数
function log(msg: string, type = 'info') {
  if (!shadowRoot) return
  console.log(`[LD-Seeking] ${msg}`)
  const box = shadowRoot.getElementById('sb-console')
  if (box) {
    const d = document.createElement('div')
    d.className = type === 'error' ? 'log-err' : type === 'success' ? 'log-ok' : ''
    d.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`
    box.prepend(d)
    if (box.children.length > 20) box.lastChild.remove()
  }
}

// 导出初始化函数
export async function initLinuxDoSeeking() {
  // 检查是否在 linux.do 域名
  if (!window.location.hostname.includes('linux.do')) {
    return
  }

  // 从设置加载配置
  const saved = await loadConfig()
  state.users = saved.users || []
  state.lastIds = saved.lastIds || {}
  state.enableSysNotify = saved.enableSysNotify !== false
  state.enableDanmaku = saved.enableDanmaku !== false
  state.hiddenUsers = new Set(saved.hiddenUsers || [])

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
  } catch (e) {
    console.warn('[LinuxDoSeeking] Failed to load settings from background', e)
  }

  attemptLeadership()
  createUI()

  console.log('[LinuxDoSeeking] Initialized')
}

// 创建 UI
function createUI() {
  const host = document.createElement('div')
  host.id = 'ld-seeking-host'
  document.body.appendChild(host)
  shadowRoot = host.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.textContent = css
  shadowRoot.appendChild(style)

  const container = document.createElement('div')
  container.innerHTML = `
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
  shadowRoot.appendChild(container)

  // 绑定事件
  shadowRoot.getElementById('ld-toggle-ball')!.onclick = () => {
    const bar = shadowRoot!.getElementById('ld-sidebar')
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
  }

  shadowRoot.getElementById('btn-dm').onclick = function (this: HTMLElement) {
    state.enableDanmaku = !state.enableDanmaku
    this.className = `sb-icon-btn ${state.enableDanmaku ? 'active' : ''}`
    saveConfig()
    channel.postMessage({
      type: 'cmd_config_sync',
      key: 'enableDanmaku',
      value: state.enableDanmaku
    })
  }

  shadowRoot.getElementById('btn-sys').onclick = function (this: HTMLElement) {
    state.enableSysNotify = !state.enableSysNotify
    this.className = `sb-icon-btn ${state.enableSysNotify ? 'active' : ''}`
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
  }

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

// --- 网络请求 ---
async function fetchUser(username: string, isInitial = false) {
  try {
    const profileJson = await safeFetch(`${CONFIG.HOST}/u/${username}.json`)
    if (!profileJson || !profileJson.user) return []

    const newLastSeen = profileJson.user.last_seen_at
    const newLastPosted = profileJson.user.last_posted_at
    const oldProfile = state.userProfiles[username]

    state.multipliers[username] = getIntervalMultiplier(newLastSeen)
    const hasChanged = !oldProfile || oldProfile.last_seen_at !== newLastSeen

    state.userProfiles[username] = { last_posted_at: newLastPosted, last_seen_at: newLastSeen }

    if (!isInitial && !hasChanged && state.data[username]?.length > 0) {
      log(`[${username}] dormant.`, 'info')
      return 'SKIPPED'
    }

    const [jsonActions, jsonReactions] = await Promise.all([
      safeFetch(
        `${CONFIG.HOST}/user_actions.json?offset=0&limit=${CONFIG.LOG_LIMIT_PER_USER}&username=${username}&filter=1,4,5`
      ),
      safeFetch(`${CONFIG.HOST}/discourse-reactions/posts/reactions.json?username=${username}`)
    ])

    const actions = (jsonActions.user_actions || []).map(action => {
      if (action.action_type === 1) {
        return {
          ...action,
          username: action.acting_username,
          name: action.acting_name,
          user_id: action.acting_user_id,
          avatar_template: action.acting_avatar_template,
          acting_username: action.username,
          acting_name: action.name,
          acting_user_id: action.user_id,
          acting_avatar_template: action.avatar_template
        }
      }
      return action
    })

    const reactions = (jsonReactions || []).map(r => ({
      id: r.id,
      post_id: r.post_id,
      created_at: r.created_at,
      username: r.user?.username || '',
      name: r.user?.name || '',
      user_id: r.user_id,
      avatar_template: r.user?.avatar_template || '',
      acting_username: r.post?.user?.username || r.post?.username || '',
      acting_name: r.post?.user?.name || r.post?.name || '',
      acting_user_id: r.post?.user_id || '',
      acting_avatar_template: r.post?.user?.avatar_template || r.post?.avatar_template || '',
      topic_id: r.post?.topic_id,
      post_number: r.post?.post_number,
      title: r.post?.topic_title || r.post?.topic?.title || '',
      excerpt: r.post?.excerpt || '',
      category_id: r.post?.category_id,
      action_type: r.reaction?.reaction_value || 'reaction',
      reaction_value: r.reaction?.reaction_value
    }))

    return [...actions, ...reactions]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, CONFIG.LOG_LIMIT_PER_USER)
  } catch (e) {
    log(`[${username}]: ${(e as Error).message}`, 'error')
    return []
  }
}

// --- 工具函数 ---
function getUniqueId(action: any): string {
  if (action.id) return action.id
  if (action.topic_id && action.post_number) return `${action.topic_id}_${action.post_number}`
  return `ts_${Date.now()}`
}

function cleanHtml(html: string): string {
  if (!html) return ''
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  tmp.querySelectorAll('img').forEach(img => {
    if (img.classList.contains('emoji')) img.replaceWith(img.alt || '')
    else img.remove()
  })
  return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim()
}

function extractImg(html: string): string | null {
  if (!html) return null
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  const img = tmp.querySelector('img:not(.emoji)')
  if (!img) return null
  let src = img.src
  if (src.startsWith('/')) src = CONFIG.HOST + src
  if (!src.startsWith('http')) {
    const rawSrc = img.getAttribute('src')
    if (rawSrc && rawSrc.startsWith('/')) return CONFIG.HOST + rawSrc
  }
  return src
}

function getActionIcon(actionType: any): string {
  const color = 'var(--primary-medium)'
  const ACTION_ICONS = {
    reply: `<svg class="fa d-icon d-icon-reply svg-icon svg-string" style="fill:${color}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M8.309 189.836L184.313 37.851C199.719 24.546 224 35.347 224 56.015v80.053c160.629 1.839 288 34.032 288 186.258 0 61.441-39.581 122.309-83.333 154.132-13.653 9.931-33.111-2.533-28.077-18.631 45.344-145.012-21.507-183.51-176.59-185.742V360c0 20.7-24.3 31.453-39.687 18.164l-176.004-152c-11.071-9.562-11.086-26.753 0-36.328z"/></svg>`,
    post: `<svg class="fa d-icon d-icon-pencil svg-icon svg-string" style="fill:${color}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M497.9 142.1l-46.1 46.1c-4.7 4.7-12.3 4.7-17 0l-111-111c-4.7-4.7-4.7-12.3 0-17l46.1-46.1c18.7-18.7 49.1-18.7 67.9 0l60.1 60.1c18.8 18.7 18.8 49.1 0 67.9zM284.2 99.8L21.6 362.4.4 483.9c-2.9 16.4 11.4 30.6 27.8 27.8l121.5-21.3 262.6-262.6c4.7-4.7 4.7-12.3 0-17l-111-111c-4.8-4.7-12.4-4.7-17.1 0zM88 424h48v36.3l-64.5 11.3-31.1-31.1L51.7 376H88v48z"/></svg>`,
    like: `<svg class="fa d-icon d-icon-d-heart svg-icon svg-string" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path fill="var(--love)" d="M305 151.1L320 171.8L335 151.1C360 116.5 400.2 96 442.9 96C516.4 96 576 155.6 576 229.1L576 231.7C576 343.9 436.1 474.2 363.1 529.9C350.7 539.3 335.5 544 320 544C304.5 544 289.2 539.4 276.9 529.9C203.9 474.2 64 343.9 64 231.7L64 229.1C64 155.6 123.6 96 197.1 96C239.8 96 280 116.5 305 151.1z"/></svg>`
  }
  const REACTION_ICONS = {
    tieba_087: '/uploads/default/original/3X/2/e/2e09f3a3c7b27eacbabe9e9614b06b88d5b06343.png?v=15',
    bili_057: '/uploads/default/original/3X/1/a/1a9f6c30e88a7901b721fffc1aaeec040f54bdf3.png?v=15'
  }

  if (actionType === 5) return ACTION_ICONS.reply
  if (actionType === 4) return ACTION_ICONS.post
  if (actionType === 1) return ACTION_ICONS.like
  if (typeof actionType === 'string') {
    if (REACTION_ICONS[actionType as keyof typeof REACTION_ICONS])
      return `<img src="${CONFIG.HOST}${REACTION_ICONS[actionType as keyof typeof REACTION_ICONS]}" class="action-emoji" alt=":${actionType}:">`
    return `<img src="${CONFIG.HOST}/images/emoji/twemoji/${actionType}.png?v=15" class="action-emoji" alt=":${actionType}:">`
  }
  return ACTION_ICONS.reply
}

function getUsernameColor(username: string): string | null {
  if (!username) return null
  const lower = username.toLowerCase()
  if (state.selfUser && lower === state.selfUser.toLowerCase()) return nameColors[0]
  const userIndex = state.users.findIndex(u => u.toLowerCase() === lower)
  if (userIndex !== -1 && userIndex + 1 < nameColors.length) return nameColors[userIndex + 1]
  return null
}

function formatActionInfo(action: any) {
  const icon = getActionIcon(action.action_type)
  const user = action.username || ''
  const actingUser = action.acting_username || ''
  const actingAvatar = action.acting_avatar_template
    ? CONFIG.HOST + action.acting_avatar_template.replace('{size}', '24')
    : null
  const userColor = getUsernameColor(user)

  const formatUsername = (content: string, color: string | null) =>
    color
      ? `<span style="color:${color}; display: flex; align-items: center; gap: 1px;">${content}</span>`
      : content

  const userHtml = formatUsername(user, userColor)
  if (actingUser && actingUser !== user) {
    const actingUserColor = getUsernameColor(actingUser)
    const actingContent = actingAvatar
      ? `<img src="${actingAvatar}" class="sb-avatar-sm">&nbsp;${actingUser}`
      : actingUser
    const actingHtml = formatUsername(actingContent, actingUserColor)
    return { user, icon, actingUser, actingAvatar, html: `${userHtml} ${icon} ${actingHtml}` }
  }
  return { user, icon, actingUser: null, actingAvatar: null, html: `${userHtml} ${icon}` }
}

// --- 导航函数 ---
function navigateToLink(link: string) {
  // 确保链接格式正确
  const normalizedLink = link.startsWith('/') ? link : `/${link}`

  // 延迟检查 Discourse 路由，确保页面完全加载
  const tryDiscourseRoute = () => {
    try {
      if (
        window.Discourse &&
        window.Discourse.router &&
        typeof window.Discourse.router.transitionTo === 'function'
      ) {
        console.log('[LD-Seeking] Using Discourse router for:', normalizedLink)
        window.Discourse.router.transitionTo(normalizedLink)
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
  if (pushedIds.size > 200) pushedIds.delete(pushedIds.values().next().value)

  let avatar =
    'https://linux.do/uploads/default/original/3X/9/d/9dd4973138ccd78e8907865261d7b14d45a96d1c.png'
  if (action.avatar_template) avatar = CONFIG.HOST + action.avatar_template.replace('{size}', '64')
  const excerpt = cleanHtml(action.excerpt)
  const link = `${CONFIG.HOST}/t/${action.topic_id}/${action.post_number}`

  if (state.enableDanmaku && shadowRoot) {
    const layer = shadowRoot.getElementById('dm-container')
    if (layer) {
      const isLikeOrReaction = action.action_type === 1 || typeof action.action_type === 'string'
      const isSelfUser =
        state.selfUser && action.acting_username.toLowerCase() === state.selfUser.toLowerCase()
      if (isLikeOrReaction && isSelfUser) {
        const iconPop = document.createElement('div')
        iconPop.className = 'dm-icon-pop'
        iconPop.style.left = `${10 + Math.random() * 70}vw`
        iconPop.style.top = `${10 + Math.random() * 60}vh`
        iconPop.innerHTML = getActionIcon(action.action_type)
        layer.appendChild(iconPop)
        setTimeout(() => iconPop.remove(), 3000)
      }

      const item = document.createElement('div')
      item.className = 'dm-item'
      item.style.top = `${5 + Math.random() * 80}vh`
      item.style.animationDuration = `${8 + Math.random() * 4}s`
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

function broadcastNewAction(action: any) {
  channel.postMessage({ type: 'new_action', action })
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

function attemptLeadership() {
  channel.postMessage({ type: 'leader_check' })
  leaderCheckTimeout = window.setTimeout(() => {
    state.isLeader = true
    leaderCheckTimeout = null
    tickAll()
  }, 200)
}

window.addEventListener('beforeunload', () => {
  if (state.isLeader) channel.postMessage({ type: 'leader_resign' })
})

// --- UI 交互 ---
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
      nameEl.style.color = isHidden ? '' : ''
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

// --- 可视化循环 ---
function startVisualLoops() {
  const updateTimers = () => {
    if (!shadowRoot) return
    const now = Date.now()
    state.users.forEach(u => {
      const timerEl = shadowRoot!.getElementById(`timer-${u}`)
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
        progressCircle.style.strokeDashoffset = offset.toString()
      } else {
        progressCircle.style.strokeDashoffset = '0'
      }
    })
    requestAnimationFrame(updateTimers)
  }
  requestAnimationFrame(updateTimers)

  // 优化：原 setInterval 已移至 startVisualUpdates()，由折叠状态控制
}

function renderSidebarRows() {
  if (!shadowRoot) return
  const div = shadowRoot.getElementById('sb-tags')
  if (!div) return
  div.innerHTML = ''

  state.users.forEach(u => {
    const isHidden = state.hiddenUsers.has(u)
    const userColor = 'var(--tertiary)'
    const row = document.createElement('div')
    row.id = `row-${u}`
    row.className = `sb-user-row ${isHidden ? '' : 'active'}`

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

    const activityEl = document.createElement('div')
    activityEl.className = 'sb-user-activity'
    activityEl.id = `activity-${u}`
    activityEl.innerHTML = `<span title="最近发帖">--</span><span title="最近动态">--</span><span title="最近在线">--</span>`

    const nameEl = document.createElement('div')
    nameEl.className = `sb-user-name ${isHidden ? 'disabled' : ''}`
    nameEl.textContent = u

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
      'https://linux.do/uploads/default/original/3X/9/d/9dd4973138ccd78e8907865261d7b14d45a96d1c.png'
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
      item.action_type === 4 || item.action_type === 5
        ? 'sb-card-excerpt'
        : 'sb-card-excerpt-cited'

    // 检查是否已存在相同的卡片，如果存在则复用
    const existing = existingCards.get(link)
    if (existing) {
      fragment.appendChild(existing)
      existingCards.delete(link)
    } else {
      // 新建卡片元素
      const cardDiv = document.createElement('div')
      cardDiv.className = 'sb-card'
      cardDiv.setAttribute('data-link', link)
      cardDiv.innerHTML = `
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
      fragment.appendChild(cardDiv)
    }
  })

  // 一次性替换所有内容
  div.textContent = ''
  div.appendChild(fragment)
}
