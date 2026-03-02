import { defineComponent } from 'vue'
import {
  LeftOutlined,
  RightOutlined,
  ReloadOutlined,
  HomeOutlined,
  MenuOutlined,
  LinkOutlined,
  SearchOutlined
} from '@ant-design/icons-vue'
import { Button, Input } from 'ant-design-vue'

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
    const handleInput = (value: string) => {
      emit('update:modelValue', value)
    }

    return () => (
      <header class="discourse-toolbar" role="banner">
        <div class="toolbar-left">
          <Button
            size="small"
            type="text"
            class="toolbar-icon"
            onClick={() => emit('toggleQuickSidebar')}
            aria-label="切换侧栏"
            v-slots={{ icon: () => <MenuOutlined /> }}
          />
          <button
            type="button"
            class="toolbar-brand"
            onClick={() => emit('goHome')}
            aria-label="返回首页"
          >
            <span class="toolbar-brand-logo">D</span>
            <span class="toolbar-brand-text">Discourse</span>
          </button>
        </div>

        <div class="toolbar-center">
          <div class="toolbar-nav" role="group" aria-label="浏览操作">
            <Button
              size="small"
              type="text"
              class="toolbar-icon"
              disabled={!props.activeTab || props.activeTab.historyIndex <= 0}
              onClick={() => emit('goBack')}
              aria-label="后退"
              v-slots={{ icon: () => <LeftOutlined /> }}
            />
            <Button
              size="small"
              type="text"
              class="toolbar-icon"
              disabled={
                !props.activeTab ||
                props.activeTab.historyIndex >= props.activeTab.history.length - 1
              }
              onClick={() => emit('goForward')}
              aria-label="前进"
              v-slots={{ icon: () => <RightOutlined /> }}
            />
            <Button
              size="small"
              type="text"
              class="toolbar-icon"
              onClick={() => emit('refresh')}
              loading={props.activeTab?.loading}
              aria-label="刷新"
              v-slots={{ icon: () => <ReloadOutlined /> }}
            />
          </div>

          <div class="toolbar-search">
            <Input
              value={props.modelValue}
              placeholder="输入站点地址或搜索"
              size="middle"
              class="toolbar-search-input"
              prefix={<SearchOutlined />}
              onUpdate:value={handleInput}
              onPressEnter={() => emit('updateBaseUrl')}
            />
            <Button
              size="small"
              class="toolbar-open-btn"
              onClick={() => emit('updateBaseUrl')}
              v-slots={{ icon: () => <LinkOutlined /> }}
            >
              前往
            </Button>
          </div>
        </div>

        <div class="toolbar-actions">
          <Button
            size="small"
            type="text"
            class="toolbar-icon toolbar-home"
            onClick={() => emit('goHome')}
            aria-label="首页"
            v-slots={{ icon: () => <HomeOutlined /> }}
          />
          <div class="toolbar-right">{slots.right?.()}</div>
        </div>
      </header>
    )
  }
})
