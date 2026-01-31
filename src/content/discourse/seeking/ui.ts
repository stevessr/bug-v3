import { CONFIG, nameColors } from './config'
import { state } from './state'

import { createE } from '@/content/utils/dom/createEl'

export let shadowRoot: ShadowRoot | null = null

export function setShadowRoot(root: ShadowRoot) {
  shadowRoot = root
}

// 日志函数
export function log(msg: string, type = 'info') {
  if (!shadowRoot) return
  console.log(`[LD-Seeking] ${msg}`)
  const box = shadowRoot.getElementById('sb-console')
  if (box) {
    const d = createE('div', {
      class: type === 'error' ? 'log-err' : type === 'success' ? 'log-ok' : '',
      text: `[${new Date().toLocaleTimeString()}] ${msg}`
    })
    box.prepend(d)
    if (box.children.length > 20 && box.lastChild) box.lastChild.remove()
  }
}

// CSS 样式
export const css = `
    :host {
        all: initial;
        font-family: var(--font-family, system-ui, -apple-system, sans-serif);
        font-size: var(--font-down-1, 14px);
        z-index: 2147483647;
        position: fixed; top: 0; left: 0;
        pointer-events: none;
        width: 100vw; height: 100vh;
        color: var(--primary);
        --ld-sidebar-height: 45vh;
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

    :host(.pos-right) #ld-sidebar {
        left: auto; right: 0;
        border-right: none;
        border-left: 1px solid var(--primary-low);
        box-shadow: var(--shadow-menu-panel, -5px 0 25px rgba(0,0,0,0.1));
    }
    :host(.pos-right) #ld-sidebar.collapsed { transform: translateX(${CONFIG.SIDEBAR_WIDTH}); }

    :host(.pos-top) #ld-sidebar {
        left: 0; right: 0; top: 0;
        width: 100vw; height: var(--ld-sidebar-height);
        border-right: none;
        border-bottom: 1px solid var(--primary-low);
        box-shadow: var(--shadow-menu-panel, 0 5px 25px rgba(0,0,0,0.1));
    }
    :host(.pos-top) #ld-sidebar.collapsed { transform: translateY(calc(-1 * var(--ld-sidebar-height))); }

    :host(.pos-bottom) #ld-sidebar {
        left: 0; right: 0; top: auto; bottom: 0;
        width: 100vw; height: var(--ld-sidebar-height);
        border-right: none;
        border-top: 1px solid var(--primary-low);
        box-shadow: var(--shadow-menu-panel, 0 -5px 25px rgba(0,0,0,0.1));
    }
    :host(.pos-bottom) #ld-sidebar.collapsed { transform: translateY(var(--ld-sidebar-height)); }

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

    :host(.pos-right) #ld-toggle-ball {
        right: auto; left: -24px;
        border-left: 1px solid var(--primary-low);
        border-right: none;
        border-radius: 100px 0 0 100px;
        box-shadow: -2px 0 10px rgba(0,0,0,0.05);
    }

    :host(.pos-top) #ld-toggle-ball {
        right: auto; left: 50%;
        top: auto; bottom: -24px;
        width: 48px; height: 24px;
        border-left: 1px solid var(--primary-low);
        border-top: none;
        border-radius: 0 0 100px 100px;
        transform: translateX(-50%);
        box-shadow: 0 2px 10px rgba(0,0,0,0.05);
    }

    :host(.pos-bottom) #ld-toggle-ball {
        right: auto; left: 50%;
        top: -24px; bottom: auto;
        width: 48px; height: 24px;
        border-left: 1px solid var(--primary-low);
        border-bottom: none;
        border-radius: 100px 100px 0 0;
        transform: translateX(-50%);
        box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
    }

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
        position: absolute; left: 100vw;\
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

// 工具函数
export function formatTimeAgo(isoTime: string | null): string {
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

export function getTimeAgoColor(isoTime: string | null): string {
  if (!isoTime) return 'var(--primary-medium)'
  const diff = Date.now() - new Date(isoTime).getTime()
  const maxTime = 1 * 60 * 60 * 1000
  if (diff < maxTime) return 'var(--success)' // 最近1小时显示绿色
  return 'var(--primary-medium)'
}

export function cleanHtml(html: string): string {
  if (!html) return ''
  const tmp = createE('div', { in: html })
  tmp.querySelectorAll('img').forEach(img => {
    if (img.classList.contains('emoji')) img.replaceWith(img.alt || '')
    else img.remove()
  })
  return (tmp.textContent || (tmp as any).innerText || '').replace(/\\s+/g, ' ').trim()
}

export function extractImg(html: string): string | null {
  if (!html) return null
  const tmp = createE('div', { in: html })
  const img = tmp.querySelector('img:not(.emoji)')
  if (!img) return null
  let src = (img as HTMLImageElement).src
  if (src.startsWith('/')) src = CONFIG.HOST + src
  if (!src.startsWith('http')) {
    const rawSrc = img.getAttribute('src')
    if (rawSrc && rawSrc.startsWith('/')) return CONFIG.HOST + rawSrc
  }
  return src as string
}

export function getActionIcon(actionType: any): string {
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

export function getUsernameColor(username: string): string | null {
  if (!username) return null
  const lower = username.toLowerCase()
  if (state.selfUser && lower === state.selfUser.toLowerCase()) return nameColors[0]
  const userIndex = state.users.findIndex(u => u.toLowerCase() === lower)
  if (userIndex !== -1 && userIndex + 1 < nameColors.length) return nameColors[userIndex + 1]
  return null
}

export function formatActionInfo(action: any) {
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
    return {
      user,
      icon,
      actingUser,
      actingAvatar,
      html: `${userHtml} ${icon} ${actingHtml}`
    }
  }
  return { user, icon, actingUser: null, actingAvatar: null, html: `${userHtml} ${icon}` }
}
