import type { MessageHandler } from './types'

export const linuxDoUserHandler: MessageHandler = (message, _sender, sendResponse) => {
  if (message.type !== 'GET_LINUX_DO_USER') return false

  try {
    const preloaded = document.getElementById('data-preloaded') as HTMLElement | null
    if (preloaded?.dataset?.preloaded) {
      const data = JSON.parse(preloaded.dataset.preloaded || '{}')
      if (data.currentUser) {
        const user = JSON.parse(data.currentUser)
        sendResponse({
          success: true,
          user: {
            username: user?.username || '',
            trustLevel: user?.trust_level
          }
        })
        return true
      }
    }
  } catch (error) {
    console.warn('[Emoji Extension] Failed to read current user:', error)
  }
  sendResponse({ success: false, error: 'No current user' })
  return true
}
