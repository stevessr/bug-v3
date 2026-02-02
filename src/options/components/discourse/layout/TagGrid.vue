<script setup lang="ts">
import { computed, ref } from 'vue'

import { tag_icon_list } from '../linux.do/icon.js'
import type { DiscourseTag, DiscourseTagGroup } from '../types'

const props = withDefaults(
  defineProps<{
    tags: DiscourseTag[]
    groups?: DiscourseTagGroup[]
    title?: string
  }>(),
  {
    groups: () => [],
    title: '标签'
  }
)

const emit = defineEmits<{
  (e: 'click', tag: DiscourseTag): void
}>()

const sortBy = ref<'count' | 'name'>('count')

type TagVisual = {
  icon: string
  color: string
}

const toKey = (value?: string | null) => (value || '').trim().toLocaleLowerCase()

const tagVisualMap = (() => {
  const map = new Map<string, TagVisual>()
  tag_icon_list.split('|').forEach(item => {
    const [rawName, rawIcon, rawColor] = item.split(',').map(part => (part || '').trim())
    const key = toKey(rawName)
    if (!key || !rawIcon) return
    map.set(key, {
      icon: rawIcon,
      color: rawColor || '#669d34'
    })
  })
  return map
})()

const getTagVisual = (tag: DiscourseTag) => {
  return tagVisualMap.get(toKey(tag.name)) || tagVisualMap.get(toKey(tag.text)) || null
}

const hexToRgba = (hex: string, alpha: number) => {
  const clean = hex.replace('#', '').trim()
  const normalized =
    clean.length === 3
      ? clean
          .split('')
          .map(char => char + char)
          .join('')
      : clean
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return `rgba(102,157,52,${alpha})`
  }
  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

const displayedGroups = computed(() => {
  const sourceGroups =
    props.groups.length > 0 ? props.groups : [{ id: 0, name: '全部标签', tags: props.tags }]

  return sourceGroups
    .map(group => {
      const sortedTags = [...group.tags].sort((a, b) => {
        if (sortBy.value === 'name') {
          return a.name.localeCompare(b.name, 'zh-Hans-CN')
        }
        if (b.count === a.count) {
          return a.name.localeCompare(b.name, 'zh-Hans-CN')
        }
        return b.count - a.count
      })
      return { ...group, tags: sortedTags }
    })
    .filter(group => group.tags.length > 0)
})

const getTagHoverDescription = (tag: DiscourseTag) => {
  if (!tag.description) return undefined
  return tag.description.replace(/<[^>]+>/g, '').trim() || undefined
}

const getTagLabelStyle = (tag: DiscourseTag) => {
  const visual = getTagVisual(tag)
  if (!visual) return undefined
  return {
    color: visual.color,
    borderColor: hexToRgba(visual.color, 0.35),
    backgroundColor: hexToRgba(visual.color, 0.12)
  }
}
</script>

<template>
  <div class="space-y-8">
    <div>
      <h3 class="text-2xl font-bold mb-2 dark:text-white">{{ props.title }}</h3>
      <div class="text-base text-gray-600 dark:text-gray-400">
        排序依据：
        <button
          type="button"
          class="underline font-semibold"
          :class="sortBy === 'count' ? 'text-blue-600 dark:text-blue-400' : ''"
          @click="sortBy = 'count'"
        >
          计数
        </button>
        <button
          type="button"
          class="underline font-semibold ml-2"
          :class="sortBy === 'name' ? 'text-blue-600 dark:text-blue-400' : ''"
          @click="sortBy = 'name'"
        >
          名称
        </button>
      </div>
    </div>

    <template v-if="displayedGroups.length > 0">
      <section v-for="group in displayedGroups" :key="group.id || group.name" class="pt-2">
        <h4 class="text-2xl font-bold mb-4 dark:text-white">{{ group.name }}</h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4">
          <button
            v-for="tag in group.tags"
            :key="tag.id || tag.name"
            type="button"
            class="inline-flex items-center justify-start gap-2 text-left"
            @click="emit('click', tag)"
          >
            <span
              class="inline-flex items-center max-w-[320px] truncate px-2 py-1 rounded border bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
              :style="getTagLabelStyle(tag)"
              :title="getTagHoverDescription(tag)"
            >
              <svg
                v-if="getTagVisual(tag)"
                class="w-4 h-4 mr-1.5 flex-shrink-0"
                viewBox="0 0 512 512"
                fill="currentColor"
              >
                <use :href="`#${getTagVisual(tag)?.icon}`" />
              </svg>
              {{ tag.text || tag.name }}
            </span>
            <span class="text-xl font-semibold text-gray-600 dark:text-gray-300">
              x {{ tag.count }}
            </span>
          </button>
        </div>
      </section>
    </template>
    <div v-else class="text-sm text-gray-500 dark:text-gray-400">暂无标签</div>
  </div>
</template>

<style scoped>
section {
  border-top: 1px solid rgba(148, 163, 184, 0.35);
}

.dark section {
  border-top-color: rgba(100, 116, 139, 0.45);
}
</style>
