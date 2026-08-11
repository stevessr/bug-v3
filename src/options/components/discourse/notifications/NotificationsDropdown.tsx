import { computed, defineComponent } from 'vue'
import { Badge, Button, Dropdown } from 'ant-design-vue'
import { BellOutlined, LoadingOutlined } from '@ant-design/icons-vue'

import type { DiscourseNotification, DiscourseNotificationFilter } from '../types'

import NotificationsView from './NotificationsView'
import '../css/NotificationsDropdown.css'

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
    }
  },
  emits: {
    openChange: (open: boolean) => typeof open === 'boolean',
    refresh: () => true,
    openAll: () => true,
    open: (path: string) => typeof path === 'string',
    changeFilter: (filter: DiscourseNotificationFilter) => typeof filter === 'string'
  },
  setup(props, { emit }) {
    const preview = computed(() => props.notifications.slice(0, 20))

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
                  onChangeFilter={(filter: DiscourseNotificationFilter) =>
                    emit('changeFilter', filter)
                  }
                  onOpen={(path: string) => emit('open', path)}
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
