import type { MessageHandler } from './types'
import { getDiscoursePreloadedData } from './pageFetchHandler'

import type { LinuxDoUserResponse } from '@/types/messages'

const parseRecord = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

const optionalBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined

export const linuxDoUserHandler: MessageHandler = (message, _sender, sendResponse) => {
  if (message.type !== 'GET_LINUX_DO_USER') return false

  try {
    const bootstrap = getDiscoursePreloadedData()
    const user = parseRecord(bootstrap?.currentUser ?? bootstrap?.current_user)
    if (user?.username) {
      const admin = optionalBoolean(user.admin)
      const moderator = optionalBoolean(user.moderator)
      const response: LinuxDoUserResponse = {
        success: true,
        user: {
          id: typeof user.id === 'number' ? user.id : undefined,
          username: String(user.username),
          trustLevel: typeof user.trust_level === 'number' ? user.trust_level : undefined,
          staff: optionalBoolean(user.staff) ?? (admin === true || moderator === true),
          admin,
          moderator,
          canChat: optionalBoolean(user.can_chat),
          canDirectMessage: optionalBoolean(user.can_direct_message),
          hasChatEnabled: optionalBoolean(user.has_chat_enabled)
        }
      }
      sendResponse(response)
      return true
    }
  } catch (error) {
    console.warn('[Emoji Extension] Failed to read current user:', error)
  }
  const errorResponse: LinuxDoUserResponse = { success: false, error: 'No current user' }
  sendResponse(errorResponse)
  return true
}
