import type { DiscourseSessionUser, LinuxDoUserResponse } from '@/types/messages'

const readBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined

const normalizeSessionUser = (value: any): DiscourseSessionUser | null => {
  if (!value?.username) return null
  const admin = readBoolean(value.admin)
  const moderator = readBoolean(value.moderator)
  return {
    id: typeof value.id === 'number' ? value.id : undefined,
    username: String(value.username),
    trustLevel:
      typeof value.trustLevel === 'number'
        ? value.trustLevel
        : typeof value.trust_level === 'number'
          ? value.trust_level
          : undefined,
    staff: readBoolean(value.staff) ?? (admin === true || moderator === true),
    admin,
    moderator,
    canChat: readBoolean(value.canChat) ?? readBoolean(value.can_chat),
    canDirectMessage: readBoolean(value.canDirectMessage) ?? readBoolean(value.can_direct_message),
    hasChatEnabled: readBoolean(value.hasChatEnabled) ?? readBoolean(value.has_chat_enabled)
  }
}

export async function loadSessionUserFromExtension(
  baseUrl?: string
): Promise<DiscourseSessionUser | null> {
  try {
    const chromeAPI = (globalThis as any).chrome
    if (!chromeAPI?.runtime?.sendMessage) return null
    const resp = await new Promise<LinuxDoUserResponse | null>(resolve => {
      chromeAPI.runtime.sendMessage(
        { type: 'GET_LINUX_DO_USER', ...(baseUrl ? { url: baseUrl } : {}) },
        (response: LinuxDoUserResponse) => {
          if (chromeAPI.runtime.lastError) {
            resolve(null)
            return
          }
          resolve(response || null)
        }
      )
    })
    return resp?.success ? normalizeSessionUser(resp.user) : null
  } catch {
    return null
  }
}

export async function loadUsernameFromExtension(baseUrl?: string): Promise<string | null> {
  return (await loadSessionUserFromExtension(baseUrl))?.username || null
}
