import { getChromeAPI } from '../utils/main.ts'

export async function handleLinuxDoUserRequest(_sendResponse: (resp: any) => void) {
  const chromeAPI = getChromeAPI()
  if (!chromeAPI || !chromeAPI.tabs) {
    _sendResponse({ success: false, error: 'Chrome API not available' })
    return
  }

  try {
    const tabs = await chromeAPI.tabs.query({ url: 'https://linux.do/*' })
    if (!tabs.length) {
      _sendResponse({ success: false, error: 'No linux.do tabs found' })
      return
    }

    for (const tab of tabs) {
      if (!tab.id) continue
      try {
        const resp = await chromeAPI.tabs.sendMessage(tab.id, { type: 'GET_LINUX_DO_USER' })
        if (resp?.success && resp?.user?.username) {
          _sendResponse({ success: true, user: resp.user })
          return
        }
      } catch {
        continue
      }
    }

    _sendResponse({ success: false, error: 'Failed to get user from linux.do tabs' })
  } catch (error) {
    console.error('Failed to get linux.do user info', error)
    _sendResponse({ success: false, error: 'Unknown error' })
  }
}
