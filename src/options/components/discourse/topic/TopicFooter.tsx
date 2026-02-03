import { defineComponent, computed } from 'vue'
import { Button, Select, Tooltip } from 'ant-design-vue'

const LEVEL_OPTIONS = [
  {
    value: 0,
    label: '忽略',
    description: '完全静音，不再收到任何通知。'
  },
  {
    value: 1,
    label: '常规',
    description: '仅在被提及时通知。'
  },
  {
    value: 2,
    label: '追踪',
    description: '收到新回复数量提醒。'
  },
  {
    value: 3,
    label: '关注',
    description: '每条新回复都会通知。'
  },
  {
    value: 4,
    label: '仅关注首帖',
    description: '仅在首帖有新回复时通知。'
  }
]

export default defineComponent({
  name: 'TopicFooter',
  props: {
    notificationLevel: { type: Number as () => number | null, default: null },
    bookmarked: { type: Boolean, default: false },
    canAssign: { type: Boolean, default: false },
    loading: { type: Boolean, default: false }
  },
  emits: ['changeLevel', 'bookmark', 'flag', 'assign', 'reply'],
  setup(props, { emit }) {
    const levelOption = computed(() => {
      const level = props.notificationLevel ?? 1
      return LEVEL_OPTIONS.find(option => option.value === level) || LEVEL_OPTIONS[1]
    })

    return () => (
      <div class="topic-footer">
        <div class="topic-footer__left">
          <div class="topic-footer__level">
            <span class="topic-footer__label">通知等级</span>
            <Select
              size="small"
              value={levelOption.value.value}
              class="topic-footer__select"
              disabled={props.loading}
              onChange={(value: number) => emit('changeLevel', value)}
              options={LEVEL_OPTIONS.map(option => ({
                value: option.value,
                label: option.label
              }))}
            />
          </div>
          <div class="topic-footer__analysis">
            <span class="topic-footer__analysis-title">等级说明：</span>
            <span>{levelOption.value.description}</span>
          </div>
        </div>
        <div class="topic-footer__right">
          <Button size="small" onClick={() => emit('bookmark')} loading={props.loading}>
            {props.bookmarked ? '移除书签' : '加入书签'}
          </Button>
          <Button size="small" onClick={() => emit('flag')} disabled={props.loading}>
            举报
          </Button>
          {props.canAssign && (
            <Button size="small" onClick={() => emit('assign')} disabled={props.loading}>
              指定
            </Button>
          )}
          <Tooltip title="回复此话题">
            <Button type="primary" size="small" onClick={() => emit('reply')}>
              回复
            </Button>
          </Tooltip>
        </div>
      </div>
    )
  }
})
