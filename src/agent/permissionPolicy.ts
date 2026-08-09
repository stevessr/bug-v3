import type { AgentAction, AgentActionType } from './types'

export type AgentApprovalMode = 'manual' | 'auto' | 'skip'
export type AgentSiteDecision = 'allow' | 'block'
export type AgentPermissionDecision =
  'allow-once' | 'always-allow' | 'block-site' | 'deny' | 'revoke'

export type AgentSiteDescriptor = {
  key: string
  label: string
  url: string
  persistable: boolean
}

export type AgentSitePermission = AgentSiteDescriptor & {
  decision: AgentSiteDecision
  updatedAt: number
}

export type AgentPermissionHistoryEntry = {
  id: string
  timestamp: number
  mode: AgentApprovalMode
  decision: AgentPermissionDecision
  sites: string[]
  actionTypes: AgentActionType[]
  reason?: string
}

export type AgentActionProtection = {
  actionId: string
  actionType: AgentActionType
  reason: string
}

export type AgentResolvedSites = {
  sites: AgentSiteDescriptor[]
  unresolvedTargets: string[]
}

export type AgentPermissionAssessment = {
  status: 'allow' | 'approval-required' | 'blocked'
  mode: AgentApprovalMode
  sites: Array<AgentSiteDescriptor & { decision?: AgentSiteDecision }>
  unresolvedTargets: string[]
  prohibitedActions: AgentActionProtection[]
  protectedActions: AgentActionProtection[]
  reasons: string[]
  canAlwaysAllow: boolean
}

export const AGENT_APPROVAL_MODE_STORAGE_KEY = 'ai-agent-approval-mode-v1'
export const AGENT_SITE_PERMISSIONS_STORAGE_KEY = 'ai-agent-site-permissions-v1'
export const AGENT_PERMISSION_HISTORY_STORAGE_KEY = 'ai-agent-permission-history-v1'
export const LEGACY_BYPASS_MODE_STORAGE_KEY = 'ai-agent-bypass-mode-v1'

const MAX_SITE_PERMISSIONS = 200
const MAX_PERMISSION_HISTORY = 100
const APPROVAL_MODES = new Set<AgentApprovalMode>(['manual', 'auto', 'skip'])
const SITE_DECISIONS = new Set<AgentSiteDecision>(['allow', 'block'])
const PERMISSION_DECISIONS = new Set<AgentPermissionDecision>([
  'allow-once',
  'always-allow',
  'block-site',
  'deny',
  'revoke'
])
const PAGE_ACTION_TYPES = new Set<AgentActionType>([
  'click',
  'scroll',
  'touch',
  'screenshot',
  'navigate',
  'click-dom',
  'input',
  'double-click',
  'right-click',
  'hover',
  'key',
  'type',
  'drag',
  'select',
  'focus',
  'getDOM',
  'blur',
  'activate-tab',
  'close-tab',
  'reload-tab',
  'go-back',
  'go-forward',
  'debug-start',
  'read-console',
  'read-network',
  'debug-stop'
])

const getStorage = (override?: Storage | null): Storage | null => {
  if (override !== undefined) return override
  return typeof localStorage === 'undefined' ? null : localStorage
}

const mirrorPermissionValue = (key: string, value: unknown) => {
  if (typeof chrome === 'undefined' || !chrome.storage?.local?.set) return
  void chrome.storage.local.set({ [key]: value }).catch(() => {
    // Web previews and incomplete API mocks may expose a non-functional area.
  })
}

const makeId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `permission-${Date.now()}-${Math.random().toString(16).slice(2)}`

export function normalizeAgentSite(rawUrl: unknown): AgentSiteDescriptor | null {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return null
  try {
    const url = new URL(rawUrl.trim())
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return {
        key: url.origin.toLowerCase(),
        label: url.host,
        url: url.origin,
        persistable: true
      }
    }
    if (url.protocol === 'file:') {
      return { key: 'file://', label: '本地文件', url: 'file://', persistable: true }
    }
    const key = `${url.protocol}//${url.host}`.replace(/\/$/, '')
    return {
      key: key.toLowerCase(),
      label: key || url.protocol,
      url: key || url.protocol,
      persistable: false
    }
  } catch {
    return null
  }
}

export function readAgentApprovalMode(storageOverride?: Storage | null): AgentApprovalMode {
  const storage = getStorage(storageOverride)
  const stored = storage?.getItem(AGENT_APPROVAL_MODE_STORAGE_KEY)
  if (stored && APPROVAL_MODES.has(stored as AgentApprovalMode)) {
    return stored as AgentApprovalMode
  }

  const legacy = storage?.getItem(LEGACY_BYPASS_MODE_STORAGE_KEY)
  if (legacy === 'true') return 'skip'
  if (legacy === 'false') return 'manual'
  return 'auto'
}

export function writeAgentApprovalMode(mode: AgentApprovalMode, storageOverride?: Storage | null) {
  const storage = getStorage(storageOverride)
  if (!APPROVAL_MODES.has(mode)) return
  if (storage) {
    storage.setItem(AGENT_APPROVAL_MODE_STORAGE_KEY, mode)
    storage.removeItem(LEGACY_BYPASS_MODE_STORAGE_KEY)
  }
  mirrorPermissionValue(AGENT_APPROVAL_MODE_STORAGE_KEY, mode)
}

export function sanitizeAgentSitePermissions(input: unknown): AgentSitePermission[] {
  if (!Array.isArray(input)) return []
  const deduplicated = new Map<string, AgentSitePermission>()
  for (const item of input) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const site = normalizeAgentSite(record.url || record.key)
    if (!site || !site.persistable || !SITE_DECISIONS.has(record.decision as AgentSiteDecision)) {
      continue
    }
    deduplicated.set(site.key, {
      ...site,
      decision: record.decision as AgentSiteDecision,
      updatedAt: Number.isFinite(record.updatedAt) ? (record.updatedAt as number) : 0
    })
  }
  return [...deduplicated.values()]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_SITE_PERMISSIONS)
}

export function readAgentSitePermissions(storageOverride?: Storage | null): AgentSitePermission[] {
  const storage = getStorage(storageOverride)
  const raw = storage?.getItem(AGENT_SITE_PERMISSIONS_STORAGE_KEY)
  if (!raw) return []
  try {
    const permissions = sanitizeAgentSitePermissions(JSON.parse(raw))
    mirrorPermissionValue(AGENT_SITE_PERMISSIONS_STORAGE_KEY, permissions)
    return permissions
  } catch {
    return []
  }
}

const writeAgentSitePermissions = (
  permissions: AgentSitePermission[],
  storageOverride?: Storage | null
) => {
  const storage = getStorage(storageOverride)
  const normalized = permissions.slice(0, MAX_SITE_PERMISSIONS)
  if (storage) {
    storage.setItem(AGENT_SITE_PERMISSIONS_STORAGE_KEY, JSON.stringify(normalized))
  }
  mirrorPermissionValue(AGENT_SITE_PERMISSIONS_STORAGE_KEY, normalized)
}

export function setAgentSitePermission(
  site: AgentSiteDescriptor,
  decision: AgentSiteDecision,
  storageOverride?: Storage | null
): AgentSitePermission[] {
  const normalized = normalizeAgentSite(site.url)
  if (!normalized?.persistable) return readAgentSitePermissions(storageOverride)
  const current = readAgentSitePermissions(storageOverride).filter(
    item => item.key !== normalized.key
  )
  const next: AgentSitePermission[] = [
    { ...normalized, decision, updatedAt: Date.now() },
    ...current
  ]
  writeAgentSitePermissions(next, storageOverride)
  return next
}

export function removeAgentSitePermission(
  siteKey: string,
  storageOverride?: Storage | null
): AgentSitePermission[] {
  const next = readAgentSitePermissions(storageOverride).filter(item => item.key !== siteKey)
  writeAgentSitePermissions(next, storageOverride)
  return next
}

export function readAgentPermissionHistory(
  storageOverride?: Storage | null
): AgentPermissionHistoryEntry[] {
  const storage = getStorage(storageOverride)
  const raw = storage?.getItem(AGENT_PERMISSION_HISTORY_STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        item =>
          item &&
          typeof item === 'object' &&
          typeof item.id === 'string' &&
          Number.isFinite(item.timestamp) &&
          APPROVAL_MODES.has(item.mode) &&
          PERMISSION_DECISIONS.has(item.decision) &&
          Array.isArray(item.sites) &&
          item.sites.every((site: unknown) => typeof site === 'string') &&
          Array.isArray(item.actionTypes) &&
          item.actionTypes.every((actionType: unknown) => typeof actionType === 'string')
      )
      .slice(0, MAX_PERMISSION_HISTORY)
  } catch {
    return []
  }
}

export function recordAgentPermissionDecision(
  input: Omit<AgentPermissionHistoryEntry, 'id' | 'timestamp'>,
  storageOverride?: Storage | null
): AgentPermissionHistoryEntry[] {
  const storage = getStorage(storageOverride)
  if (!storage) return []
  const next = [
    { id: makeId(), timestamp: Date.now(), ...input },
    ...readAgentPermissionHistory(storage)
  ].slice(0, MAX_PERMISSION_HISTORY)
  storage.setItem(AGENT_PERMISSION_HISTORY_STORAGE_KEY, JSON.stringify(next))
  return next
}

const sensitiveFieldPattern =
  /password|passwd|passcode|one.?time|otp|verification.?code|access.?token|secret|credit.?card|card.?number|cvv|cvc|social.?security|identity|id.?number|e.?mail|phone|telephone|mobile|street.?address|postal|zip.?code|date.?of.?birth|\bdob\b|密码|验证码|动态码|令牌|信用卡|身份证|姓名|邮箱|手机|电话|地址|邮编|生日/i
const consequentialActionPattern =
  /delete|remove|destroy|erase|purchase|checkout|place.?order|\bpay\b|authorize|grant access|publish|send (?:message|email)|unsubscribe|删除|清空|永久|购买|支付|下单|授权|发布|发送|退订/i
const sensitiveQueryPattern = /token|key|secret|password|passwd|auth|code|session/i
const prohibitedPurchasePattern =
  /purchase|checkout|place.?order|confirm.?order|buy.?now|submit.?payment|complete.?payment|\bpay(?:ment)?\b|购买|立即购买|结账|下单|确认订单|提交支付|完成支付/i
const prohibitedAccountCreationPattern =
  /create.?account|sign.?up|register.?account|submit.?registration|开户|创建(?:账户|账号)|注册(?:账户|账号)?|提交注册/i
const prohibitedPermanentDeletionPattern =
  /permanent(?:ly)?.?delete|delete.?(?:account|email|file|message)|empty.?(?:trash|bin)|purge|destroy.?(?:account|data)|永久删除|彻底删除|清空回收站|删除(?:账户|账号|邮件|文件|消息)|注销账号|销毁数据/i
const prohibitedFinancialTradePattern =
  /execute.?trade|place.?(?:trade|market.?order)|buy.?(?:stock|share|crypto)|sell.?(?:stock|share|crypto)|transfer.?(?:funds?|money)|交易(?:股票|证券|加密货币)|买入(?:股票|证券|加密货币)|卖出(?:股票|证券|加密货币)|转账|资金划转/i
const prohibitedIdentityFieldPattern =
  /credit.?card|card.?number|cvv|cvc|social.?security|passport|identity|id.?number|bank.?account|routing.?number|信用卡|银行卡|卡号|身份证|护照|社会保障号|银行账户/i
const prohibitedSystemPathPattern =
  /^(?:\/etc(?:\/|$)|\/usr(?:\/|$)|\/bin(?:\/|$)|\/sbin(?:\/|$)|\/boot(?:\/|$)|\/system(?:\/|$)|[a-z]:\\windows(?:\\|$)|[a-z]:\\program files(?:\\|$))/i

export function isSensitiveAgentFieldDescriptor(value: unknown): boolean {
  return typeof value === 'string' && sensitiveFieldPattern.test(value)
}

/**
 * Actions in this classifier are refused in every approval mode. The check is
 * intentionally based on the semantic selector/note that the model must
 * provide, rather than inspecting user-entered values or persisting secrets.
 */
export function classifyProhibitedAgentAction(action: AgentAction): AgentActionProtection | null {
  const record = action as AgentAction & {
    selector?: string
    note?: string
    key?: string
    path?: string
  }
  const semanticTarget = `${record.selector || ''} ${record.note || ''} ${record.key || ''}`

  if (
    (action.type === 'input' || action.type === 'type') &&
    prohibitedIdentityFieldPattern.test(semanticTarget)
  ) {
    return { actionId: action.id, actionType: action.type, reason: '禁止输入支付卡或身份凭证数据' }
  }

  if (['click', 'click-dom', 'double-click', 'right-click', 'key'].includes(action.type)) {
    if (prohibitedPurchasePattern.test(semanticTarget)) {
      return { actionId: action.id, actionType: action.type, reason: '禁止完成购买或支付交易' }
    }
    if (prohibitedAccountCreationPattern.test(semanticTarget)) {
      return { actionId: action.id, actionType: action.type, reason: '禁止创建或注册账户' }
    }
    if (prohibitedPermanentDeletionPattern.test(semanticTarget)) {
      return { actionId: action.id, actionType: action.type, reason: '禁止永久删除账户或数据' }
    }
    if (prohibitedFinancialTradePattern.test(semanticTarget)) {
      return { actionId: action.id, actionType: action.type, reason: '禁止执行金融交易或资金划转' }
    }
  }

  if (
    action.type === 'write-file' &&
    typeof record.path === 'string' &&
    prohibitedSystemPathPattern.test(record.path.trim())
  ) {
    return { actionId: action.id, actionType: action.type, reason: '禁止修改系统文件' }
  }

  return null
}

export function classifyProtectedAgentAction(action: AgentAction): AgentActionProtection | null {
  if (action.type === 'write-file') {
    return { actionId: action.id, actionType: action.type, reason: '写入本地文件' }
  }
  if (action.type === 'close-tab') {
    return { actionId: action.id, actionType: action.type, reason: '关闭标签页可能丢失未保存内容' }
  }

  const record = action as AgentAction & {
    selector?: string
    note?: string
    url?: string
    key?: string
  }
  const semanticTarget = `${record.selector || ''} ${record.note || ''}`
  if (
    (action.type === 'input' || action.type === 'type') &&
    isSensitiveAgentFieldDescriptor(semanticTarget)
  ) {
    return { actionId: action.id, actionType: action.type, reason: '向敏感字段输入内容' }
  }
  if (
    ['click', 'click-dom', 'double-click', 'right-click', 'key'].includes(action.type) &&
    consequentialActionPattern.test(`${semanticTarget} ${record.key || ''}`)
  ) {
    return { actionId: action.id, actionType: action.type, reason: '可能触发外部或不可逆操作' }
  }
  if ((action.type === 'navigate' || action.type === 'open-tab') && record.url) {
    try {
      const url = new URL(record.url)
      if ([...url.searchParams.keys()].some(key => sensitiveQueryPattern.test(key))) {
        return { actionId: action.id, actionType: action.type, reason: 'URL 包含敏感参数' }
      }
    } catch {
      return { actionId: action.id, actionType: action.type, reason: '目标 URL 无法验证' }
    }
  }
  return null
}

const addSite = (sites: Map<string, AgentSiteDescriptor>, rawUrl: unknown) => {
  const site = normalizeAgentSite(rawUrl)
  if (site) sites.set(site.key, site)
}

const getTab = async (chromeAPI: typeof chrome, tabId: number) => {
  if (!chromeAPI.tabs?.get) throw new Error('无法读取标签页')
  return chromeAPI.tabs.get(tabId)
}

export async function resolveAgentActionSites(
  chromeAPI: typeof chrome,
  actions: AgentAction[],
  fallbackTabId: number | null
): Promise<AgentResolvedSites> {
  const sites = new Map<string, AgentSiteDescriptor>()
  const unresolvedTargets = new Set<string>()
  const tabIds = new Set<number>()
  let needsFallbackTab = false

  for (const action of actions) {
    if ((action.type === 'navigate' || action.type === 'open-tab') && action.url) {
      const before = sites.size
      addSite(sites, action.url)
      if (sites.size === before && !normalizeAgentSite(action.url)) {
        unresolvedTargets.add(`URL: ${action.url}`)
      }
      continue
    }
    if (action.type === 'group-tabs' || action.type === 'ungroup-tabs') {
      for (const tabId of action.tabIds) tabIds.add(tabId)
      continue
    }
    if (typeof action.tabId === 'number') {
      tabIds.add(action.tabId)
    } else if (PAGE_ACTION_TYPES.has(action.type)) {
      needsFallbackTab = true
    }
  }

  if (needsFallbackTab && typeof fallbackTabId === 'number') tabIds.add(fallbackTabId)
  if (needsFallbackTab && fallbackTabId === null) unresolvedTargets.add('当前标签页')

  await Promise.all(
    [...tabIds].map(async tabId => {
      try {
        const tab = await getTab(chromeAPI, tabId)
        const site = normalizeAgentSite(tab.url)
        if (site) sites.set(site.key, site)
        else unresolvedTargets.add(`标签页 ${tabId}`)
      } catch {
        unresolvedTargets.add(`标签页 ${tabId}`)
      }
    })
  )

  return { sites: [...sites.values()], unresolvedTargets: [...unresolvedTargets] }
}

export function assessAgentActionBatch(input: {
  mode: AgentApprovalMode
  actions: AgentAction[]
  resolved: AgentResolvedSites
  sitePermissions: AgentSitePermission[]
}): AgentPermissionAssessment {
  const decisionBySite = new Map(input.sitePermissions.map(item => [item.key, item.decision]))
  const sites = input.resolved.sites.map(site => ({
    ...site,
    decision: decisionBySite.get(site.key)
  }))
  const blocked = sites.filter(site => site.decision === 'block')
  const unknown = sites.filter(site => !site.decision)
  const prohibitedActions = input.actions
    .map(classifyProhibitedAgentAction)
    .filter((item): item is AgentActionProtection => Boolean(item))
  const prohibitedActionIds = new Set(prohibitedActions.map(item => item.actionId))
  const protectedActions = input.actions
    .filter(action => !prohibitedActionIds.has(action.id))
    .map(classifyProtectedAgentAction)
    .filter((item): item is AgentActionProtection => Boolean(item))
  const reasons: string[] = []

  if (blocked.length > 0) reasons.push(`已阻止站点：${blocked.map(site => site.label).join('、')}`)
  if (prohibitedActions.length > 0) {
    reasons.push(`禁止动作：${[...new Set(prohibitedActions.map(item => item.reason))].join('、')}`)
  }
  if (protectedActions.length > 0) {
    reasons.push(
      `受保护动作：${[...new Set(protectedActions.map(item => item.reason))].join('、')}`
    )
  }
  if (input.mode !== 'skip' && input.resolved.unresolvedTargets.length > 0) {
    reasons.push(`无法验证目标：${input.resolved.unresolvedTargets.join('、')}`)
  }
  if (input.mode === 'manual') reasons.push('当前为手动批准模式')
  if (input.mode === 'auto' && unknown.length > 0) {
    reasons.push(`站点尚未授权：${unknown.map(site => site.label).join('、')}`)
  }

  let status: AgentPermissionAssessment['status'] = 'allow'
  if (blocked.length > 0 || prohibitedActions.length > 0) status = 'blocked'
  else if (
    protectedActions.length > 0 ||
    (input.mode !== 'skip' && input.resolved.unresolvedTargets.length > 0)
  ) {
    status = 'approval-required'
  } else if (input.mode === 'manual') {
    status = 'approval-required'
  } else if (input.mode === 'auto' && unknown.length > 0) {
    status = 'approval-required'
  }

  return {
    status,
    mode: input.mode,
    sites,
    unresolvedTargets: input.resolved.unresolvedTargets,
    prohibitedActions,
    protectedActions,
    reasons,
    canAlwaysAllow:
      sites.some(site => site.persistable && site.decision !== 'allow') &&
      blocked.length === 0 &&
      prohibitedActions.length === 0
  }
}
