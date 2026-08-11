import { defineComponent, computed } from 'vue'
import { Button, Dropdown, Menu, MenuItem, Tooltip } from 'ant-design-vue'
import {
  BellOutlined,
  CheckOutlined,
  DownOutlined,
  EyeOutlined,
  NotificationOutlined,
  ReadOutlined,
  StopOutlined
} from '@ant-design/icons-vue'

const LEVEL_OPTIONS = [
  {
    value: 0,
    label: '忽略',
    description: '完全静音，不再收到此话题的提醒。',
    icon: StopOutlined
  },
  {
    value: 1,
    label: '常规',
    description: '仅在被提及或直接回复时通知。',
    icon: BellOutlined
  },
  {
    value: 2,
    label: '追踪',
    description: '显示未读数量，不为每条回复推送提醒。',
    icon: EyeOutlined
  },
  {
    value: 3,
    label: '关注',
    description: '每条新回复都会通知你。',
    icon: NotificationOutlined
  },
  {
    value: 4,
    label: '仅关注首帖',
    description: '仅在新增首帖内容时通知。',
    icon: ReadOutlined
  }
]

export default defineComponent({
  name: 'TopicFooter',
  props: {
    notificationLevel: { type: Number as () => number | null, default: null },
    bookmarked: { type: Boolean, default: false },
    canAssign: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    aiAvailable: { type: Boolean, default: true },
    aiLoading: { type: Boolean, default: false }
  },
  emits: ['changeLevel', 'bookmark', 'flag', 'assign', 'share', 'reply', 'aiSummary'],
  setup(props, { emit }) {
    const levelOption = computed(() => {
      const level = props.notificationLevel ?? 1
      return LEVEL_OPTIONS.find(option => option.value === level) || LEVEL_OPTIONS[1]
    })

    const renderLevelIcon = (option: (typeof LEVEL_OPTIONS)[number]) => {
      const Icon = option.icon
      return <Icon />
    }

    return () => (
      <footer class="topic-footer">
        <div class="topic-footer__left">
          <div class="topic-footer__level">
            <span class="topic-footer__label">通知等级</span>
            <Dropdown
              trigger={['click']}
              placement="topLeft"
              disabled={props.loading}
              overlayClassName="topic-notification-menu"
              v-slots={{
                overlay: () => (
                  <Menu selectedKeys={[String(levelOption.value.value)]}>
                    {LEVEL_OPTIONS.map(option => (
                      <MenuItem
                        key={String(option.value)}
                        class={[
                          'topic-notification-menu__item',
                          levelOption.value.value === option.value ? 'is-selected' : ''
                        ]}
                        onClick={() => emit('changeLevel', option.value)}
                      >
                        <span class="topic-notification-menu__icon">{renderLevelIcon(option)}</span>
                        <span class="topic-notification-menu__copy">
                          <strong>{option.label}</strong>
                          <small>{option.description}</small>
                        </span>
                        {levelOption.value.value === option.value && (
                          <CheckOutlined class="topic-notification-menu__selected" />
                        )}
                      </MenuItem>
                    ))}
                  </Menu>
                )
              }}
            >
              <Button
                class="topic-footer__notification-trigger"
                aria-label="话题通知等级"
                disabled={props.loading}
              >
                {renderLevelIcon(levelOption.value)}
                <span>{levelOption.value.label}</span>
                <DownOutlined class="topic-footer__notification-chevron" />
              </Button>
            </Dropdown>
          </div>
          <div class="topic-footer__analysis">
            <span class="topic-footer__analysis-title">等级说明：</span>
            <span>{levelOption.value.description}</span>
          </div>
        </div>
        <div class="topic-footer__right">
          <Button
            class="topic-footer__action"
            onClick={() => emit('bookmark')}
            loading={props.loading}
          >
            {props.bookmarked ? '移除书签' : '加入书签'}
          </Button>
          <Button
            class="topic-footer__action"
            onClick={() => emit('flag')}
            disabled={props.loading}
          >
            举报
          </Button>
          <Button
            class="topic-footer__action"
            onClick={() => emit('share')}
            disabled={props.loading}
          >
            分享
          </Button>
          {props.canAssign && (
            <Button
              class="topic-footer__action"
              onClick={() => emit('assign')}
              disabled={props.loading}
            >
              指定
            </Button>
          )}
          {props.aiAvailable && (
            <Button
              class="topic-footer__action"
              onClick={() => emit('aiSummary')}
              loading={props.aiLoading}
            >
              AI 总结
            </Button>
          )}
          <Tooltip title="回复此话题">
            <Button type="primary" class="topic-footer__action" onClick={() => emit('reply')}>
              回复
            </Button>
          </Tooltip>
        </div>
      </footer>
    )
  }
})
