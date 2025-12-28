<script setup lang="ts">
import { toRefs, type Ref, ref, watch } from 'vue'

import type { EmojiGroup } from '@/types/type'
import { isImageUrl, normalizeImageUrl } from '@/utils/isImageUrl'
import { useEmojiStore } from '@/stores/emojiStore'

const props = defineProps<{
  groups: EmojiGroup[]
  activeGroupId: string | null
  setActive: (_id: string) => void
}>()

// Preserve reactivity for primitive props (like activeGroupId) by using toRefs
const { groups, activeGroupId, setActive } = toRefs(props) as {
  groups: Ref<EmojiGroup[]>
  activeGroupId: Ref<string | null>
  setActive: Ref<(id: string) => void>
}

const emojiStore = useEmojiStore()

// 分组图标缓存
const groupIconSources = ref<Map<string, string>>(new Map())

// 获取分组图标 URL（优先使用缓存）
const getGroupIconSrc = (icon: string, groupId: string): string => {
  const normalizedIcon = normalizeImageUrl(icon)
  return groupIconSources.value.get(groupId) || normalizedIcon
}

// 异步加载分组图标缓存
watch(
  () => props.groups,
  async groupList => {
    if (!emojiStore.settings.useIndexedDBForImages) return

    const { getCachedImage } = await import('@/utils/imageCache')
    const newMap = new Map<string, string>()

    for (const group of groupList) {
      const normalizedIcon = normalizeImageUrl(group.icon)
      if (normalizedIcon && isImageUrl(normalizedIcon)) {
        try {
          const cachedUrl = await getCachedImage(normalizedIcon)
          if (cachedUrl) {
            newMap.set(group.id, cachedUrl)
          }
        } catch {
          // 缓存获取失败，使用原始 URL
        }
      }
    }

    groupIconSources.value = newMap
  },
  { immediate: true }
)

// 键盘导航功能
const handleKeyNavigation = (event: KeyboardEvent, index: number) => {
  switch (event.key) {
    case 'Enter':
    case ' ':
      event.preventDefault()
      setActive.value(props.groups[index].id)
      break
    case 'ArrowRight':
      event.preventDefault()
      focusAdjacentTab(index, 1)
      break
    case 'ArrowLeft':
      event.preventDefault()
      focusAdjacentTab(index, -1)
      break
    case 'Home':
      event.preventDefault()
      focusFirstTab()
      break
    case 'End':
      event.preventDefault()
      focusLastTab()
      break
  }
}

const focusAdjacentTab = (currentIndex: number, offset: number) => {
  const newIndex = currentIndex + offset
  if (newIndex >= 0 && newIndex < props.groups.length) {
    const nextButton = document.querySelector(
      `.group-tab-button[data-tab-index="${newIndex}"]`
    ) as HTMLElement
    if (nextButton) {
      nextButton.focus()
    }
  }
}

const focusFirstTab = () => {
  const firstButton = document.querySelector('.group-tab-button[data-tab-index="0"]') as HTMLElement
  if (firstButton) {
    firstButton.focus()
  }
}

const focusLastTab = () => {
  const lastIndex = props.groups.length - 1
  const lastButton = document.querySelector(
    `.group-tab-button[data-tab-index="${lastIndex}"]`
  ) as HTMLElement
  if (lastButton) {
    lastButton.focus()
  }
}

// isImageUrl is imported and usable directly in the template
</script>

<template>
  <div
    class="group-tabs-scroll flex border-b border-gray-100 dark:border-gray-700 overflow-x-auto"
    role="tablist"
    aria-label="表情分组标签"
  >
    <a-button
      v-for="(group, index) in groups"
      :key="group.id"
      @click="setActive(group.id)"
      @keydown="handleKeyNavigation($event, index)"
      :data-tab-index="index"
      class="group-tab-button flex-shrink-0 px-3 py-2 mobile:px-4 mobile:py-3 text-xs mobile:text-sm font-medium border-b-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
      :class="[
        activeGroupId === group.id
          ? 'border-blue-500 text-blue-600 bg-blue-50 dark:border-blue-500 dark:text-white dark:bg-gray-700'
          : 'border-transparent bg-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-white dark:hover:text-white dark:hover:border-gray-600'
      ]"
      role="tab"
      :aria-selected="activeGroupId === group.id"
      :aria-controls="`panel-${group.id}`"
      :id="`tab-${group.id}`"
      tabindex="0"
    >
      <span class="mr-1">
        <template v-if="isImageUrl && isImageUrl(normalizeImageUrl(group.icon))">
          <img
            :src="getGroupIconSrc(group.icon, group.id)"
            :alt="group.name ? `${group.name} 图标` : '分组图标'"
            class="w-4 h-4 mobile:w-5 mobile:h-5 object-contain inline-block"
          />
        </template>
        <template v-else>
          {{ group.icon }}
        </template>
      </span>
      {{ group.name }}
    </a-button>
  </div>
</template>

<style scoped>
/* WebKit browsers */
.group-tabs-scroll::-webkit-scrollbar {
  height: 10px;
}
.group-tabs-scroll::-webkit-scrollbar-track {
  background: #f3f4f6; /* tailwind gray-100 */
  border-radius: 9999px;
}
.group-tabs-scroll::-webkit-scrollbar-thumb {
  background: #3b82f6; /* tailwind blue-500 */
  border-radius: 9999px;
}

/* Dark mode overrides using parent .dark class */
:global(.dark) .group-tabs-scroll::-webkit-scrollbar-track {
  background: #1f2937; /* tailwind gray-800 */
}
:global(.dark) .group-tabs-scroll::-webkit-scrollbar-thumb {
  background: #9ca3af; /* tailwind gray-400 (light thumb on dark bg) */
}

/* Firefox */
.group-tabs-scroll {
  scrollbar-width: thin;
  scrollbar-color: #3b82f6 #f3f4f6;
  min-height: fit-content;
}
:global(.dark) .group-tabs-scroll {
  scrollbar-color: #9ca3af #1f2937;
}
</style>
