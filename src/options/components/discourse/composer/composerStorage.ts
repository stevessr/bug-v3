/**
 * Local persistence for the Discourse browser composer: per-forum drafts,
 * user-defined templates, and recently used tags.
 *
 * Follows the same localStorage convention as DiscourseEmojiPicker's recent
 * emojis: keys are namespaced by forum origin so multiple forums never clash.
 */

export interface ComposerDraft {
  title?: string
  raw?: string
  tags?: string[]
  categoryId?: number | null
  recipients?: string[]
  savedAt?: number
}
export interface ComposerTemplate {
  id: string
  name: string
  content: string
  /** 应用模板时分类直接覆盖当前选择；null 表示模板不带分类。 */
  categoryId: number | null
  /** 应用模板时标签追加合并（大小写去重），不覆盖。 */
  tags: string[]
  createdAt: number
  lastUsedAt: number
}

const DRAFT_PREFIX = 'discourse-browser:composer-draft:v1:'
const TEMPLATE_PREFIX = 'discourse-browser:composer-templates:v1:'
const RECENT_TAGS_PREFIX = 'discourse-browser:recent-tags:v1:'

const MAX_TEMPLATES = 50
const MAX_RECENT_TAGS = 20

function storage(): Storage | null {
  return typeof localStorage === 'undefined' ? null : localStorage
}

function originOf(baseUrl: string): string {
  try {
    return new URL(baseUrl).origin
  } catch {
    return encodeURIComponent(baseUrl)
  }
}

export function draftKey(baseUrl: string, scope: string): string {
  return `${DRAFT_PREFIX}${originOf(baseUrl)}:${scope}`
}

/** Draft scope identifies which composer instance a draft belongs to. */
export function draftScope(mode: 'topic' | 'reply' | 'privateMessage', topicId?: number): string {
  if (mode === 'reply') return `reply-${topicId ?? 0}`
  return mode === 'privateMessage' ? 'pm' : 'topic'
}

function readJson<T>(key: string): T | null {
  const store = storage()
  if (!store) return null
  try {
    const value = JSON.parse(store.getItem(key) || 'null')
    return (value as T) ?? null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): boolean {
  const store = storage()
  if (!store) return false
  try {
    store.setItem(key, JSON.stringify(value))
    return true
  } catch {
    // Storage full or unavailable — persistence stays best-effort.
    return false
  }
}

export function loadDraft(baseUrl: string, scope: string): ComposerDraft | null {
  const draft = readJson<ComposerDraft>(draftKey(baseUrl, scope))
  if (!draft || typeof draft !== 'object') return null
  if (!draft.raw && !draft.title && !draft.recipients?.length) return null
  return draft
}

export function saveDraft(baseUrl: string, scope: string, draft: ComposerDraft): void {
  writeJson(draftKey(baseUrl, scope), { ...draft, savedAt: Date.now() })
}

export function clearDraft(baseUrl: string, scope: string): void {
  storage()?.removeItem(draftKey(baseUrl, scope))
}

function templateKey(baseUrl: string): string {
  return `${TEMPLATE_PREFIX}${originOf(baseUrl)}`
}

export function loadTemplates(baseUrl: string): ComposerTemplate[] {
  const list = readJson<ComposerTemplate[]>(templateKey(baseUrl))
  if (!Array.isArray(list)) return []
  return list
    .filter(
      item =>
        item &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        typeof item.content === 'string'
    )
    .sort((left, right) => right.lastUsedAt - left.lastUsedAt)
}

export function saveTemplate(
  baseUrl: string,
  name: string,
  content: string,
  categoryId?: number | null,
  tags: string[] = []
): void {
  const trimmedName = name.trim() || content.trim().split('\n')[0].slice(0, 40) || '未命名模板'
  const list = loadTemplates(baseUrl).filter(item => item.name !== trimmedName)
  list.unshift({
    id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: trimmedName,
    content,
    categoryId: typeof categoryId === 'number' ? categoryId : null,
    tags: tags.map(tag => String(tag || '').trim()).filter(Boolean),
    createdAt: Date.now(),
    lastUsedAt: Date.now()
  })
  writeJson(templateKey(baseUrl), list.slice(0, MAX_TEMPLATES))
}

export function deleteTemplate(baseUrl: string, templateId: string): void {
  writeJson(
    templateKey(baseUrl),
    loadTemplates(baseUrl).filter(item => item.id !== templateId)
  )
}

export function markTemplateUsed(baseUrl: string, templateId: string): void {
  writeJson(
    templateKey(baseUrl),
    loadTemplates(baseUrl).map(item =>
      item.id === templateId ? { ...item, lastUsedAt: Date.now() } : item
    )
  )
}

function recentTagsKey(baseUrl: string): string {
  return `${RECENT_TAGS_PREFIX}${originOf(baseUrl)}`
}

export function loadRecentTags(baseUrl: string): string[] {
  const list = readJson<string[]>(recentTagsKey(baseUrl))
  if (!Array.isArray(list)) return []
  return list.filter((tag): tag is string => typeof tag === 'string' && Boolean(tag))
}

export function recordRecentTags(baseUrl: string, tags: string[]): void {
  const used = tags.map(tag => String(tag || '').trim()).filter(Boolean)
  if (!used.length) return
  // Dedupe case-insensitively; new tags win, existing entries keep their casing.
  const merged = [...used, ...loadRecentTags(baseUrl)]
  const seen = new Set<string>()
  const unique = merged.filter(tag => {
    const key = tag.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  writeJson(recentTagsKey(baseUrl), unique.slice(0, MAX_RECENT_TAGS))
}
