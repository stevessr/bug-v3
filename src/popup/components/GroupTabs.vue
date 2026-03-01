<script setup lang="ts">
import { toRefs, type Ref, ref, watch } from 'vue'

import CachedImage from '@/components/CachedImage.vue'
import type { EmojiGroup } from '@/types/type'
import { isImageUrl, normalizeImageUrl } from '@/utils/isImageUrl'
import { useEmojiStore } from '@/stores/emojiStore'
import { shouldUseImageCache } from '@/utils/imageCachePolicy'

const { t } = useI18n()

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
    if (!shouldUseImageCache(emojiStore.settings)) return

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
  <div class="group-tabs-scroll" role="tablist" :aria-label="t('groupTabs')">
    <a-button
      v-for="(group, index) in groups"
      :key="group.id"
      @click="setActive(group.id)"
      @keydown="handleKeyNavigation($event, index)"
      :data-tab-index="index"
      class="group-tab-button"
      :class="{ 'group-tab-active': activeGroupId === group.id }"
      role="tab"
      :aria-selected="activeGroupId === group.id"
      :aria-controls="`panel-${group.id}`"
      :id="`tab-${group.id}`"
      tabindex="0"
    >
      <span class="group-tab-icon">
        <template v-if="isImageUrl && isImageUrl(normalizeImageUrl(group.icon))">
          <CachedImage
            :src="getGroupIconSrc(group.icon, group.id)"
            :alt="group.name ? `${group.name} ${t('groupIcon')}` : t('groupIcon')"
            class="group-tab-icon-img"
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
.group-tabs-scroll {
  display: flex;
  border-bottom: 1px solid var(--md3-outline-variant);
  overflow-x: auto;
  min-height: fit-content;
}

.group-tab-button {
  flex-shrink: 0;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-bottom: 2px solid transparent;
  transition:
    background-color 0.2s,
    border-color 0.2s,
    color 0.2s;
  background-color: transparent;
  color: var(--md3-on-surface-variant);
  outline: none;
}

.group-tab-button:hover {
  color: var(--md3-on-surface);
  background-color: var(--md3-surface-container-high);
}

.group-tab-button:focus {
  outline: 2px solid var(--md3-primary);
  outline-offset: -2px;
}

.group-tab-active {
  border-bottom-color: var(--md3-primary);
  color: var(--md3-primary);
  background-color: var(--md3-primary-container);
}

.group-tab-active:hover {
  color: var(--md3-primary);
  background-color: var(--md3-primary-container);
}

.group-tab-icon {
  margin-right: 0.25rem;
}

.group-tab-icon-img {
  width: 1rem;
  height: 1rem;
  object-fit: contain;
  display: inline-block;
}

/* Mobile responsive */
@media (min-width: 640px) {
  .group-tab-button {
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
  }

  .group-tab-icon-img {
    width: 1.25rem;
    height: 1.25rem;
  }
}

/* WebKit browsers scrollbar */
.group-tabs-scroll::-webkit-scrollbar {
  height: 10px;
}

.group-tabs-scroll::-webkit-scrollbar-track {
  background: var(--md3-surface-container);
  border-radius: 9999px;
}

.group-tabs-scroll::-webkit-scrollbar-thumb {
  background: var(--md3-primary);
  border-radius: 9999px;
}

/* Firefox */
.group-tabs-scroll {
  scrollbar-width: thin;
  scrollbar-color: var(--md3-primary) var(--md3-surface-container);
}
</style>
