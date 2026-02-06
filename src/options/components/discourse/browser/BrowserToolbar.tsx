import { defineComponent } from 'vue'
import {
  LeftOutlined,
  RightOutlined,
  ReloadOutlined,
  HomeOutlined,
  MenuOutlined,
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
  emits: ['update:modelValue', 'goBack', 'goForward', 'refresh', 'goHome', 'updateBaseUrl'],
  setup(props, { emit, slots }) {
    const handleInput = (value: string) => {
      emit('update:modelValue', value)
    }

    return () => (
      <div class="discourse-toolbar">
        <div class="toolbar-left">
          <Button
            size="small"
            type="text"
            class="toolbar-icon"
            v-slots={{ icon: () => <MenuOutlined /> }}
          />
          <span class="toolbar-brand">Discourse</span>
        </div>

        <div class="toolbar-search">
          <Input
            value={props.modelValue}
            placeholder="搜索"
            size="middle"
            class="toolbar-search-input"
            prefix={<SearchOutlined />}
            onUpdate:value={handleInput}
            onPressEnter={() => emit('updateBaseUrl')}
          />
          <Button type="primary" size="small" onClick={() => emit('updateBaseUrl')}>
            访问
          </Button>
        </div>

        <div class="toolbar-actions">
          <Button
            size="small"
            type="text"
            class="toolbar-icon"
            disabled={!props.activeTab || props.activeTab.historyIndex <= 0}
            onClick={() => emit('goBack')}
            v-slots={{ icon: () => <LeftOutlined /> }}
          />
          <Button
            size="small"
            type="text"
            class="toolbar-icon"
            disabled={
              !props.activeTab || props.activeTab.historyIndex >= props.activeTab.history.length - 1
            }
            onClick={() => emit('goForward')}
            v-slots={{ icon: () => <RightOutlined /> }}
          />
          <Button
            size="small"
            type="text"
            class="toolbar-icon"
            onClick={() => emit('refresh')}
            loading={props.activeTab?.loading}
            v-slots={{ icon: () => <ReloadOutlined /> }}
          />
          <Button
            size="small"
            type="text"
            class="toolbar-icon"
            onClick={() => emit('goHome')}
            v-slots={{ icon: () => <HomeOutlined /> }}
          />
          <div class="toolbar-right">{slots.right?.()}</div>
        </div>
      </div>
    )
  }
})
