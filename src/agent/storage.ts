import { defaultAgentSettings } from './defaultSettings'
import type { AgentSettings, ProviderProfile } from './types'

const STORAGE_KEY = 'ai-agent-settings-v1'

const resolveMaxTokens = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.floor(parsed)
}

/**
 * 从 legacy 字段（baseUrl + apiKey + model 字符串）推断 provider id。
 * 仅在旧版本数据迁移时使用，与 piSupport.inferProvider 保持一致的判断顺序。
 */
const guessProviderFromLegacy = (
  modelId: string | undefined,
  baseUrl: string | undefined
): string => {
  const model = (modelId || '').trim().toLowerCase()
  const url = (baseUrl || '').trim().toLowerCase()

  const slashIdx = model.indexOf('/')
  if (slashIdx > 0) {
    return model.slice(0, slashIdx) || 'anthropic'
  }

  if (model.startsWith('claude')) return 'anthropic'
  if (model.startsWith('gemini')) return 'google'
  if (model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3')) return 'openai'
  if (model.startsWith('mistral')) return 'mistral'
  if (model.startsWith('grok')) return 'xai'
  if (model.startsWith('moonshot') || model.startsWith('kimi')) return 'kimi-coding'

  if (url.includes('anthropic')) return 'anthropic'
  if (url.includes('openrouter')) return 'openrouter'
  if (url.includes('googleapis') || url.includes('generativelanguage')) return 'google'
  if (url.includes('mistral')) return 'mistral'
  if (url.includes('groq')) return 'groq'
  if (url.includes('cerebras')) return 'cerebras'
  if (url.includes('x.ai') || url.includes('xai')) return 'xai'
  if (url.includes('z.ai') || url.includes('zhipu')) return 'zai'
  if (url.includes('minimax')) return 'minimax'
  if (url.includes('kimi') || url.includes('moonshot')) return 'kimi-coding'
  if (url.includes('openai')) return 'openai'

  return 'anthropic'
}

/** 去掉 `provider/model` 前缀，返回纯模型 id */
const stripProviderPrefix = (raw: string | undefined, provider: string): string => {
  const trimmed = (raw || '').trim()
  if (!trimmed) return ''
  if (trimmed.startsWith(`${provider}/`)) return trimmed.slice(provider.length + 1)
  return trimmed
}

/**
 * 在缺少 providerProfiles 的旧版本数据上做一次迁移，把单字段配置
 * 折叠成一个 ProviderProfile。返回 [profiles, activeProvider]。
 */
const migrateLegacyProfile = (
  parsed: Partial<AgentSettings>
): { profiles: ProviderProfile[]; active: string } => {
  const provider = guessProviderFromLegacy(parsed.taskModel, parsed.baseUrl)
  const profile: ProviderProfile = {
    provider,
    label: provider,
    apiKey: parsed.apiKey || '',
    baseUrl: parsed.baseUrl || '',
    taskModel: stripProviderPrefix(parsed.taskModel, provider),
    reasoningModel: stripProviderPrefix(parsed.reasoningModel, provider),
    imageModel: stripProviderPrefix(parsed.imageModel, provider)
  }
  return { profiles: [profile], active: provider }
}

/**
 * 校验并规范化 providerProfiles 数组。
 * 用户手动编辑或部分写入时可能产生空对象，这里统一兜底。
 */
const sanitizeProfiles = (input: unknown): ProviderProfile[] => {
  if (!Array.isArray(input)) return []
  const result: ProviderProfile[] = []
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue
    const provider =
      typeof (raw as ProviderProfile).provider === 'string'
        ? (raw as ProviderProfile).provider.trim()
        : ''
    if (!provider) continue
    result.push({
      provider,
      label:
        typeof (raw as ProviderProfile).label === 'string'
          ? (raw as ProviderProfile).label
          : undefined,
      apiKey:
        typeof (raw as ProviderProfile).apiKey === 'string' ? (raw as ProviderProfile).apiKey : '',
      baseUrl:
        typeof (raw as ProviderProfile).baseUrl === 'string'
          ? (raw as ProviderProfile).baseUrl
          : '',
      taskModel:
        typeof (raw as ProviderProfile).taskModel === 'string'
          ? (raw as ProviderProfile).taskModel
          : '',
      reasoningModel:
        typeof (raw as ProviderProfile).reasoningModel === 'string'
          ? (raw as ProviderProfile).reasoningModel
          : '',
      imageModel:
        typeof (raw as ProviderProfile).imageModel === 'string'
          ? (raw as ProviderProfile).imageModel
          : ''
    })
  }
  return result
}

export function loadAgentSettings(): AgentSettings {
  if (typeof localStorage === 'undefined') return { ...defaultAgentSettings }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...defaultAgentSettings }
    const parsed = JSON.parse(raw) as Partial<AgentSettings>

    let profiles = sanitizeProfiles(parsed.providerProfiles)
    let active = typeof parsed.activeProvider === 'string' ? parsed.activeProvider : ''

    // 旧版本：没有 profiles 时根据 legacy 字段迁移
    if (profiles.length === 0) {
      const migrated = migrateLegacyProfile(parsed)
      profiles = migrated.profiles
      active = migrated.active
    }

    // active 必须指向一个真实存在的 profile
    if (!profiles.some(p => p.provider === active)) {
      active = profiles[0].provider
    }

    return {
      ...defaultAgentSettings,
      ...parsed,
      providerProfiles: profiles,
      activeProvider: active,
      mcpServers: parsed.mcpServers || [],
      folderRoots: parsed.folderRoots || [],
      subagents: parsed.subagents || defaultAgentSettings.subagents,
      maxTokens: resolveMaxTokens(parsed.maxTokens, defaultAgentSettings.maxTokens),
      masterSystemPrompt: parsed.masterSystemPrompt || defaultAgentSettings.masterSystemPrompt,
      enableThoughts:
        typeof parsed.enableThoughts === 'boolean'
          ? parsed.enableThoughts
          : defaultAgentSettings.enableThoughts
    }
  } catch {
    return { ...defaultAgentSettings }
  }
}

export function saveAgentSettings(settings: AgentSettings): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function resetAgentSettings(): AgentSettings {
  const settings = { ...defaultAgentSettings }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }
  return settings
}
