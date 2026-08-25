import { computed, defineAsyncComponent, defineComponent, watch } from 'vue'
import { Badge, Button, Dropdown } from 'ant-design-vue'
import { BellOutlined, LoadingOutlined } from '@ant-design/icons-vue'

import type { DiscourseNotification, DiscourseNotificationFilter } from '../types'
import { ensureEmojiShortcodesLoaded } from '../linux.do/emojis'

import '../css/NotificationsDropdown.css'

const NotificationsView = defineAsyncComponent(() => import('./NotificationsView'))

export default defineComponent({
  name: 'NotificationsDropdown',
  props: {
    notifications: {
      type: Array as () => DiscourseNotification[],
      required: true
    },
    filter: {
      type: String as () => DiscourseNotificationFilter,
      required: true
    },
    unreadCount: {
      type: Number,
      required: true
    },
    open: {
      type: Boolean,
      required: true
    },
    loading: {
      type: Boolean,
      default: false
    },
    baseUrl: {
      type: String,
      required: true
    },
    currentUsername: {
      type: String,
      default: ''
    },
    blockedUsernames: {
      type: Array as () => string[],
      default: () => []
    },
    exemptUsername: {
      type: String,
      default: null
    },
    markingAll: {
      type: Boolean,
      default: false
    }
  },
  emits: {
    openChange: (open: boolean) => typeof open === 'boolean',
    refresh: () => true,
    openAll: () => true,
    open: (path: string) => typeof path === 'string',
    changeFilter: (filter: DiscourseNotificationFilter) => typeof filter === 'string',
    markAll: () => true,
    markRead: (id: number) => Number.isFinite(id)
  },
  setup(props, { emit }) {
    const preview = computed(() => props.notifications.slice(0, 20))

    watch(
      () => props.baseUrl,
      value => {
        if (value) void ensureEmojiShortcodesLoaded(value).catch(() => undefined)
      },
      { immediate: true }
    )

    return () => (
      <Dropdown
        open={props.open}
        trigger={['click']}
        placement="bottomRight"
        onOpenChange={(next: boolean) => emit('openChange', next)}
        v-slots={{
          overlay: () => (
            <div class="notifications-dropdown">
              <div class="notifications-dropdown__header">
                <span class="notifications-dropdown__title">通知</span>
                <div class="notifications-dropdown__actions">
                  <Button
                    size="small"
                    class="notifications-dropdown__action"
                    loading={props.loading}
                    aria-label="刷新通知"
                    onClick={() => emit('refresh')}
                  >
                    刷新
                  </Button>
                  <Button
                    size="small"
                    class="notifications-dropdown__action"
                    disabled={props.markingAll}
                    loading={props.markingAll}
                    aria-label="将全部通知标记为已读"
                    onClick={() => emit('markAll')}
                  >
                    全部已读
                  </Button>
                  <Button
                    size="small"
                    class="notifications-dropdown__action"
                    onClick={() => emit('openAll')}
                  >
                    查看全部
                  </Button>
                </div>
              </div>
              <div class="notifications-dropdown__body">
                <NotificationsView
                  notifications={preview.value}
                  filter={props.filter}
                  loading={props.loading}
                  baseUrl={props.baseUrl}
                  currentUsername={props.currentUsername}
                  blockedUsernames={props.blockedUsernames}
                  exemptUsername={props.exemptUsername}
                  onChangeFilter={(filter: DiscourseNotificationFilter) =>
                    emit('changeFilter', filter)
                  }
                  onOpen={(path: string) => emit('open', path)}
                  onMarkAll={() => emit('markAll')}
                  onMarkRead={(id: number) => emit('markRead', id)}
                />
              </div>
            </div>
          )
        }}
      >
        <Badge count={props.unreadCount} overflowCount={99}>
          <Button
            size="small"
            class={['notifications-trigger', { 'is-loading': props.loading }]}
            title={props.loading ? '正在加载通知' : '通知'}
            aria-label={props.loading ? '正在加载通知' : '通知'}
            aria-busy={props.loading}
          >
            {props.loading ? <LoadingOutlined spin /> : <BellOutlined />}
          </Button>
        </Badge>
      </Dropdown>
    )
  }
})
