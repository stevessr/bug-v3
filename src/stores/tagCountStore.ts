import { defineStore } from 'pinia'
import { ref, computed, toRaw } from 'vue'

import type { EmojiGroup } from '@/types/type'

/**
 * 标签计数 Store
 * 负责管理标签统计和过滤功能
 */
export const useTagCountStore = defineStore('tagCount', () => {
  // --- State ---
  const tagCountMap = ref<Map<string, number>>(new Map())
  const tagCacheValid = ref(false)
  const tagMapVersion = ref(0) // 用于触发 computed 重新计算

  // --- Computed ---

  /**
   * 所有标签及其计数（按计数排序）
   */
  const allTags = computed(() => {
    // 依赖版本号以确保响应式更新
    void tagMapVersion.value

    if (!tagCacheValid.value) {
      // 延迟到下一个微任务执行重建，避免在 computed 中修改状态
      queueMicrotask(() => {
        if (!tagCacheValid.value) {
          console.warn('[TagCountStore] Tag cache invalid, please rebuild')
        }
      })
      return []
    }

    return Array.from(tagCountMap.value.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  })

  // --- Actions ---

  /**
   * 重建标签计数（完整重建）
   */
  const rebuildTagCounts = (groups: EmojiGroup[]) => {
    const newMap = new Map<string, number>()

    // 优化：使用 toRaw 避免响应式代理开销
    const rawGroups = toRaw(groups)
    for (const group of rawGroups) {
      const emojis = group.emojis || []
      for (let i = 0; i < emojis.length; i++) {
        const emoji = emojis[i]
        if (emoji && emoji.tags) {
          const tags = emoji.tags
          for (let j = 0; j < tags.length; j++) {
            const tag = tags[j]
            newMap.set(tag, (newMap.get(tag) || 0) + 1)
          }
        }
      }
    }

    tagCountMap.value = newMap
    tagCacheValid.value = true
    tagMapVersion.value++
  }

  /**
   * 增量更新：添加标签
   */
  const incrementTagCounts = (tags: string[] | undefined) => {
    if (!tags || tags.length === 0) return

    // 如果缓存无效，需要完全重建（由调用者处理）
    if (!tagCacheValid.value) {
      console.warn('[TagCountStore] Cache invalid, increment skipped')
      return
    }

    const map = tagCountMap.value
    for (const tag of tags) {
      map.set(tag, (map.get(tag) || 0) + 1)
    }
    tagMapVersion.value++
  }

  /**
   * 增量更新：移除标签
   */
  const decrementTagCounts = (tags: string[] | undefined) => {
    if (!tags || tags.length === 0) return

    // 如果缓存无效，需要完全重建（由调用者处理）
    if (!tagCacheValid.value) {
      console.warn('[TagCountStore] Cache invalid, decrement skipped')
      return
    }

    const map = tagCountMap.value
    for (const tag of tags) {
      const count = map.get(tag) || 0
      if (count <= 1) {
        map.delete(tag)
      } else {
        map.set(tag, count - 1)
      }
    }
    tagMapVersion.value++
  }

  /**
   * 使缓存失效
   */
  const invalidateTagCache = () => {
    tagCacheValid.value = false
  }

  /**
   * 获取指定标签的计数
   */
  const getTagCount = (tag: string): number => {
    return tagCountMap.value.get(tag) || 0
  }

  return {
    // State (read-only)
    tagCacheValid,

    // Computed
    allTags,

    // Actions
    rebuildTagCounts,
    incrementTagCounts,
    decrementTagCounts,
    invalidateTagCache,
    getTagCount
  }
})
