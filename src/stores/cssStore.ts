/**
 * CSS Block Store
 * Handles custom CSS block management
 */

import type { Ref } from 'vue'
import { computed } from 'vue'
import type { AppSettings, CustomCssBlock } from '@/types/type'
import type { SaveControl } from './core/types'

export interface CssStoreOptions {
  settings: Ref<AppSettings>
  saveControl: SaveControl
}

export function useCssStore(options: CssStoreOptions) {
  const { settings, saveControl } = options

  // --- CSS Block Operations ---

  /**
   * Get all CSS blocks
   */
  const getCustomCssBlocks = (): CustomCssBlock[] => {
    return settings.value.customCssBlocks || []
  }

  /**
   * CSS blocks as computed property
   */
  const cssBlocks = computed(() => settings.value.customCssBlocks || [])

  /**
   * Save or update a CSS block
   */
  const saveCustomCssBlock = (block: CustomCssBlock): void => {
    const blocks = getCustomCssBlocks()
    const existingIndex = blocks.findIndex(b => b.id === block.id)

    if (existingIndex >= 0) {
      blocks[existingIndex] = { ...block, updatedAt: Date.now() }
    } else {
      blocks.push({ ...block, createdAt: Date.now(), updatedAt: Date.now() })
    }

    settings.value.customCssBlocks = [...blocks]
    console.log('[CssStore] saveCustomCssBlock', { blockId: block.id, name: block.name })
    saveControl.maybeSave()
  }

  /**
   * Delete a CSS block
   */
  const deleteCustomCssBlock = (blockId: string): void => {
    const blocks = getCustomCssBlocks()
    const filteredBlocks = blocks.filter(b => b.id !== blockId)

    if (filteredBlocks.length !== blocks.length) {
      settings.value.customCssBlocks = filteredBlocks
      console.log('[CssStore] deleteCustomCssBlock', { blockId })
      saveControl.maybeSave()
    }
  }

  /**
   * Toggle CSS block enabled status
   */
  const toggleCustomCssBlock = (blockId: string): void => {
    const blocks = getCustomCssBlocks()
    const block = blocks.find(b => b.id === blockId)

    if (block) {
      block.enabled = !block.enabled
      block.updatedAt = Date.now()
      settings.value.customCssBlocks = [...blocks]
      console.log('[CssStore] toggleCustomCssBlock', { blockId, enabled: block.enabled })
      saveControl.maybeSave()
    }
  }

  /**
   * Get combined CSS from all enabled blocks
   */
  const getCombinedCustomCss = (): string => {
    const blocks = getCustomCssBlocks()
    return blocks
      .filter(block => block.enabled)
      .map(block => block.content)
      .join('\n\n')
      .trim()
  }

  /**
   * Combined CSS as computed property
   */
  const combinedCss = computed(() => getCombinedCustomCss())

  /**
   * Migrate legacy customCss string to customCssBlocks array
   */
  const migrateLegacyCustomCss = (): void => {
    const loadedSettings = settings.value

    // If customCssBlocks already exist, skip migration
    if (loadedSettings.customCssBlocks && Array.isArray(loadedSettings.customCssBlocks)) {
      return
    }

    // If there's legacy customCss content, migrate it to a default block
    if (
      loadedSettings.customCss &&
      typeof loadedSettings.customCss === 'string' &&
      loadedSettings.customCss.trim()
    ) {
      const legacyBlock: CustomCssBlock = {
        id: 'legacy-migrated-css',
        name: '迁移的 CSS',
        content: loadedSettings.customCss,
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      settings.value.customCssBlocks = [legacyBlock]
      settings.value.customCss = '' // Clear the legacy field

      console.log('[CssStore] Migrated legacy customCss to customCssBlocks')
      saveControl.maybeSave()
    }
  }

  /**
   * Create a new CSS block
   */
  const createCssBlock = (name: string, content: string = '', enabled: boolean = true): CustomCssBlock => {
    const block: CustomCssBlock = {
      id: `css-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      content,
      enabled,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    saveCustomCssBlock(block)
    return block
  }

  /**
   * Update CSS block content
   */
  const updateCssBlockContent = (blockId: string, content: string): void => {
    const blocks = getCustomCssBlocks()
    const block = blocks.find(b => b.id === blockId)

    if (block) {
      block.content = content
      block.updatedAt = Date.now()
      settings.value.customCssBlocks = [...blocks]
      console.log('[CssStore] updateCssBlockContent', { blockId })
      saveControl.maybeSave()
    }
  }

  /**
   * Get enabled blocks count
   */
  const enabledBlocksCount = computed(() => {
    return getCustomCssBlocks().filter(b => b.enabled).length
  })

  return {
    // Getters
    getCustomCssBlocks,
    getCombinedCustomCss,

    // Computed
    cssBlocks,
    combinedCss,
    enabledBlocksCount,

    // Operations
    saveCustomCssBlock,
    deleteCustomCssBlock,
    toggleCustomCssBlock,
    createCssBlock,
    updateCssBlockContent,

    // Migration
    migrateLegacyCustomCss
  }
}

export type CssStore = ReturnType<typeof useCssStore>
