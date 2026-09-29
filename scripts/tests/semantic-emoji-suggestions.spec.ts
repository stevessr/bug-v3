import { test, expect } from '@playwright/test'

import { cosineSimilarity, normalizeEmbedding, rankSemanticMatches } from '../../src/utils/semanticRanking'
import { semanticEmojiCandidates, semanticEmojiId } from '../../src/utils/semanticEmoji'
import type { EmojiGroup } from '../../src/types/type'

test('validates embeddings and normalizes their length', () => {
  expect(normalizeEmbedding([3, 4])).toEqual([0.6, 0.8])
  expect(normalizeEmbedding([0, 0])).toBeNull()
  expect(normalizeEmbedding([1, Number.NaN])).toBeNull()
  expect(normalizeEmbedding([1])).toBeNull()
  expect(cosineSimilarity([1, 0], [0, 1])).toBe(0)
  expect(cosineSimilarity([1, 0], [1])).toBe(-1)
})

test('returns semantic neighbors with lexical tie break and excludes unrelated vectors', () => {
  const result = rankSemanticMatches('开心', [1, 0], [
    { id: 'smile', text: '高兴，欢呼', vector: [0.96, 0.28] },
    { id: 'exact', text: '开心', vector: [0.9, 0.435] },
    { id: 'sad', text: '难过', vector: [0, 1] },
    { id: 'invalid-dimension', text: '开心', vector: [1] }
  ])
  expect(result.map(item => item.id)).toEqual(['exact', 'smile'])
  expect(rankSemanticMatches('开心', [1, 0], [], 8)).toEqual([])
  expect(rankSemanticMatches('开心', [1, 0], [
    { id: 'good', text: '开心', vector: [1, 0] }
  ], 0)).toEqual([])
})

test('uses emoji name, tags and group description without collecting image bytes', () => {
  const groups: EmojiGroup[] = [{
    id: 'cats', name: '猫猫', icon: '', order: 0,
    emojis: [{
      id: 'one', groupId: 'cats', packet: 0, name: '捂脸',
      tags: ['尴尬', '无奈'], url: 'https://example.com/image.png'
    }]
  }]
  const items = semanticEmojiCandidates(groups)
  expect(items).toHaveLength(1)
  expect(items[0].id).toBe(semanticEmojiId(groups[0].emojis[0]))
  expect(items[0].text).toContain('尴尬')
  expect(items[0].text).toContain('猫猫')
  expect(items[0].text).not.toContain('https://')
})
