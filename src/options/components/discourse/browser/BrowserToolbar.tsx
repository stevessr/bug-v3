import { defineComponent } from 'vue'
import { LeftOutlined, RightOutlined, ReloadOutlined, HomeOutlined } from '@ant-design/icons-vue'
import { Button, Input } from 'ant-design-vue'

import type { BrowserTab } from '../types'

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
      <div class="toolbar bg-gray-100 dark:bg-gray-800 border-b dark:border-gray-700 p-2 flex items-center gap-2">
        <div class="flex items-center gap-1">
          <Button
            size="small"
            disabled={!props.activeTab || props.activeTab.historyIndex <= 0}
            onClick={() => emit('goBack')}
            v-slots={{ icon: () => <LeftOutlined /> }}
          />
          <Button
            size="small"
            disabled={
              !props.activeTab || props.activeTab.historyIndex >= props.activeTab.history.length - 1
            }
            onClick={() => emit('goForward')}
            v-slots={{ icon: () => <RightOutlined /> }}
          />
          <Button
            size="small"
            onClick={() => emit('refresh')}
            loading={props.activeTab?.loading}
            v-slots={{ icon: () => <ReloadOutlined /> }}
          />
          <Button
            size="small"
            onClick={() => emit('goHome')}
            v-slots={{ icon: () => <HomeOutlined /> }}
          />
        </div>

        <div class="flex-1 flex items-center gap-2">
          <Input
            value={props.modelValue}
            placeholder="输入 Discourse 论坛地址"
            size="small"
            class="flex-1"
            onUpdate:value={handleInput}
            onPressEnter={() => emit('updateBaseUrl')}
          />
          <Button type="primary" size="small" onClick={() => emit('updateBaseUrl')}>
            访问
          </Button>
        </div>

        <div class="toolbar-right flex items-center gap-2">{slots.right?.()}</div>
      </div>
    )
  }
})
