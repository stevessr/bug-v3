/**
 * Pure, deterministic scoring for semantic sticker suggestions.
 * Vectors are produced by an explicitly configured embedding model, never by this file.
 */
export function normalizeEmbedding(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > 4096) return null
  if (!value.every(v => typeof v === 'number' && Number.isFinite(v))) return null
  const length = Math.hypot(...value)
  if (!Number.isFinite(length) || length === 0) return null
  return value.map(v => v / length)
}

export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || !a.length) return -1
  let score = 0
  for (let i = 0; i < a.length; i++) score += a[i] * b[i]
  return score
}

export interface SemanticMatch {
  id: string
  text: string
  vector: readonly number[]
  usageCount?: number
}

export function rankSemanticMatches(
  query: string,
  queryVector: readonly number[],
  items: readonly SemanticMatch[],
  limit = 12
): Array<{ id: string; score: number }> {
  const q = query.trim().toLocaleLowerCase()
  if (!q || !queryVector.length) return []
  return items
    .map(item => {
      const similarity = cosineSimilarity(queryVector, item.vector)
      const lexical = item.text.toLocaleLowerCase().includes(q)
      return {
        id: item.id,
        score: similarity + (lexical ? 0.18 : 0) +
          Math.min(Math.log1p(Math.max(0, item.usageCount || 0)) / 70, 0.07),
        eligible: similarity >= 0.2 || lexical
      }
    })
    .filter(result => result.eligible)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, Math.min(limit, 24)))
    .map(({ id, score }) => ({ id, score }))
}
