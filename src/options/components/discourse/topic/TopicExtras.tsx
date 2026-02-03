import { defineComponent, ref, computed, watch } from 'vue'

import type { SuggestedTopic } from '../types'
import TopicList from './TopicList'

type ExtrasTab = 'suggested' | 'related'

export default defineComponent({
  name: 'TopicExtras',
  props: {
    suggested: { type: Array as () => SuggestedTopic[], default: () => [] },
    related: { type: Array as () => SuggestedTopic[], default: () => [] },
    baseUrl: { type: String, required: true }
  },
  emits: ['open'],
  setup(props, { emit }) {
    const availableTabs = computed(() => {
      const tabs: Array<{ key: ExtrasTab; label: string; count: number }> = []
      if (props.suggested.length) {
        tabs.push({ key: 'suggested', label: '推荐', count: props.suggested.length })
      }
      if (props.related.length) {
        tabs.push({ key: 'related', label: '相关', count: props.related.length })
      }
      return tabs
    })

    const activeTab = ref<ExtrasTab>('suggested')

    const activeList = computed(() => {
      if (activeTab.value === 'related') return props.related
      return props.suggested
    })

    watch(
      () => [props.suggested.length, props.related.length],
      () => {
        if (!availableTabs.value.length) return
        const current = availableTabs.value.find(tab => tab.key === activeTab.value)
        if (!current) {
          activeTab.value = availableTabs.value[0].key
        }
      },
      { immediate: true }
    )

    return () => {
      if (!availableTabs.value.length) return null

      return (
        <div class="topic-extras">
          <div class="topic-extras__tabs">
            {availableTabs.value.map(tab => (
              <button
                key={tab.key}
                class={['topic-extras__tab', activeTab.value === tab.key ? 'is-active' : '']}
                onClick={() => {
                  activeTab.value = tab.key
                }}
              >
                {tab.label}
                <span class="topic-extras__count">{tab.count}</span>
              </button>
            ))}
          </div>
          <div class="topic-extras__body">
            <TopicList
              topics={activeList.value}
              baseUrl={props.baseUrl}
              onClick={(topic: SuggestedTopic) => emit('open', topic)}
            />
          </div>
        </div>
      )
    }
  }
})
