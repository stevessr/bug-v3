import { ref, computed, type Ref, type ComputedRef } from 'vue'

import type { FileItem } from './useFilePersistence'

import type { EmojiGroup } from '@/types/type'
import type { useEmojiStore } from '@/stores/emojiStore'
import { buildMarkdownImage } from '@/utils/emojiMarkdown'

/**
 * 缓冲区批量操作 Composable
 * 负责管理批量选择、移动、复制和筛选功能
 */

interface FilterGroup {
  id: string
  name: string
  icon: string
  emojiNames: Set<string>
}

interface UseBufferBatchOptions {
  bufferGroup: ComputedRef<EmojiGroup | undefined>
  emojiStore: ReturnType<typeof useEmojiStore>
  selectedFiles: Ref<FileItem[]>
}

export function useBufferBatch(options: UseBufferBatchOptions) {
  const { bufferGroup, emojiStore, selectedFiles } = options

  // --- 状态 ---
  const isMultiSelectMode = ref(false)
  const selectedEmojis = ref(new Set<number>())
  const targetGroupId = ref('')
  const showCreateGroupDialog = ref(false)

  // 筛选相关
  const enableFilter = ref(false)
  const selectedFilterGroups = ref<FilterGroup[]>([])
  const isCheckingDuplicates = ref(false)
  const selectedGroupIdForFilter = ref('')
  const showGroupSelector = ref(false)

  // --- 计算属性 ---
  const totalCount = computed(() => bufferGroup.value?.emojis?.length || 0)
  const checkedCount = computed(() => selectedEmojis.value.size)

  const checkAll = computed<boolean>({
    get: () => {
      return totalCount.value > 0 && checkedCount.value === totalCount.value
    },
    set: (value: boolean) => {
      if (value && bufferGroup.value) {
        selectedEmojis.value = new Set(bufferGroup.value.emojis.map((_, i) => i))
      } else {
        clearSelection()
      }
    }
  })

  const indeterminate = computed(
    () => checkedCount.value > 0 && checkedCount.value < totalCount.value
  )

  const availableGroups = computed(() =>
    emojiStore.groups.filter(g => g.id !== 'buffer' && g.id !== 'favorites')
  )

  const filterableGroups = computed(() => {
    const alreadySelected = new Set(selectedFilterGroups.value.map(fg => fg.id))
    return emojiStore.groups.filter(
      g => g.id !== 'buffer' && g.id !== 'favorites' && !alreadySelected.has(g.id)
    )
  })

  // --- 方法 ---

  const toggleEmojiSelection = (idx: number) => {
    if (selectedEmojis.value.has(idx)) {
      selectedEmojis.value.delete(idx)
    } else {
      selectedEmojis.value.add(idx)
    }
    selectedEmojis.value = new Set(selectedEmojis.value)
  }

  const handleEmojiClick = (idx: number) => {
    if (isMultiSelectMode.value) toggleEmojiSelection(idx)
  }

  const clearSelection = () => {
    selectedEmojis.value.clear()
    selectedEmojis.value = new Set()
    targetGroupId.value = ''
  }

  const onCheckAllChange = (e: any) => {
    const checked = !!(e && e.target && e.target.checked)
    checkAll.value = checked
  }

  const onMultiSelectModeChange = () => {
    if (!isMultiSelectMode.value) {
      clearSelection()
    }
  }

  /**
   * 移动选中的表情到目标分组
   */
  const moveSelectedEmojis = async () => {
    if (!targetGroupId.value || selectedEmojis.value.size === 0) return

    try {
      // 如果选择创建新分组
      if (targetGroupId.value === '__create_new__') {
        showCreateGroupDialog.value = true
        return
      }

      const targetGroup = emojiStore.groups.find(g => g.id === targetGroupId.value)
      if (!targetGroup) return

      // 获取选中的表情索引（按降序排列，避免删除时索引变化）
      const sortedIndices = Array.from(selectedEmojis.value).sort((a, b) => b - a)

      // 开始批量操作
      emojiStore.beginBatch()

      try {
        // 逐个移动表情
        for (const index of sortedIndices) {
          if (bufferGroup.value && index < bufferGroup.value.emojis.length) {
            emojiStore.moveEmoji('buffer', index, targetGroupId.value, -1)
          }
        }
      } finally {
        // 结束批量操作，触发保存
        await emojiStore.endBatch()
      }

      // 清空选择
      clearSelection()
    } catch {
      // ignore errors during move
    }
  }

  /**
   * 复制选中的表情为 markdown 格式
   */
  const copySelectedAsMarkdown = async () => {
    if (selectedEmojis.value.size === 0 || !bufferGroup.value) return

    const lines = Array.from(selectedEmojis.value)
      .map(idx => {
        const e = bufferGroup.value?.emojis[idx]
        if (!e?.url && !e?.short_url) return null
        const alt = e.width && e.height ? `${e.name}|${e.height}x${e.width}` : e.name || 'image'
        return buildMarkdownImage(alt, e)
      })
      .filter((v): v is string => !!v)

    if (lines.length === 0) return

    const markdown = '>[!summary]-\n>[grid mode=carousel]\n>' + lines.join('\n>') + '\n>[/grid]'

    try {
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(markdown)
      } else {
        // fallback
        const ta = document.createElement('textarea')
        ta.value = markdown
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        const success = document.execCommand('copy')
        document.body.removeChild(ta)
        if (!success) {
          throw new Error('execCommand copy failed')
        }
      }
      message.success('Markdown 已复制到剪贴板')
    } catch (err) {
      console.error('Failed to copy markdown to clipboard', err)
      message.error('复制到剪贴板失败')
    }
  }

  /**
   * 处理创建新分组并移动
   */
  const handleCreateGroup = async (data: { name: string; icon: string; detail: string }) => {
    try {
      // 创建新分组
      const newGroup = emojiStore.createGroup(data.name, data.icon)

      // 如果有详细信息，保存到分组
      if (data.detail) {
        emojiStore.updateGroup(newGroup.id, { detail: data.detail })
      }

      // 设置目标分组 ID
      targetGroupId.value = newGroup.id

      // 立即执行移动操作
      await moveSelectedEmojis()
    } catch {
      // ignore errors during group creation
    }
  }

  /**
   * 添加分组到过滤器
   */
  const addGroupToFilter = () => {
    if (!selectedGroupIdForFilter.value) return

    const group = emojiStore.groups.find(g => g.id === selectedGroupIdForFilter.value)
    if (!group) return

    // 创建表情名称集合
    const emojiNames = new Set<string>()
    for (const emoji of group.emojis) {
      emojiNames.add(emoji.name)
    }

    selectedFilterGroups.value.push({
      id: group.id,
      name: group.name,
      icon: group.icon || '📁',
      emojiNames
    })

    selectedGroupIdForFilter.value = ''
    showGroupSelector.value = false

    console.log(
      `[useBufferBatch] Added group "${group.name}" to filter with ${emojiNames.size} emojis`
    )
  }

  /**
   * 从过滤器中移除分组
   */
  const removeGroupFromFilter = (groupId: string) => {
    const index = selectedFilterGroups.value.findIndex(fg => fg.id === groupId)
    if (index > -1) {
      const removedGroup = selectedFilterGroups.value[index]
      selectedFilterGroups.value.splice(index, 1)
      console.log(`[useBufferBatch] Removed group "${removedGroup.name}" from filter`)
    }
  }

  /**
   * 过滤重复文件
   */
  const filterDuplicateFiles = async () => {
    if (
      !enableFilter.value ||
      selectedFilterGroups.value.length === 0 ||
      selectedFiles.value.length === 0
    ) {
      return
    }

    isCheckingDuplicates.value = true

    try {
      // 收集所有过滤器分组中的表情名称
      const filterEmojiNames = new Set<string>()
      for (const filterGroup of selectedFilterGroups.value) {
        for (const name of filterGroup.emojiNames) {
          // 小写化并去除扩展名
          const baseName = name.toLowerCase().replace(/\.(png|jpg|jpeg|gif|webp|svg)$/i, '')
          filterEmojiNames.add(baseName)
        }
      }

      // 过滤文件
      const originalCount = selectedFiles.value.length
      selectedFiles.value = selectedFiles.value.filter(item => {
        const baseName = item.file.name.toLowerCase().replace(/\.(png|jpg|jpeg|gif|webp|svg)$/i, '')
        return !filterEmojiNames.has(baseName)
      })

      const removedCount = originalCount - selectedFiles.value.length
      if (removedCount > 0) {
        message.success(`已过滤 ${removedCount} 个重复文件`)
      } else {
        message.info('未发现重复文件')
      }
    } finally {
      isCheckingDuplicates.value = false
    }
  }

  return {
    // State
    isMultiSelectMode,
    selectedEmojis,
    targetGroupId,
    showCreateGroupDialog,
    enableFilter,
    selectedFilterGroups,
    isCheckingDuplicates,
    selectedGroupIdForFilter,
    showGroupSelector,

    // Computed
    totalCount,
    checkedCount,
    checkAll,
    indeterminate,
    availableGroups,
    filterableGroups,

    // Methods
    toggleEmojiSelection,
    handleEmojiClick,
    clearSelection,
    onCheckAllChange,
    onMultiSelectModeChange,
    moveSelectedEmojis,
    copySelectedAsMarkdown,
    handleCreateGroup,
    addGroupToFilter,
    removeGroupFromFilter,
    filterDuplicateFiles
  }
}
