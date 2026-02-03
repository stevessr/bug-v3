import { defineComponent, computed, ref } from 'vue'

import type { DiscourseTag, DiscourseTagGroup } from '../types'
import { stripHtml } from '../tagVisuals'

import TagPill from './TagPill'

export default defineComponent({
  name: 'TagGrid',
  props: {
    tags: { type: Array as () => DiscourseTag[], required: true },
    groups: { type: Array as () => DiscourseTagGroup[], default: () => [] },
    title: { type: String, default: '标签' }
  },
  emits: ['click'],
  setup(props, { emit }) {
    const sortBy = ref<'count' | 'name'>('count')

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
      const value = stripHtml(tag.description)
      return value || undefined
    }

    return () => (
      <div class="space-y-8">
        <div>
          <h3 class="text-2xl font-bold mb-2 dark:text-white">{props.title}</h3>
          <div class="text-base text-gray-600 dark:text-gray-400">
            排序依据：
            <button
              type="button"
              class={[
                'underline font-semibold',
                sortBy.value === 'count' ? 'text-blue-600 dark:text-blue-400' : ''
              ]}
              onClick={() => (sortBy.value = 'count')}
            >
              计数
            </button>
            <button
              type="button"
              class={[
                'underline font-semibold ml-2',
                sortBy.value === 'name' ? 'text-blue-600 dark:text-blue-400' : ''
              ]}
              onClick={() => (sortBy.value = 'name')}
            >
              名称
            </button>
          </div>
        </div>

        {displayedGroups.value.length > 0 ? (
          displayedGroups.value.map(group => (
            <section
              key={group.id || group.name}
              class="pt-2 border-t border-gray-300 dark:border-gray-600"
            >
              <h4 class="text-2xl font-bold mb-4 dark:text-white">{group.name}</h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4">
                {group.tags.map(tag => (
                  <button
                    key={tag.id || tag.name}
                    type="button"
                    class="inline-flex items-center justify-start gap-2 text-left"
                    onClick={() => emit('click', tag)}
                  >
                    <TagPill
                      name={tag.name}
                      text={tag.text}
                      description={getTagHoverDescription(tag)}
                      clickable
                    />
                    <span class="text-xl font-semibold text-gray-600 dark:text-gray-300">
                      x {tag.count}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))
        ) : (
          <div class="text-sm text-gray-500 dark:text-gray-400">暂无标签</div>
        )}
      </div>
    )
  }
})
