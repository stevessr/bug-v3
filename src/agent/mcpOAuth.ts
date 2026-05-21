/**
 * MCP OAuth 2.1 客户端
 *
 * 按 MCP 1.0 spec / OAuth 2.1 / RFC 8414 (AS metadata) /
 * RFC 9728 (protected resource metadata) / RFC 7591 (DCR) 实现。
 *
 * 关键能力：
 * - 从 MCP server 自动发现 protected-resource metadata 与 authorization-server metadata
 * - 可选 Dynamic Client Registration（DCR）拿到 client_id
 * - PKCE (S256) Authorization Code 流程
 * - access token 刷新（refresh_token grant）
 *
 * 通过 chrome.identity.launchWebAuthFlow 完成浏览器授权页跳转，
 * redirect_uri 使用 `https://<extension-id>.chromiumapp.org/`。
 */

import type { McpOAuthConfig, McpOAuthTokens, McpServerConfig } from './types'

const DISCOVERY_PATH_PROTECTED_RESOURCE = '/.well-known/oauth-protected-resource'
const DISCOVERY_PATH_AUTH_SERVER = '/.well-known/oauth-authorization-server'
const DISCOVERY_PATH_OPENID = '/.well-known/openid-configuration'
const DEFAULT_CLIENT_NAME = 'bug-v3 MCP agent'
const TOKEN_EXPIRY_LEEWAY_MS = 30_000 // 提前 30s 视为过期

/** 解析 401 的 `WWW-Authenticate: Bearer ...` 头，提取 resource_metadata URI */
export function parseWwwAuthenticate(header: string | null): {
  resourceMetadataUrl?: string
  scope?: string
  realm?: string
} {
  if (!header) return {}
  const result: { resourceMetadataUrl?: string; scope?: string; realm?: string } = {}
  // 仅尝试解析 Bearer scheme 的参数
  const params = header.replace(/^Bearer\s+/i, '')
  // 拆 key="value" 或 key=value
  const re = /(\w+)\s*=\s*"([^"]*)"|(\w+)\s*=\s*([^,]+)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(params))) {
    const key = (match[1] || match[3] || '').toLowerCase()
    const value = (match[2] ?? match[4] ?? '').trim()
    if (!key) continue
    if (key === 'resource_metadata') result.resourceMetadataUrl = value
    else if (key === 'scope') result.scope = value
    else if (key === 'realm') result.realm = value
  }
  return result
}

const fetchJson = async (
  url: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data?: any; error?: string }> => {
  try {
    const resp = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.headers || {})
      },
      credentials: 'omit'
    })
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      return { ok: false, status: resp.status, error: text || `HTTP ${resp.status}` }
    }
    const data = await resp.json()
    return { ok: true, status: resp.status, data }
  } catch (err: any) {
    return { ok: false, status: 0, error: err?.message || String(err) }
  }
}

/**
 * 从 MCP server URL 自动发现 OAuth metadata。
 * 流程：
 * 1. 给 `serverUrl` 发一次未授权请求，若 401 则解析 WWW-Authenticate
 * 2. 拉 protected-resource metadata 拿 authorization_servers[0]
 * 3. 拉 authorization-server metadata 拿端点
 * 失败时退化为基于 serverUrl 的猜测路径。
 */
export async function discoverMcpOAuth(
  serverUrl: string,
  initial?: Partial<McpOAuthConfig>
): Promise<McpOAuthConfig> {
  const config: McpOAuthConfig = { ...(initial || {}) }

  // 1. 触发 401，拿 WWW-Authenticate
  if (!config.resourceMetadataUrl) {
    try {
      const probe = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 'oauth-probe', method: 'ping' }),
        credentials: 'omit'
      })
      if (probe.status === 401) {
        const parsed = parseWwwAuthenticate(probe.headers.get('www-authenticate'))
        if (parsed.resourceMetadataUrl) {
          config.resourceMetadataUrl = parsed.resourceMetadataUrl
        }
        if (parsed.scope && !config.scopes) config.scopes = parsed.scope
      }
    } catch {
      // 网络失败 → 后面会兜底
    }
  }

  // 2. 默认 protected-resource metadata 路径
  if (!config.resourceMetadataUrl) {
    try {
      const base = new URL(serverUrl)
      config.resourceMetadataUrl = `${base.origin}${DISCOVERY_PATH_PROTECTED_RESOURCE}`
    } catch {
      /* ignore */
    }
  }

  // 3. 拉 protected-resource metadata 得到 authorization_servers
  if (config.resourceMetadataUrl && !config.authorizationServerUrl) {
    const meta = await fetchJson(config.resourceMetadataUrl)
    if (meta.ok && meta.data) {
      const authServers = (meta.data.authorization_servers || []) as string[]
      if (Array.isArray(authServers) && authServers.length > 0) {
        config.authorizationServerUrl = authServers[0]
      }
      if (!config.resource && typeof meta.data.resource === 'string') {
        config.resource = meta.data.resource
      }
      if (
        !config.scopes &&
        Array.isArray(meta.data.scopes_supported) &&
        meta.data.scopes_supported.length > 0
      ) {
        config.scopes = (meta.data.scopes_supported as string[]).join(' ')
      }
    }
  }

  // 4. 兜底：从 serverUrl 的 origin 拿 authorization server metadata
  if (!config.authorizationServerUrl) {
    try {
      const base = new URL(serverUrl)
      config.authorizationServerUrl = base.origin
    } catch {
      /* ignore */
    }
  }

  // 5. 拉 authorization-server metadata 得到端点
  if (config.authorizationServerUrl && (!config.authorizationEndpoint || !config.tokenEndpoint)) {
    const asMeta =
      (
        await fetchJson(
          `${trimTrailingSlash(config.authorizationServerUrl)}${DISCOVERY_PATH_AUTH_SERVER}`
        )
      ).data ||
      (
        await fetchJson(
          `${trimTrailingSlash(config.authorizationServerUrl)}${DISCOVERY_PATH_OPENID}`
        )
      ).data

    if (asMeta) {
      if (!config.authorizationEndpoint && typeof asMeta.authorization_endpoint === 'string') {
        config.authorizationEndpoint = asMeta.authorization_endpoint
      }
      if (!config.tokenEndpoint && typeof asMeta.token_endpoint === 'string') {
        config.tokenEndpoint = asMeta.token_endpoint
      }
      if (!config.registrationEndpoint && typeof asMeta.registration_endpoint === 'string') {
        config.registrationEndpoint = asMeta.registration_endpoint
      }
      if (
        !config.scopes &&
        Array.isArray(asMeta.scopes_supported) &&
        asMeta.scopes_supported.length > 0
      ) {
        config.scopes = (asMeta.scopes_supported as string[]).join(' ')
      }
    }
  }

  config.lastDiscoveredAt = Date.now()
  return config
}

const trimTrailingSlash = (input: string): string =>
  input.endsWith('/') ? input.slice(0, -1) : input

/**
 * RFC 7591 Dynamic Client Registration。
 * 在 registrationEndpoint POST 一份 client metadata，拿回 client_id（可能含 secret）。
 */
export async function dynamicallyRegisterClient(
  config: McpOAuthConfig,
  redirectUri: string,
  clientName: string = DEFAULT_CLIENT_NAME
): Promise<{ clientId: string; clientSecret?: string }> {
  if (!config.registrationEndpoint) {
    throw new Error('当前 OAuth 配置缺少 registration_endpoint，请手动填写 client_id。')
  }
  const body = {
    client_name: clientName,
    redirect_uris: [redirectUri],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none', // PKCE 公有 client
    scope: config.scopes || undefined
  }
  const resp = await fetch(config.registrationEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    credentials: 'omit'
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`DCR 失败 (HTTP ${resp.status}): ${text || resp.statusText}`)
  }
  const data: any = await resp.json()
  if (!data?.client_id) {
    throw new Error('DCR 响应缺少 client_id')
  }
  return {
    clientId: data.client_id,
    clientSecret: data.client_secret
  }
}

// === PKCE ===

const base64UrlEncode = (bytes: Uint8Array): string => {
  let str = ''
  for (let i = 0; i < bytes.length; i += 1) str += String.fromCharCode(bytes[i])
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const generateCodeVerifier = (): string => {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes)
}

const generateCodeChallenge = async (verifier: string): Promise<string> => {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(new Uint8Array(digest))
}

const generateState = (): string => {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes)
}

/** chrome.identity.launchWebAuthFlow 推荐的 redirect_uri 格式。 */
export function getOAuthRedirectUri(): string {
  if (typeof chrome !== 'undefined' && chrome.identity?.getRedirectURL) {
    return chrome.identity.getRedirectURL()
  }
  // 兜底（非扩展环境，仅测试用）
  return 'https://localhost/oauth-callback'
}

/** 包装 launchWebAuthFlow 为 Promise。 */
const launchAuthFlow = (authUrl: string): Promise<string> =>
  new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.identity?.launchWebAuthFlow) {
      reject(new Error('当前环境不支持 chrome.identity.launchWebAuthFlow'))
      return
    }
    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, redirectUrl => {
      const err = chrome.runtime?.lastError
      if (err) {
        reject(new Error(err.message || 'OAuth 授权流程被中断'))
        return
      }
      if (!redirectUrl) {
        reject(new Error('OAuth 授权未返回 redirect URL'))
        return
      }
      resolve(redirectUrl)
    })
  })

const parseCallbackParams = (redirectUrl: string): Record<string, string> => {
  const params: Record<string, string> = {}
  try {
    const url = new URL(redirectUrl)
    url.searchParams.forEach((value, key) => {
      params[key] = value
    })
    if (url.hash) {
      const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
      hash.forEach((value, key) => {
        if (!(key in params)) params[key] = value
      })
    }
  } catch {
    /* ignore */
  }
  return params
}

/**
 * 完整跑一遍 Authorization Code + PKCE 流程，返回 tokens。
 * 调用前应保证 oauth.authorizationEndpoint / tokenEndpoint / clientId 都有值。
 */
export async function runMcpOAuthFlow(
  oauth: McpOAuthConfig,
  options?: { redirectUri?: string }
): Promise<McpOAuthTokens> {
  if (!oauth.authorizationEndpoint) throw new Error('缺少 authorization_endpoint')
  if (!oauth.tokenEndpoint) throw new Error('缺少 token_endpoint')
  if (!oauth.clientId) throw new Error('缺少 client_id（可先调用 dynamicallyRegisterClient）')

  const redirectUri = options?.redirectUri || getOAuthRedirectUri()
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)
  const state = generateState()

  const authUrl = new URL(oauth.authorizationEndpoint)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', oauth.clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('code_challenge', codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  authUrl.searchParams.set('state', state)
  if (oauth.scopes) authUrl.searchParams.set('scope', oauth.scopes)
  if (oauth.resource) authUrl.searchParams.set('resource', oauth.resource)

  const redirected = await launchAuthFlow(authUrl.toString())
  const params = parseCallbackParams(redirected)

  if (params.error) {
    throw new Error(`OAuth 授权失败：${params.error_description || params.error}`)
  }
  if (params.state !== state) {
    throw new Error('OAuth state 校验失败，可能被中间人篡改。')
  }
  if (!params.code) {
    throw new Error('OAuth 授权未返回 code 参数。')
  }

  const tokenBody = new URLSearchParams()
  tokenBody.set('grant_type', 'authorization_code')
  tokenBody.set('code', params.code)
  tokenBody.set('redirect_uri', redirectUri)
  tokenBody.set('client_id', oauth.clientId)
  tokenBody.set('code_verifier', codeVerifier)
  if (oauth.clientSecret) tokenBody.set('client_secret', oauth.clientSecret)
  if (oauth.resource) tokenBody.set('resource', oauth.resource)

  return await exchangeAtTokenEndpoint(oauth.tokenEndpoint, tokenBody)
}

/** 使用 refresh_token 获取新的 access_token。 */
export async function refreshMcpOAuth(
  oauth: McpOAuthConfig,
  refreshToken: string
): Promise<McpOAuthTokens> {
  if (!oauth.tokenEndpoint) throw new Error('缺少 token_endpoint')
  if (!oauth.clientId) throw new Error('缺少 client_id')
  const body = new URLSearchParams()
  body.set('grant_type', 'refresh_token')
  body.set('refresh_token', refreshToken)
  body.set('client_id', oauth.clientId)
  if (oauth.clientSecret) body.set('client_secret', oauth.clientSecret)
  if (oauth.scopes) body.set('scope', oauth.scopes)
  if (oauth.resource) body.set('resource', oauth.resource)
  return await exchangeAtTokenEndpoint(oauth.tokenEndpoint, body)
}

const exchangeAtTokenEndpoint = async (
  tokenEndpoint: string,
  body: URLSearchParams
): Promise<McpOAuthTokens> => {
  const resp = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    },
    body: body.toString(),
    credentials: 'omit'
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`token 交换失败 (HTTP ${resp.status}): ${text || resp.statusText}`)
  }
  const data: any = await resp.json()
  if (!data?.access_token) {
    throw new Error('token 响应缺少 access_token')
  }
  const now = Date.now()
  const expiresInMs = typeof data.expires_in === 'number' ? data.expires_in * 1000 : undefined
  return {
    accessToken: data.access_token,
    refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : undefined,
    tokenType: typeof data.token_type === 'string' ? data.token_type : 'Bearer',
    expiresAt: expiresInMs ? now + expiresInMs : undefined,
    scope: typeof data.scope === 'string' ? data.scope : undefined,
    obtainedAt: now
  }
}

const isTokenExpired = (tokens: McpOAuthTokens | undefined): boolean => {
  if (!tokens?.accessToken) return true
  if (!tokens.expiresAt) return false
  return Date.now() + TOKEN_EXPIRY_LEEWAY_MS >= tokens.expiresAt
}

/**
 * 返回当前可用的 access_token；若已过期且有 refresh_token，则尝试自动刷新。
 * 刷新成功会通过 onTokensUpdated 通知调用方持久化。
 */
export async function ensureValidMcpToken(
  server: McpServerConfig,
  options?: {
    onTokensUpdated?: (tokens: McpOAuthTokens) => void | Promise<void>
  }
): Promise<string | undefined> {
  if (!server.oauth || !server.oauthTokens?.accessToken) return undefined
  if (!isTokenExpired(server.oauthTokens)) return server.oauthTokens.accessToken
  if (!server.oauthTokens.refreshToken) {
    // 没有 refresh token，只能让 UI 重新授权
    return undefined
  }
  try {
    const refreshed = await refreshMcpOAuth(server.oauth, server.oauthTokens.refreshToken)
    if (options?.onTokensUpdated) await options.onTokensUpdated(refreshed)
    return refreshed.accessToken
  } catch {
    return undefined
  }
}
