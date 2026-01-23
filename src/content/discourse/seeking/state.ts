// --- 状态管理 ---
export interface UserProfile {
  last_posted_at: string
  last_seen_at: string
}

export interface State {
  users: string[]
  lastIds: Record<string, string>
  multipliers: Record<string, number>
  enableSysNotify: boolean
  enableDanmaku: boolean
  sidebarPosition: 'left' | 'right' | 'top' | 'bottom'
  actionFilter: '1' | '4' | '5' | '1,5' | '1,4,5'
  data: Record<string, any[]>
  isCollapsed: boolean
  isProcessing: boolean
  hiddenUsers: Set<string>
  selfUser: string | null
  nextFetchTime: Record<string, number>
  userProfiles: Record<string, UserProfile>
  isLeader: boolean
}

export function getSelfUser(): string | null {
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

export const state: State = {
  users: [],
  lastIds: {},
  multipliers: {},
  enableSysNotify: true,
  enableDanmaku: true,
  sidebarPosition: 'left',
  actionFilter: '1,5',
  data: {},
  isCollapsed: sessionStorage.getItem('ld_is_collapsed') !== 'false',
  isProcessing: false,
  hiddenUsers: new Set(),
  selfUser: getSelfUser(),
  nextFetchTime: {},
  userProfiles: {},
  isLeader: false
}

// 声明 chrome 以支持类型检查
declare const chrome: any

export async function saveConfig() {
  const store = {
    users: state.users,
    lastIds: state.lastIds,
    enableSysNotify: state.enableSysNotify,
    enableDanmaku: state.enableDanmaku,
    hiddenUsers: Array.from(state.hiddenUsers)
  }
  // 使用 chrome.storage.local 代替 GM_setValue
  if (typeof chrome !== 'undefined' && chrome.storage) {
    await chrome.storage.local.set({ ld_v21_config: JSON.stringify(store) })
  }
}

export async function loadConfig() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const result = await chrome.storage.local.get('ld_v21_config')
      const configStr = result.ld_v21_config || '{}'
      return typeof configStr === 'string' ? JSON.parse(configStr) : configStr
    }
    return {}
  } catch {
    return {}
  }
}
