import { extractData, pageFetch } from '../utils'

/**
 * A template exposed by Discourse Templates.
 *
 * The official endpoint calls the body `content` (it is the first post's raw
 * value), so we keep that name here and never render it as HTML in the picker.
 */
export interface DiscourseForumTemplate {
  id: number
  title: string
  slug: string
  content: string
  tags: string[]
  usages: number
}

function baseUrlWithoutTrailingSlash(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

function parseErrorMessage(data: any, fallback: string): string {
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return String(data.errors[0])
  }
  if (typeof data?.error === 'string' && data.error.trim()) return data.error
  if (typeof data?.message === 'string' && data.message.trim()) return data.message
  return fallback
}

function normalizeTemplate(value: any): DiscourseForumTemplate | null {
  if (!value || typeof value !== 'object') return null

  const id = Number(value.id)
  const title = typeof value.title === 'string' ? value.title.trim() : ''
  const content =
    typeof value.content === 'string'
      ? value.content
      : typeof value.raw === 'string'
        ? value.raw
        : ''

  if (!Number.isFinite(id) || id <= 0 || !title) return null

  const tags = Array.isArray(value.tags)
    ? value.tags
        .map((tag: unknown) =>
          typeof tag === 'string'
            ? tag.trim()
            : typeof tag === 'object' && tag !== null && 'name' in tag
              ? String((tag as { name?: unknown }).name || '').trim()
              : ''
        )
        .filter(Boolean)
    : []

  return {
    id,
    title,
    slug: typeof value.slug === 'string' ? value.slug : '',
    content,
    tags: Array.from(new Set(tags)),
    usages: Number.isFinite(Number(value.usages)) ? Number(value.usages) : 0
  }
}

/**
 * Load the templates available to the current user.
 *
 * Discourse Templates mounts its controller at `/discourse_templates` and
 * returns `{ templates: [...] }`.  `extractData` also lets this work with the
 * extension's PAGE_FETCH envelope and with installations that return the
 * array directly.
 */
export async function loadForumTemplates(baseUrl: string): Promise<DiscourseForumTemplate[]> {
  const result = await pageFetch<any>(`${baseUrlWithoutTrailingSlash(baseUrl)}/discourse_templates`)
  const data = extractData(result)

  if (!result.ok) {
    throw new Error(parseErrorMessage(data, '论坛模板暂不可用'))
  }

  const values = Array.isArray(data) ? data : data?.templates
  if (!Array.isArray(values)) {
    throw new Error('论坛模板接口返回格式无效')
  }

  return values
    .map(normalizeTemplate)
    .filter((template): template is DiscourseForumTemplate => template !== null)
}

/** Record usage without blocking insertion into the composer. */
export async function markForumTemplateUsed(baseUrl: string, templateId: number): Promise<void> {
  const result = await pageFetch<any>(
    `${baseUrlWithoutTrailingSlash(baseUrl)}/discourse_templates/${encodeURIComponent(String(templateId))}/use`,
    { method: 'POST' }
  )
  if (!result.ok) {
    const data = extractData(result)
    throw new Error(parseErrorMessage(data, '模板使用次数更新失败'))
  }
}
