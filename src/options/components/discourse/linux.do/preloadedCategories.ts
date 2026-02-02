import preloadedCategories from './preloaded-categories.json'

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

const byId = new Map<number, PreloadedCategory>()
const bySlug = new Map<string, PreloadedCategory>()

;(preloadedCategories as PreloadedCategory[]).forEach(category => {
  if (typeof category.id === 'number') {
    byId.set(category.id, category)
  }
  if (typeof category.slug === 'string' && category.slug.trim()) {
    bySlug.set(category.slug, category)
  }
})

export const getPreloadedCategory = (id?: number | null, slug?: string | null) => {
  if (typeof id === 'number' && byId.has(id)) return byId.get(id) || null
  if (typeof slug === 'string' && slug.trim()) return bySlug.get(slug) || null
  return null
}
