import { defineStore } from 'pinia'
import { ref, toRaw } from 'vue'

import type { Emoji, EmojiGroup } from '@/types/type'

// Trie 树节点结构
interface TrieNode {
  children: Map<string, TrieNode>
  emojiIds: Set<string> // 以此节点为前缀的所有 emoji ID
}

const createTrieNode = (): TrieNode => ({
  children: new Map(),
  emojiIds: new Set()
})

/**
 * 搜索索引 Store
 * 负责管理搜索索引和 Trie 树，提供高效的搜索功能
 */
export const useSearchIndexStore = defineStore('searchIndex', () => {
  // --- State ---
  const searchIndexCache = ref<Map<string, Set<string>>>(new Map())
  const searchPrefixTrie = ref<TrieNode>(createTrieNode())
  const searchIndexValid = ref(false)

  // --- Private Helpers ---

  /**
   * 向 Trie 树添加单词
   */
  const addWordToTrie = (trie: TrieNode, word: string, emojiId: string) => {
    let node = trie
    for (const char of word) {
      if (!node.children.has(char)) {
        node.children.set(char, createTrieNode())
      }
      const nextNode = node.children.get(char)
      if (nextNode) {
        node = nextNode
        node.emojiIds.add(emojiId)
      }
    }
  }

  /**
   * 将 emoji 添加到索引和 Trie 树
   */
  const addEmojiToSearchIndex = (index: Map<string, Set<string>>, trie: TrieNode, emoji: Emoji) => {
    if (!emoji) return
    const emojiId = emoji.id

    // 索引名称的每个单词
    const nameLower = (emoji.name || '').toLowerCase()
    const words = nameLower.split(/\s+/)
    for (const word of words) {
      if (!index.has(word)) {
        index.set(word, new Set())
      }
      const wordSet = index.get(word)
      if (wordSet) {
        wordSet.add(emojiId)
      }
      addWordToTrie(trie, word, emojiId)
    }

    // 索引标签
    if (emoji.tags) {
      for (const tag of emoji.tags) {
        const tagLower = tag.toLowerCase()
        if (!index.has(tagLower)) {
          index.set(tagLower, new Set())
        }
        const tagSet = index.get(tagLower)
        if (tagSet) {
          tagSet.add(emojiId)
        }
        addWordToTrie(trie, tagLower, emojiId)
      }
    }
  }

  /**
   * 从索引中移除 emoji
   */
  const removeEmojiFromSearchIndex = (index: Map<string, Set<string>>, emoji: Emoji) => {
    if (!emoji) return
    const emojiId = emoji.id

    // 移除名称索引
    const nameLower = (emoji.name || '').toLowerCase()
    const words = nameLower.split(/\s+/)
    for (const word of words) {
      const set = index.get(word)
      if (set) {
        set.delete(emojiId)
        if (set.size === 0) {
          index.delete(word)
        }
      }
    }

    // 移除标签索引
    if (emoji.tags) {
      for (const tag of emoji.tags) {
        const tagLower = tag.toLowerCase()
        const set = index.get(tagLower)
        if (set) {
          set.delete(emojiId)
          if (set.size === 0) {
            index.delete(tagLower)
          }
        }
      }
    }
  }

  // --- Public Actions ---

  /**
   * 构建完整的搜索索引
   */
  const buildSearchIndex = (groups: EmojiGroup[]) => {
    const index = new Map<string, Set<string>>()
    const trie = createTrieNode()

    // 优化：使用 toRaw 避免响应式代理开销
    const rawGroups = toRaw(groups)
    for (const group of rawGroups) {
      const emojis = group.emojis || []
      for (const emoji of emojis) {
        if (!emoji) continue
        addEmojiToSearchIndex(index, trie, emoji)
      }
    }

    searchIndexCache.value = index
    searchPrefixTrie.value = trie
    searchIndexValid.value = true
  }

  /**
   * 增量添加 emoji 到索引
   */
  const addEmojiToIndex = (emoji: Emoji) => {
    if (!searchIndexValid.value) return
    addEmojiToSearchIndex(searchIndexCache.value, searchPrefixTrie.value, emoji)
  }

  /**
   * 增量移除 emoji（Trie 树删除复杂，重建索引）
   */
  const removeEmojiFromIndex = (emoji: Emoji) => {
    if (!searchIndexValid.value) return
    removeEmojiFromSearchIndex(searchIndexCache.value, emoji)
    // Trie 树删除节点复杂度高，标记索引无效以触发重建
    searchIndexValid.value = false
  }

  /**
   * 更新 emoji 索引
   */
  const updateEmojiInIndex = (oldEmoji: Emoji, newEmoji: Emoji) => {
    if (!searchIndexValid.value) return
    removeEmojiFromSearchIndex(searchIndexCache.value, oldEmoji)
    addEmojiToSearchIndex(searchIndexCache.value, searchPrefixTrie.value, newEmoji)
  }

  /**
   * 使索引失效
   */
  const invalidateSearchIndex = () => {
    searchIndexValid.value = false
  }

  /**
   * 从 Trie 树搜索前缀
   */
  const searchTriePrefix = (prefix: string): Set<string> => {
    let node = searchPrefixTrie.value
    for (const char of prefix) {
      if (!node.children.has(char)) {
        return new Set()
      }
      const nextNode = node.children.get(char)
      if (!nextNode) {
        return new Set()
      }
      node = nextNode
    }
    return node.emojiIds
  }

  /**
   * 执行搜索查询
   * @returns 匹配的 emoji IDs
   */
  const search = (query: string): Set<string> | null => {
    if (!query || !searchIndexValid.value) return null

    const queryLower = query.toLowerCase().trim()

    // 1. 精确匹配
    const exactMatches = searchIndexCache.value.get(queryLower)
    if (exactMatches) {
      return exactMatches
    }

    // 2. Trie 前缀匹配
    const prefixMatches = searchTriePrefix(queryLower)
    if (prefixMatches.size > 0) {
      return prefixMatches
    }

    // 3. 子串匹配（降级）
    const partialMatches = new Set<string>()
    for (const [indexKey, emojiIds] of searchIndexCache.value) {
      if (indexKey.includes(queryLower)) {
        emojiIds.forEach(id => partialMatches.add(id))
      }
    }

    return partialMatches.size > 0 ? partialMatches : null
  }

  return {
    // State (read-only)
    searchIndexValid,

    // Actions
    buildSearchIndex,
    addEmojiToIndex,
    removeEmojiFromIndex,
    updateEmojiInIndex,
    invalidateSearchIndex,
    search
  }
})
