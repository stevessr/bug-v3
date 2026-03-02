import { defineComponent } from 'vue'
import { LoadingOutlined, CloseOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { Button } from 'ant-design-vue'

import type { BrowserTab } from '../types'
import '../css/BrowserTabs.css'

export default defineComponent({
  name: 'BrowserTabs',
  props: {
    tabs: { type: Array as () => BrowserTab[], required: true },
    activeTabId: { type: String as () => string | null, default: null }
  },
  emits: ['switchTab', 'closeTab', 'createTab'],
  setup(props, { emit }) {
    return () => (
      <nav class="browser-tabs" aria-label="页面标签">
        <div class="browser-tabs__list">
          {props.tabs.map(tab => (
            <div
              key={tab.id}
              class={[
                'browser-tabs__item',
                tab.id === props.activeTabId ? 'is-active' : '',
                tab.loading ? 'is-loading' : ''
              ]}
              onClick={() => emit('switchTab', tab.id)}
            >
              <span class="browser-tabs__state" aria-hidden="true">
                {tab.loading ? <LoadingOutlined /> : null}
              </span>
              <span class="browser-tabs__title">{tab.title}</span>
              <button
                type="button"
                class="browser-tabs__close"
                aria-label="关闭标签"
                onClick={(e: Event) => {
                  e.stopPropagation()
                  emit('closeTab', tab.id)
                }}
              >
                <CloseOutlined />
              </button>
            </div>
          ))}
        </div>
        <Button
          type="text"
          size="small"
          class="browser-tabs__add"
          onClick={() => emit('createTab')}
          aria-label="新建标签"
          v-slots={{ icon: () => <PlusOutlined /> }}
        />
      </nav>
    )
  }
})
