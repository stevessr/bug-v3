import bundledCategoryDefinitions from './preloaded-categories.json'

type UploadedLogo = { url: string } | null

type PreloadedCategory = {
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
}

// Keep the packaged forum definitions available synchronously. Category payloads
// returned for topics are often intentionally compact (id/name/color only), so
// waiting for the lazy asset fetch used to leave major Linux.do sections with a
// plain color dot instead of their board icon/logo on the topic header.
const bundledCategories: PreloadedCategory[] = Array.isArray(bundledCategoryDefinitions)
  ? (bundledCategoryDefinitions as PreloadedCategory[])
  : []

const byId = new Map<number, PreloadedCategory>()
const bySlug = new Map<string, PreloadedCategory>()
let all: PreloadedCategory[] = []

function hydrateCategories(list: PreloadedCategory[]) {
  all = list
  byId.clear()
  bySlug.clear()

  all.forEach(category => {
    if (typeof category.id === 'number') {
      byId.set(category.id, category)
    }
    if (typeof category.slug === 'string' && category.slug.trim()) {
      bySlug.set(category.slug, category)
    }
  })
}

hydrateCategories(bundledCategories)

export async function ensurePreloadedCategoriesLoaded() {
  return all
}

export function isLinuxDoUrl(url?: string | null) {
  if (!url) return false
  return url.includes('linux.do')
}

export const getPreloadedCategory = (id?: number | null, slug?: string | null) => {
  if (typeof id === 'number' && byId.has(id)) return byId.get(id) || null
  if (typeof slug === 'string' && slug.trim()) return bySlug.get(slug) || null
  return null
}

export const getAllPreloadedCategories = () => all
