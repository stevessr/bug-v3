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
      <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700">
        <h3 class="text-sm font-semibold mb-3 dark:text-white">首页类型</h3>
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
