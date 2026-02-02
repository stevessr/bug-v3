import type { Ref } from 'vue'

export async function loadUsernameFromExtension(): Promise<string | null> {
  try {
    const chromeAPI = (globalThis as any).chrome
    if (!chromeAPI?.runtime?.sendMessage) return null
    const resp = await new Promise<any>(resolve => {
      chromeAPI.runtime.sendMessage({ type: 'GET_LINUX_DO_USER' }, resolve)
    })
    return resp?.success && resp?.user?.username ? resp.user.username : null
  } catch {
    return null
  }
}
