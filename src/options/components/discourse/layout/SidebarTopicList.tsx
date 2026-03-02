import { defineComponent } from 'vue'

import type { TopicListType } from '../types'

export default defineComponent({
  name: 'SidebarTopicList',
  props: {
    topicListType: { type: String as () => TopicListType, required: true },
    items: {
      type: Array as () => Array<{ value: TopicListType; label: string }>,
      required: true
    }
  },
  emits: ['change'],
  setup(props, { emit }) {
    return () => (
      <div class="sidebar-card">
        <h3 class="sidebar-title">首页类型</h3>
        <div class="flex flex-wrap gap-2">
          {props.items.map(item => (
            <button
              key={item.value}
              class={['topic-type-btn', props.topicListType === item.value ? 'active' : '']}
              onClick={() => emit('change', item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    )
  }
})
