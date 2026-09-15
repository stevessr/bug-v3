import { getChromeAPI } from '../utils/main'

/**
 * 可选 cookies 权限的统一入口。
 *
 * cookies 在 manifest 中是 optional_permission。只有用户主动使用需要登录
 * 的站点功能（linux.do 论坛、Discourse 工具、代理带 Cookie 请求）时，
 * 后台才会通过这里的处理函数查询/申请；首次申请会弹窗，已授权直接返回。
 */

type SiteCookiesResponse = {
  success: boolean
  granted?: boolean
  error?: string
}

const normalizeOrigin = (raw: string): string | null => {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return `${url.protocol}//${url.host}/*`
  } catch {
    return null
  }
}

export const DEFAULT_SITE_COOKIE_ORIGINS = ['https://linux.do/*']

export async function hasSiteCookiesPermission(origins?: string[]): Promise<boolean> {
  const chromeAPI = getChromeAPI()
  const permissions = chromeAPI?.permissions
  if (!permissions?.contains) return false
  const patterns = (origins && origins.length > 0 ? origins : DEFAULT_SITE_COOKIE_ORIGINS)
    .map(origin => (origin.includes('/*') ? origin : normalizeOrigin(origin)))
    .filter((pattern): pattern is string => Boolean(pattern))
  if (patterns.length === 0) return false
  try {
    return permissions.contains({ permissions: ['cookies'], origins: patterns }) === true
  } catch {
    return false
  }
}

export async function ensureSiteCookiesPermission(origins?: string[]): Promise<boolean> {
  const chromeAPI = getChromeAPI()
  const permissions = chromeAPI?.permissions
  if (!permissions?.request) return false
  const patterns = (origins && origins.length > 0 ? origins : DEFAULT_SITE_COOKIE_ORIGINS)
    .map(origin => (origin.includes('/*') ? origin : normalizeOrigin(origin)))
    .filter((pattern): pattern is string => Boolean(pattern))
  if (patterns.length === 0) return false
  if (await hasSiteCookiesPermission(patterns)) return true
  try {
    const granted = await permissions.request({
      permissions: ['cookies'],
      origins: patterns
    })
    return granted === true
  } catch {
    return false
  }
}

export async function handleSiteCookiesRequest(
  message: { type: string; origins?: string[] },
  sendResponse: (response: SiteCookiesResponse) => void
) {
  try {
    const granted =
      message.type === 'SITE_COOKIES_ENSURE_PERMISSION'
        ? await ensureSiteCookiesPermission(message.origins)
        : await hasSiteCookiesPermission(message.origins)
    sendResponse({ success: true, granted })
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'cookies 权限处理失败'
    sendResponse({ success: false, error: reason })
  }
}
