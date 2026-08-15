import { getDiscoursePreloadedRecord } from '../discourse/preloaded'

import type { MessageHandler } from './types'

import type { LinuxDoUserResponse } from '@/types/messages'

const optionalBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined

const optionalUsernameList = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined
  const names = value.map(item => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
  return names.length > 0 ? names : undefined
}

export const linuxDoUserHandler: MessageHandler = (message, _sender, sendResponse) => {
  if (message.type !== 'GET_LINUX_DO_USER') return false

  try {
    const user = getDiscoursePreloadedRecord('currentUser', 'current_user')
    if (user?.username) {
      const admin = optionalBoolean(user.admin)
      const moderator = optionalBoolean(user.moderator)
      const ignoredUsernames = optionalUsernameList(user.ignored_usernames)
      const mutedUsernames = optionalUsernameList(user.muted_usernames)
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
          hasChatEnabled: optionalBoolean(user.has_chat_enabled),
          ...(ignoredUsernames ? { ignoredUsernames } : {}),
          ...(mutedUsernames ? { mutedUsernames } : {})
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
