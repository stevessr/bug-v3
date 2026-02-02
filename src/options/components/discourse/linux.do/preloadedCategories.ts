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

const preloadedCategoriesUrl = new URL('./preloaded-categories.json', import.meta.url).href

const byId = new Map<number, PreloadedCategory>()
const bySlug = new Map<string, PreloadedCategory>()
let all: PreloadedCategory[] = []
let loaded = false
let loadingPromise: Promise<PreloadedCategory[]> | null = null

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

export async function ensurePreloadedCategoriesLoaded() {
  if (loaded) return all
  if (loadingPromise) return loadingPromise

  loadingPromise = fetch(preloadedCategoriesUrl, { credentials: 'same-origin' })
    .then(async response => {
      if (!response.ok) {
        throw new Error(`Failed to load preloaded categories: ${response.status}`)
      }

      const data = await response.json()
      const list = Array.isArray(data) ? (data as PreloadedCategory[]) : []
      hydrateCategories(list)
      loaded = true
      return all
    })
    .catch(error => {
      console.warn('[DiscourseBrowser] preloaded categories load failed:', error)
      hydrateCategories([])
      loaded = true
      return all
    })
    .finally(() => {
      loadingPromise = null
    })

  return loadingPromise
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

// Start async loading early to avoid waiting for first category render.
void ensurePreloadedCategoriesLoaded()
