/**
 * Group Management Store
 * Handles CRUD operations for emoji groups
 */

import { computed } from 'vue'
import type { Ref } from 'vue'

import type { SaveControl } from './core/types'

import type { EmojiGroup } from '@/types/type'

export interface GroupStoreOptions {
  groups: Ref<EmojiGroup[]>
  activeGroupId: Ref<string>
  saveControl: SaveControl
}

export function useGroupStore(options: GroupStoreOptions) {
  const { groups, activeGroupId, saveControl } = options

  // --- Computed ---
  const activeGroup = computed(
    () => groups.value.find(g => g.id === activeGroupId.value) || groups.value[0]
  )

  const sortedGroups = computed(() => {
    return [...groups.value].sort((a, b) => a.order - b.order)
  })

  // --- Actions ---

  /**
   * Create a new group and save
   * @param name - Group name
   * @param icon - Group icon
   * @param customId - Optional custom ID (defaults to generated timestamp-based ID)
   */
  const createGroup = (name: string, icon: string, customId?: string): EmojiGroup => {
    const newGroup: EmojiGroup = {
      id: customId || `group-${Date.now()}`,
      name,
      icon,
      order: groups.value.length,
      emojis: []
    }
    groups.value.push(newGroup)
    console.log('[GroupStore] createGroup', { id: newGroup.id, name: newGroup.name })
    // Mark the new group as dirty for incremental save
    saveControl.markGroupDirty?.(newGroup.id)
    saveControl.maybeSave()
    return newGroup
  }

  /**
   * Create a new group without triggering save (for batch operations)
   * @param name - Group name
   * @param icon - Group icon
   * @param customId - Optional custom ID (defaults to generated timestamp-based ID)
   */
  const createGroupWithoutSave = (name: string, icon: string, customId?: string): EmojiGroup => {
    const newGroup: EmojiGroup = {
      id: customId || `group-${Date.now()}`,
      name,
      icon,
      order: groups.value.length,
      emojis: []
    }
    groups.value.push(newGroup)
    console.log('[GroupStore] createGroupWithoutSave', { id: newGroup.id, name: newGroup.name })
    // Mark the new group as dirty for incremental save (will be saved when batch ends)
    saveControl.markGroupDirty?.(newGroup.id)
    return newGroup
  }

  /**
   * Update an existing group
   */
  const updateGroup = (groupId: string, updates: Partial<EmojiGroup>): void => {
    const index = groups.value.findIndex(g => g.id === groupId)
    if (index !== -1) {
      groups.value[index] = { ...groups.value[index], ...updates }
      console.log('[GroupStore] updateGroup', { id: groupId, updates })
      // Mark the group as dirty for incremental save
      saveControl.markGroupDirty?.(groupId)
      saveControl.maybeSave()
    }
  }

  /**
   * Delete a group
   */
  const deleteGroup = (groupId: string): void => {
    if (groupId === 'favorites') {
      console.warn('[GroupStore] Cannot delete system groups')
      return
    }

    // Mark the group as deleted for incremental save (will be deleted from storage)
    saveControl.markGroupDeleted?.(groupId)

    groups.value = groups.value.filter(g => g.id !== groupId)
    console.log('[GroupStore] deleteGroup', { id: groupId })

    if (activeGroupId.value === groupId) {
      activeGroupId.value = groups.value[0]?.id || 'nachoneko'
    }
    saveControl.maybeSave()
  }

  /**
   * Reorder groups by moving source to target position
   */
  const reorderGroups = async (sourceGroupId: string, targetGroupId: string): Promise<void> => {
    // Prevent reordering if either source or target is favorites
    if (sourceGroupId === 'favorites' || targetGroupId === 'favorites') {
      console.warn('[GroupStore] Cannot reorder favorites group')
      return
    }

    const sourceIndex = groups.value.findIndex(g => g.id === sourceGroupId)
    const targetIndex = groups.value.findIndex(g => g.id === targetGroupId)

    if (sourceIndex !== -1 && targetIndex !== -1) {
      const [removed] = groups.value.splice(sourceIndex, 1)
      groups.value.splice(targetIndex, 0, removed)
      groups.value.forEach((group, index) => {
        group.order = index
        // Mark all reordered groups as dirty (order changed)
        saveControl.markGroupDirty?.(group.id)
      })
      console.log('[GroupStore] reorderGroups', { from: sourceGroupId, to: targetGroupId })
      await saveControl.saveData()
    }
  }

  /**
   * Find a group by ID
   */
  const findGroup = (groupId: string): EmojiGroup | undefined => {
    return groups.value.find(g => g.id === groupId)
  }

  /**
   * Check if a group exists
   */
  const hasGroup = (groupId: string): boolean => {
    return groups.value.some(g => g.id === groupId)
  }

  /**
   * Get group count
   */
  const groupCount = computed(() => groups.value.length)

  return {
    // Computed
    activeGroup,
    sortedGroups,
    groupCount,

    // Actions
    createGroup,
    createGroupWithoutSave,
    updateGroup,
    deleteGroup,
    reorderGroups,
    findGroup,
    hasGroup
  }
}

export type GroupStore = ReturnType<typeof useGroupStore>
