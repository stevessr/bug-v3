import type { Emoji } from '@/types/type'

export type EmojiUrlRewriteField = 'url' | 'displayUrl' | 'originUrl'

export interface EmojiUrlRewriteResult {
  changed: boolean
  emoji: Emoji
  changedFields: EmojiUrlRewriteField[]
}

function cloneRegex(regex: RegExp): RegExp {
  return new RegExp(regex.source, regex.flags)
}

export function buildEmojiUrlRewriteRegex(pattern: string, flags = 'g'): RegExp {
  const normalizedPattern = pattern.trim()
  if (!normalizedPattern) {
    throw new Error('请输入正则表达式')
  }

  return new RegExp(normalizedPattern, flags)
}

export function rewriteEmojiUrlValue(value: string, regex: RegExp, replacement: string): string {
  return value.replace(cloneRegex(regex), replacement)
}

function maybeRewriteValue(
  value: string | undefined,
  regex: RegExp,
  replacement: string
): { changed: boolean; value?: string } {
  if (!value) {
    return { changed: false, value }
  }

  const nextValue = rewriteEmojiUrlValue(value, regex, replacement)
  return {
    changed: nextValue !== value,
    value: nextValue
  }
}

export function rewriteEmojiUrlFields(
  emoji: Emoji,
  regex: RegExp,
  replacement: string
): EmojiUrlRewriteResult {
  const changedFields: EmojiUrlRewriteField[] = []
  const updatedEmoji: Emoji = { ...emoji }

  const rewrittenUrl = maybeRewriteValue(emoji.url, regex, replacement)
  if (rewrittenUrl.changed && rewrittenUrl.value) {
    updatedEmoji.url = rewrittenUrl.value
    changedFields.push('url')
  }

  const relatedFields: EmojiUrlRewriteField[] = ['displayUrl', 'originUrl']
  for (const field of relatedFields) {
    const currentValue = emoji[field]
    if (!currentValue) continue

    let nextValue = currentValue
    if (rewrittenUrl.changed && currentValue === emoji.url && rewrittenUrl.value) {
      nextValue = rewrittenUrl.value
    } else {
      const rewrittenField = maybeRewriteValue(currentValue, regex, replacement)
      if (rewrittenField.changed && rewrittenField.value) {
        nextValue = rewrittenField.value
      }
    }

    if (nextValue !== currentValue) {
      updatedEmoji[field] = nextValue
      changedFields.push(field)
    }
  }

  return {
    changed: changedFields.length > 0,
    emoji: changedFields.length > 0 ? updatedEmoji : emoji,
    changedFields
  }
}
