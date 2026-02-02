import type { DiscourseCategory } from '../types'

type RawCategory = Record<string, any>

function toCategoryId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function normalizeIdList(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null
  const ids = value.map(toCategoryId).filter((id): id is number => id !== null)
  return ids.length > 0 ? Array.from(new Set(ids)) : null
}

function getChildren(category: RawCategory): RawCategory[] {
  if (Array.isArray(category.subcategory_list)) return category.subcategory_list
  if (Array.isArray(category.subcategories)) return category.subcategories
  return []
}

function upsertCategory(
  byId: Map<number, DiscourseCategory>,
  list: DiscourseCategory[],
  raw: RawCategory,
  fallbackParentId: number | null
): DiscourseCategory | null {
  const id = toCategoryId(raw.id)
  if (id === null) return null

  const rawParentId = toCategoryId(raw.parent_category_id ?? raw.parentCategoryId)
  const parentId = rawParentId ?? fallbackParentId
  const subcategoryIds = normalizeIdList(raw.subcategory_ids ?? raw.subcategoryIds)
  const topicCountRaw = raw.topic_count ?? raw.topicCount
  const topicCount = typeof topicCountRaw === 'number' ? topicCountRaw : Number(topicCountRaw) || 0

  const incoming: DiscourseCategory = {
    ...raw,
    id,
    name: typeof raw.name === 'string' ? raw.name : `category-${id}`,
    slug: typeof raw.slug === 'string' ? raw.slug : String(id),
    color: typeof raw.color === 'string' ? raw.color : '0088CC',
    text_color: typeof raw.text_color === 'string' ? raw.text_color : 'FFFFFF',
    topic_count: topicCount,
    parent_category_id: parentId,
    subcategory_ids: subcategoryIds
  }

  const existing = byId.get(id)
  if (!existing) {
    byId.set(id, incoming)
    list.push(incoming)
    return incoming
  }

  Object.assign(existing, incoming)
  if (existing.parent_category_id == null && parentId != null) {
    existing.parent_category_id = parentId
  }
  if (subcategoryIds?.length) {
    const merged = new Set<number>(existing.subcategory_ids ?? [])
    subcategoryIds.forEach(childId => merged.add(childId))
    existing.subcategory_ids = Array.from(merged)
  }
  return existing
}

export function normalizeCategoriesFromResponse(data: any): DiscourseCategory[] {
  const rawCategories = data?.category_list?.categories ?? data?.categories
  if (!Array.isArray(rawCategories)) return []

  const byId = new Map<number, DiscourseCategory>()
  const normalized: DiscourseCategory[] = []
  const links = new Map<number, Set<number>>()

  const connect = (parentId: number, childId: number) => {
    const set = links.get(parentId) ?? new Set<number>()
    set.add(childId)
    links.set(parentId, set)
  }

  const visit = (raw: RawCategory, fallbackParentId: number | null = null) => {
    const current = upsertCategory(byId, normalized, raw, fallbackParentId)
    if (!current) return

    const explicitChildren = normalizeIdList(raw.subcategory_ids ?? raw.subcategoryIds)
    explicitChildren?.forEach(childId => connect(current.id, childId))

    getChildren(raw).forEach(child => {
      const childId = toCategoryId(child?.id)
      if (childId !== null) {
        connect(current.id, childId)
      }
      visit(child, current.id)
    })
  }

  rawCategories.forEach(category => visit(category))

  links.forEach((childIds, parentId) => {
    const parent = byId.get(parentId)
    if (!parent) return

    const merged = new Set<number>(parent.subcategory_ids ?? [])
    childIds.forEach(childId => merged.add(childId))
    parent.subcategory_ids = merged.size > 0 ? Array.from(merged) : null

    childIds.forEach(childId => {
      const child = byId.get(childId)
      if (child && child.parent_category_id == null) {
        child.parent_category_id = parentId
      }
    })
  })

  return normalized
}
