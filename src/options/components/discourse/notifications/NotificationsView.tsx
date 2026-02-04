import { defineComponent, computed } from 'vue'
import { Button, Spin } from 'ant-design-vue'

import type { DiscourseNotification, DiscourseNotificationFilter } from '../types'

export default defineComponent({
  name: 'NotificationsView',
  props: {
    notifications: { type: Array as () => DiscourseNotification[], required: true },
    filter: { type: String as () => DiscourseNotificationFilter, required: true },
    loading: { type: Boolean, default: false }
  },
  emits: ['changeFilter', 'open'],
  setup(props, { emit }) {
    const baseFilters: Array<{ key: DiscourseNotificationFilter; label: string }> = [
      { key: 'all', label: '全部' },
      { key: 'unread', label: '未读' },
      { key: 'replies', label: '回复' },
      { key: 'mentions', label: '提及' },
      { key: 'likes', label: '点赞' },
      { key: 'messages', label: '私信' },
      { key: 'badges', label: '徽章' },
      { key: 'other', label: '其他' }
    ]

    const typeLabelMap: Record<number, DiscourseNotificationFilter> = {
      1: 'mentions',
      2: 'replies',
      3: 'mentions',
      5: 'mentions',
      6: 'likes',
      7: 'likes',
      8: 'likes',
      9: 'messages',
      12: 'badges'
    }

    const formatFilter = (n: DiscourseNotification) => {
      return typeLabelMap[n.notification_type] || 'other'
    }

    const getCategoryMeta = (n: DiscourseNotification) => {
      const data = n.data || {}
      const id =
        data.category_id ?? data.categoryId ?? data.category?.id ?? data.category_id?.id ?? null
      const name =
        data.category_name ??
        data.categoryName ??
        data.category?.name ??
        data.category_slug ??
        data.category?.slug ??
        ''
      return {
        id: typeof id === 'number' ? id : Number(id) || null,
        name: String(name || '')
      }
    }

    const categoryFilters = computed(() => {
      const map = new Map<string, string>()
      props.notifications.forEach(item => {
        const meta = getCategoryMeta(item)
        if (meta.id) {
          map.set(`category:${meta.id}`, meta.name || `分类 ${meta.id}`)
          return
        }
        if (meta.name) {
          map.set(`category:${meta.name}`, meta.name)
        }
      })
      return Array.from(map.entries()).map(([key, label]) => ({
        key: key as DiscourseNotificationFilter,
        label
      }))
    })

    const filters = computed(() => [...baseFilters, ...categoryFilters.value])

    const filteredNotifications = computed(() => {
      if (props.filter === 'all') return props.notifications
      if (props.filter === 'unread') return props.notifications.filter(item => !item.read)
      if (String(props.filter).startsWith('category:')) {
        const rawKey = String(props.filter).slice('category:'.length)
        return props.notifications.filter(item => {
          const meta = getCategoryMeta(item)
          if (meta.id && String(meta.id) === rawKey) return true
          if (meta.name && meta.name === rawKey) return true
          return false
        })
      }
      return props.notifications.filter(n => formatFilter(n) === props.filter)
    })

    const formatTitle = (n: DiscourseNotification) => {
      return n.fancy_title || n.data?.topic_title || n.data?.title || '通知'
    }

    const formatActor = (n: DiscourseNotification) => {
      return n.data?.display_username || n.data?.username || n.data?.original_username || ''
    }

    const isBadgeNotification = (n: DiscourseNotification) =>
      n.notification_type === 12 || !!n.data?.badge_id

    const buildBadgePath = (n: DiscourseNotification) => {
      const badgeId = n.data?.badge_id || n.data?.badgeId
      if (!badgeId) return ''
      const slug = n.data?.badge_slug || n.data?.badge_name || n.data?.badgeName || 'badge'
      return `/badges/${badgeId}/${encodeURIComponent(String(slug))}`
    }

    const buildPath = (n: DiscourseNotification) => {
      if (isBadgeNotification(n)) return buildBadgePath(n)
      const topicId = n.topic_id || n.data?.topic_id
      const slug = n.slug || n.data?.slug || 'topic'
      const postNumber = n.post_number || n.data?.post_number
      if (topicId && postNumber) return `/t/${slug}/${topicId}/${postNumber}`
      if (topicId) return `/t/${slug}/${topicId}`
      return ''
    }

    const formatTypeText = (n: DiscourseNotification) => {
      const mapping: Record<number, string> = {
        1: '提及了你',
        2: '回复了你',
        3: '引用了你',
        5: '提到你',
        6: '点赞了你',
        7: '点赞了你的帖子',
        8: '点赞了你的话题',
        9: '给你发了私信',
        12: '获得了徽章'
      }
      return mapping[n.notification_type] || '通知'
    }

    const formatBadgeTitle = (n: DiscourseNotification) => {
      return (
        n.data?.badge_name || n.data?.badgeName || n.data?.badge_slug || n.data?.badgeSlug || '徽章'
      )
    }

    const handleOpen = (n: DiscourseNotification) => {
      const path = buildPath(n)
      if (path) emit('open', path)
    }

    const styles = `
      .notification-item {
        cursor: pointer;
        transition: box-shadow 0.2s ease, border-color 0.2s ease;
      }
      .notification-item.unread {
        border-color: rgba(59, 130, 246, 0.6);
        box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.1);
      }
    `

    return () => (
      <div class="notifications-view space-y-4">
        <style>{styles}</style>
        <div class="flex flex-wrap gap-2">
          {filters.value.map(item => (
            <Button
              key={item.key}
              size="small"
              type={props.filter === item.key ? 'primary' : 'default'}
              onClick={() => emit('changeFilter', item.key)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        {props.loading ? (
          <div class="flex items-center gap-2 text-gray-500">
            <Spin size="small" />
            正在加载通知...
          </div>
        ) : filteredNotifications.value.length === 0 ? (
          <div class="text-gray-500">暂无通知</div>
        ) : (
          <div class="space-y-2">
            {filteredNotifications.value.map(item => (
              <div
                key={item.id}
                class={[
                  'notification-item p-3 rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800',
                  !item.read ? 'unread' : ''
                ]}
                onClick={() => handleOpen(item)}
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="flex-1">
                    {isBadgeNotification(item) ? (
                      <div class="font-medium dark:text-white">
                        获得徽章 · {formatBadgeTitle(item)}
                      </div>
                    ) : (
                      <div class="font-medium dark:text-white" innerHTML={formatTitle(item)} />
                    )}
                    <div class="text-xs text-gray-500 mt-1">
                      {formatActor(item) && <span>@{formatActor(item)} </span>}
                      <span>{formatTypeText(item)}</span>
                    </div>
                    {isBadgeNotification(item) && item.data?.badge_description && (
                      <div class="text-xs text-gray-400 mt-1">{item.data?.badge_description}</div>
                    )}
                  </div>
                  <span class="text-xs text-gray-400 whitespace-nowrap">{item.created_at}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
})
