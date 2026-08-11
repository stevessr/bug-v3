import { defineComponent } from 'vue'
import {
  LeftOutlined,
  RightOutlined,
  ReloadOutlined,
  HomeOutlined,
  MenuOutlined,
  SendOutlined,
  SearchOutlined
} from '@ant-design/icons-vue'

import type { BrowserTab } from '../types'
import '../css/BrowserToolbar.css'

export default defineComponent({
  name: 'BrowserToolbar',
  props: {
    modelValue: { type: String, required: true },
    activeTab: { type: Object as () => BrowserTab | null, default: null }
  },
  emits: [
    'update:modelValue',
    'goBack',
    'goForward',
    'refresh',
    'goHome',
    'updateBaseUrl',
    'toggleQuickSidebar'
  ],
  setup(props, { emit, slots }) {
    const handleInput = (event: Event) => {
      emit('update:modelValue', (event.target as HTMLInputElement).value)
    }

    const handleSubmit = (event: Event) => {
      event.preventDefault()
      emit('updateBaseUrl')
    }

    return () => (
      <header class="discourse-toolbar" role="banner">
        <div class="toolbar-leading">
          <button
            type="button"
            class="toolbar-icon-button"
            onClick={() => emit('toggleQuickSidebar')}
            aria-label="打开快捷导航"
            title="快捷导航"
          >
            <MenuOutlined />
          </button>

          <button
            type="button"
            class="toolbar-brand"
            onClick={() => emit('goHome')}
            aria-label="返回论坛首页"
          >
            <span class="toolbar-brand-logo" aria-hidden="true">
              D
            </span>
            <span class="toolbar-brand-copy">
              <span class="toolbar-brand-title">Discourse</span>
              <span class="toolbar-brand-context">{props.activeTab?.title || '论坛浏览器'}</span>
            </span>
          </button>
        </div>

        <div class="toolbar-browser-controls" role="group" aria-label="页面浏览操作">
          <button
            type="button"
            class="toolbar-icon-button"
            disabled={!props.activeTab || props.activeTab.historyIndex <= 0}
            onClick={() => emit('goBack')}
            aria-label="后退"
            title="后退"
          >
            <LeftOutlined />
          </button>
          <button
            type="button"
            class="toolbar-icon-button"
            disabled={
              !props.activeTab || props.activeTab.historyIndex >= props.activeTab.history.length - 1
            }
            onClick={() => emit('goForward')}
            aria-label="前进"
            title="前进"
          >
            <RightOutlined />
          </button>
          <button
            type="button"
            class={['toolbar-icon-button', props.activeTab?.loading ? 'is-loading' : '']}
            onClick={() => emit('refresh')}
            aria-label={props.activeTab?.loading ? '正在刷新' : '刷新'}
            title="刷新"
            aria-busy={props.activeTab?.loading}
          >
            <ReloadOutlined />
          </button>
        </div>

        <form class="toolbar-address" role="search" onSubmit={handleSubmit}>
          <SearchOutlined class="toolbar-address-icon" aria-hidden="true" />
          <input
            value={props.modelValue}
            class="toolbar-address-input"
            aria-label="论坛地址或搜索内容"
            placeholder="输入论坛地址或搜索"
            spellcheck={false}
            onInput={handleInput}
          />
          <button type="submit" class="toolbar-go-button" aria-label="打开地址">
            <SendOutlined />
            <span>前往</span>
          </button>
        </form>

        <div class="toolbar-trailing">
          <button
            type="button"
            class="toolbar-icon-button toolbar-home"
            onClick={() => emit('goHome')}
            aria-label="论坛首页"
            title="论坛首页"
          >
            <HomeOutlined />
          </button>
          <div class="toolbar-slot">{slots.right?.()}</div>
        </div>
      </header>
    )
  }
})
