import { defineComponent, computed, ref } from 'vue'

import type { DiscourseTag, DiscourseTagGroup } from '../types'
import { stripHtml } from '../tagVisuals'

import TagPill from './TagPill'
import '../css/TagGrid.css'

export default defineComponent({
  name: 'TagGrid',
  props: {
    tags: { type: Array as () => DiscourseTag[], required: true },
    groups: { type: Array as () => DiscourseTagGroup[], default: () => [] },
    title: { type: String, default: '标签' },
    baseUrl: { type: String, default: '' }
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
      <section class="tag-grid" aria-label={props.title || '标签'}>
        <header class="tag-grid__toolbar">
          {props.title && <h3 class="tag-grid__title">{props.title}</h3>}
          <div class="tag-grid__sort" role="group" aria-label="标签排序方式">
            <span class="tag-grid__sort-label">排序依据</span>
            <button
              type="button"
              class={['tag-grid__sort-button', { active: sortBy.value === 'count' }]}
              aria-pressed={sortBy.value === 'count'}
              onClick={() => (sortBy.value = 'count')}
            >
              计数
            </button>
            <button
              type="button"
              class={['tag-grid__sort-button', { active: sortBy.value === 'name' }]}
              aria-pressed={sortBy.value === 'name'}
              onClick={() => (sortBy.value = 'name')}
            >
              名称
            </button>
          </div>
        </header>

        {displayedGroups.value.length > 0 ? (
          displayedGroups.value.map(group => (
            <section key={group.id || group.name} class="tag-group">
              <header class="tag-group__header">
                <h4 class="tag-group__title">{group.name}</h4>
                <span class="tag-group__count">{group.tags.length} 个标签</span>
              </header>
              <div class="tag-group__items">
                {group.tags.map(tag => (
                  <button
                    key={tag.id || tag.name}
                    type="button"
                    class="tag-group__item"
                    data-discourse-url={`${props.baseUrl}/tag/${encodeURIComponent(tag.name)}`}
                    aria-label={`${tag.text || tag.name}，${tag.count} 个话题`}
                    onClick={() => emit('click', tag)}
                  >
                    <TagPill
                      name={tag.name}
                      text={tag.text}
                      description={getTagHoverDescription(tag)}
                      clickable
                    />
                    <span class="tag-group__item-count" aria-hidden="true">
                      {tag.count}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))
        ) : (
          <div class="tag-grid__empty" role="status">
            暂无标签
          </div>
        )}
      </section>
    )
  }
})
