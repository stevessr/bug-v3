import { extractData, pageFetch } from '../utils'

import bundledCategoryDefinitions from './preloaded-categories.json'

type UploadedLogo = { url: string } | null

export type PreloadedCategory = {
  id: number
  name?: string | null
  slug?: string | null
  parent_category_id?: number | null
  color?: string | null
  text_color?: string | null
  style_type?: string | null
  icon?: string | null
  emoji?: string | null
  uploaded_logo?: UploadedLogo
  uploaded_logo_dark?: UploadedLogo
  [key: string]: unknown
}

type CachedCategories = {
  expiresAt: number
  categories: PreloadedCategory[]
  byId: Map<number, PreloadedCategory>
  bySlug: Map<string, PreloadedCategory>
}

const CATEGORY_CACHE_TTL_MS = 15 * 60 * 1000
const categoryCache = new Map<string, CachedCategories>()
const categoryRequests = new Map<string, Promise<PreloadedCategory[]>>()

// A packaged snapshot remains an offline Linux.do fallback only. Live data is
// always preferred: the same category metadata (icons, emoji, colors and
// uploaded logos) is available in Discourse's `data-preloaded.site` and its
// official `/site.json` representation.
const bundledCategories: PreloadedCategory[] = Array.isArray(bundledCategoryDefinitions)
  ? (bundledCategoryDefinitions as PreloadedCategory[])
  : []

const bundledEntry = createCacheEntry(bundledCategories, Number.POSITIVE_INFINITY)

function getOrigin(value?: string | null) {
  if (!value) return ''
  try {
    return new URL(value).origin
  } catch {
    return ''
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeCategory(value: unknown): PreloadedCategory | null {
  if (!isRecord(value)) return null
  const id = Number(value.id)
  if (!Number.isFinite(id) || id <= 0) return null
  return { ...value, id }
}

function extractCategories(data: unknown): PreloadedCategory[] {
  const root = isRecord(data) ? data : null
  const rawCategories = Array.isArray(root?.categories)
    ? root.categories
    : isRecord(root?.category_list) && Array.isArray(root.category_list.categories)
      ? root.category_list.categories
      : []
  const byId = new Map<number, PreloadedCategory>()

  const visit = (raw: unknown) => {
    const category = normalizeCategory(raw)
    if (!category) return
    byId.set(category.id, category)

    const record = raw as Record<string, unknown>
    const nested = Array.isArray(record.subcategory_list)
      ? record.subcategory_list
      : Array.isArray(record.subcategories)
        ? record.subcategories
        : []
    nested.forEach(visit)
  }

  rawCategories.forEach(visit)
  return Array.from(byId.values())
}

function createCacheEntry(categories: PreloadedCategory[], expiresAt: number): CachedCategories {
  const byId = new Map<number, PreloadedCategory>()
  const bySlug = new Map<string, PreloadedCategory>()

  categories.forEach(category => {
    byId.set(category.id, category)
    if (typeof category.slug === 'string' && category.slug.trim()) {
      bySlug.set(category.slug.trim(), category)
    }
  })

  return { expiresAt, categories, byId, bySlug }
}

function fallbackEntry(origin: string): CachedCategories | null {
  return isLinuxDoUrl(origin) ? bundledEntry : null
}

function getEntry(baseUrl?: string | null): CachedCategories | null {
  const origin = getOrigin(baseUrl)
  if (!origin) return bundledEntry
  return categoryCache.get(origin) || fallbackEntry(origin)
}

/**
 * Load category metadata from the same source as Discourse's preloaded
 * `site` payload. PAGE_FETCH serves `data-preloaded` immediately when an
 * matching forum tab exists, and falls back to `/site.json` then
 * `/categories.json` for a fresh official response.
 */
export async function ensurePreloadedCategoriesLoaded(
  baseUrl?: string | null
): Promise<PreloadedCategory[]> {
  const origin = getOrigin(baseUrl)
  if (!origin) return bundledEntry.categories

  const cached = categoryCache.get(origin)
  if (cached && cached.expiresAt > Date.now()) return cached.categories

  const inFlight = categoryRequests.get(origin)
  if (inFlight) return inFlight

  const request = (async () => {
    for (const path of ['/site.json', '/categories.json']) {
      try {
        const response = await pageFetch<unknown>(`${origin}${path}`)
        if (!response.ok) continue

        const categories = extractCategories(extractData(response))
        if (categories.length === 0) continue

        const entry = createCacheEntry(categories, Date.now() + CATEGORY_CACHE_TTL_MS)
        categoryCache.set(origin, entry)
        return entry.categories
      } catch {
        // The next official endpoint, a stale cache, or the packaged Linux.do
        // fallback can still make category controls usable.
      }
    }

    return cached?.categories || fallbackEntry(origin)?.categories || []
  })().finally(() => categoryRequests.delete(origin))

  categoryRequests.set(origin, request)
  return request
}

export function isLinuxDoUrl(url?: string | null) {
  const origin = getOrigin(url)
  if (!origin) return false
  const hostname = new URL(origin).hostname.toLocaleLowerCase()
  return hostname === 'linux.do' || hostname.endsWith('.linux.do')
}

export const getPreloadedCategory = (
  id?: number | null,
  slug?: string | null,
  baseUrl?: string | null
) => {
  const entry = getEntry(baseUrl)
  if (!entry) return null
  if (typeof id === 'number' && entry.byId.has(id)) return entry.byId.get(id) || null
  if (typeof slug === 'string' && slug.trim()) return entry.bySlug.get(slug.trim()) || null
  return null
}

export const getAllPreloadedCategories = (baseUrl?: string | null) =>
  getEntry(baseUrl)?.categories || []
