import { pageFetch, extractData } from '../utils'

export interface TagSearchResult {
  id: number
  text: string
  name: string
  description?: string | null
  count?: number
  pm_only?: boolean
  target_tag?: string | null
}

export async function searchTags(
  baseUrl: string,
  query: string,
  categoryId?: number | null,
  limit = 8
): Promise<TagSearchResult[]> {
  const params = new URLSearchParams()
  params.set('q', query || '')
  params.set('limit', String(limit))
  params.set('filterForInput', 'true')
  if (categoryId) params.set('categoryId', String(categoryId))

  const result = await pageFetch<any>(`${baseUrl}/tags/filter/search?${params.toString()}`)
  const data = extractData(result)
  if (result.ok === false) {
    return []
  }
  return (data?.results || []) as TagSearchResult[]
}
