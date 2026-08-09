import { defineComponent } from 'vue'
import { LoadingOutlined, CloseOutlined, PlusOutlined } from '@ant-design/icons-vue'

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
    const handleTabKeydown = (event: KeyboardEvent, index: number) => {
      let targetIndex: number | null = null

      if (event.key === 'ArrowLeft') {
        targetIndex = index === 0 ? props.tabs.length - 1 : index - 1
      } else if (event.key === 'ArrowRight') {
        targetIndex = index === props.tabs.length - 1 ? 0 : index + 1
      } else if (event.key === 'Home') {
        targetIndex = 0
      } else if (event.key === 'End') {
        targetIndex = props.tabs.length - 1
      }

      if (targetIndex === null || !props.tabs[targetIndex]) return
      event.preventDefault()
      emit('switchTab', props.tabs[targetIndex].id)
      const tabList = (event.currentTarget as HTMLElement).closest('[role="tablist"]')
      const tabButtons = tabList?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      requestAnimationFrame(() => tabButtons?.[targetIndex]?.focus())
    }

    return () => (
      <nav class="browser-tabs" aria-label="页面标签">
        <div class="browser-tabs__list" role="tablist" aria-label="已打开页面">
          {props.tabs.map((tab, index) => {
            const active = tab.id === props.activeTabId
            return (
              <div
                key={tab.id}
                class={[
                  'browser-tabs__item',
                  active ? 'is-active' : '',
                  tab.loading ? 'is-loading' : ''
                ]}
              >
                <button
                  type="button"
                  class="browser-tabs__main"
                  role="tab"
                  aria-selected={active}
                  aria-label={tab.loading ? `${tab.title}，正在加载` : tab.title}
                  tabindex={active ? 0 : -1}
                  onClick={() => emit('switchTab', tab.id)}
                  onKeydown={(event: KeyboardEvent) => handleTabKeydown(event, index)}
                >
                  <span class="browser-tabs__state" aria-hidden="true">
                    {tab.loading ? <LoadingOutlined /> : <span class="browser-tabs__dot" />}
                  </span>
                  <span class="browser-tabs__title">{tab.title}</span>
                </button>
                <button
                  type="button"
                  class="browser-tabs__close"
                  aria-label={`关闭“${tab.title}”标签`}
                  title="关闭标签"
                  onClick={() => emit('closeTab', tab.id)}
                >
                  <CloseOutlined />
                </button>
              </div>
            )
          })}
        </div>
        <button
          type="button"
          class="browser-tabs__add"
          onClick={() => emit('createTab')}
          aria-label="新建标签"
          title="新建标签"
        >
          <PlusOutlined />
        </button>
      </nav>
    )
  }
})
