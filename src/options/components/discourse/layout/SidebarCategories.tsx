import { defineComponent, computed } from 'vue'

import type { DiscourseCategory } from '../types'

export default defineComponent({
  name: 'SidebarCategories',
  props: {
    categories: { type: Array as () => DiscourseCategory[], required: true },
    baseUrl: { type: String, required: true }
  },
  emits: ['select'],
  setup(props, { emit }) {
    const hasHierarchy = computed(() => {
      const hasChildren = props.categories.some(
        cat => cat.parent_category_id || (cat.subcategory_ids?.length || 0) > 0
      )
      const hasParents = props.categories.some(cat => !cat.parent_category_id)
      return hasChildren && hasParents
    })

    const topCategories = computed(() =>
      hasHierarchy.value
        ? props.categories.filter(cat => !cat.parent_category_id)
        : props.categories
    )

    const childrenByParent = computed(() => {
      const map = new Map<number, DiscourseCategory[]>()
      const byId = new Map<number, DiscourseCategory>()
      props.categories.forEach(cat => {
        byId.set(cat.id, cat)
      })

      const pushChild = (parentId: number, child: DiscourseCategory) => {
        const list = map.get(parentId) || []
        if (!list.some(item => item.id === child.id)) {
          list.push(child)
          map.set(parentId, list)
        }
      }

      props.categories.forEach(cat => {
        if (cat.parent_category_id) {
          pushChild(cat.parent_category_id, cat)
        }
      })

      props.categories.forEach(cat => {
        if (!cat.subcategory_ids?.length) return
        cat.subcategory_ids.forEach(id => {
          const child = byId.get(id)
          if (child) {
            pushChild(cat.id, child)
          }
        })
      })

      return map
    })

    const getImageUrl = (url?: string | null) => {
      if (!url) return ''
      return url.startsWith('http') ? url : `${props.baseUrl}${url}`
    }

    const getIconHref = (icon?: string | null) => {
      if (!icon) return ''
      return `#${icon}`
    }

    return () => (
      <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700">
        <h3 class="text-sm font-semibold mb-3 dark:text-white">分类</h3>
        <div class="space-y-1">
          {topCategories.value.map(cat => (
            <div key={cat.id}>
              <div
                class="flex items-center gap-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                onClick={() => emit('select', cat)}
              >
                <div class="sidebar-icon">
                  {cat.uploaded_logo?.url ? (
                    <img
                      src={getImageUrl(cat.uploaded_logo.url)}
                      alt={cat.name}
                      class="sidebar-icon-img"
                    />
                  ) : cat.uploaded_logo_dark?.url ? (
                    <img
                      src={getImageUrl(cat.uploaded_logo_dark.url)}
                      alt={cat.name}
                      class="sidebar-icon-img"
                    />
                  ) : cat.emoji ? (
                    <span class="sidebar-emoji">{cat.emoji}</span>
                  ) : cat.icon ? (
                    <svg class="sidebar-icon-svg" viewBox="0 0 24 24">
                      <use href={getIconHref(cat.icon)} />
                    </svg>
                  ) : (
                    <span class="sidebar-icon-dot" style={{ backgroundColor: `#${cat.color}` }} />
                  )}
                </div>
                <span class="text-sm dark:text-gray-300 truncate flex-1">{cat.name}</span>
                <span class="text-xs text-gray-400">{cat.topic_count}</span>
              </div>
              {hasHierarchy.value && (childrenByParent.value.get(cat.id)?.length || 0) > 0 && (
                <div class="ml-4 space-y-1">
                  {childrenByParent.value
                    .get(cat.id)
                    ?.slice(0, 6)
                    .map(child => (
                      <div
                        key={child.id}
                        class="flex items-center gap-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                        onClick={() => emit('select', child)}
                      >
                        <span class="sidebar-icon">
                          {child.uploaded_logo?.url ? (
                            <img
                              src={getImageUrl(child.uploaded_logo.url)}
                              alt={child.name}
                              class="sidebar-icon-img"
                            />
                          ) : child.uploaded_logo_dark?.url ? (
                            <img
                              src={getImageUrl(child.uploaded_logo_dark.url)}
                              alt={child.name}
                              class="sidebar-icon-img"
                            />
                          ) : child.emoji ? (
                            <span class="sidebar-emoji">{child.emoji}</span>
                          ) : child.icon ? (
                            <svg class="sidebar-icon-svg" viewBox="0 0 24 24">
                              <use href={getIconHref(child.icon)} />
                            </svg>
                          ) : (
                            <span
                              class="sidebar-icon-dot"
                              style={{ backgroundColor: `#${child.color}` }}
                            />
                          )}
                        </span>
                        <span class="text-xs dark:text-gray-300 truncate flex-1">{child.name}</span>
                      </div>
                    ))}
                  {(childrenByParent.value.get(cat.id)?.length || 0) > 6 && (
                    <div class="text-xs text-gray-400 ml-1">
                      还有 {(childrenByParent.value.get(cat.id)?.length || 0) - 6} 个子分类...
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }
})
