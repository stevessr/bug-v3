export type AgentUsage = {
  input_tokens: number
  cached_input_tokens: number
  output_tokens: number
} | null

const toNonNegativeInt = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.floor(parsed)
}

export const normalizeAgentUsage = (usage: unknown): AgentUsage => {
  if (!usage || typeof usage !== 'object') return null
  const record = usage as Record<string, unknown>

  const inputTokens =
    toNonNegativeInt(record.input_tokens) ?? toNonNegativeInt(record.inputTokens) ?? null
  const outputTokens =
    toNonNegativeInt(record.output_tokens) ?? toNonNegativeInt(record.outputTokens) ?? null
  const cachedInputTokens =
    toNonNegativeInt(record.cached_input_tokens) ??
    toNonNegativeInt(record.cachedInputTokens) ??
    toNonNegativeInt(record.cache_read_input_tokens) ??
    toNonNegativeInt(record.cacheReadInputTokens) ??
    0

  if (inputTokens === null || outputTokens === null) return null

  return {
    input_tokens: inputTokens,
    cached_input_tokens: cachedInputTokens,
    output_tokens: outputTokens
  }
}
