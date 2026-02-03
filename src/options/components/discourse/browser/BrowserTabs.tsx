import { defineComponent } from 'vue'
import { LoadingOutlined, CloseOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { Button } from 'ant-design-vue'

import type { BrowserTab } from '../types'

export default defineComponent({
  name: 'BrowserTabs',
  props: {
    tabs: { type: Array as () => BrowserTab[], required: true },
    activeTabId: { type: String as () => string | null, default: null }
  },
  emits: ['switchTab', 'closeTab', 'createTab'],
  setup(props, { emit }) {
    return () => (
      <div class="tab-bar bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700 flex items-center overflow-x-auto">
        {props.tabs.map(tab => (
          <div
            key={tab.id}
            class={[
              'tab-item flex items-center gap-2 px-3 py-2 border-r dark:border-gray-700 cursor-pointer min-w-[120px] max-w-[200px] hover:bg-gray-100 dark:hover:bg-gray-800',
              tab.id === props.activeTabId
                ? 'bg-white dark:bg-gray-800'
                : 'bg-gray-50 dark:bg-gray-900'
            ]}
            onClick={() => emit('switchTab', tab.id)}
          >
            {tab.loading && <LoadingOutlined class="text-blue-500" />}
            <span class="flex-1 truncate text-sm dark:text-white">{tab.title}</span>
            <CloseOutlined
              class="text-gray-400 hover:text-red-500 text-xs"
              onClick={(e: Event) => {
                e.stopPropagation()
                emit('closeTab', tab.id)
              }}
            />
          </div>
        ))}
        <Button
          type="text"
          size="small"
          class="ml-1"
          onClick={() => emit('createTab')}
          v-slots={{ icon: () => <PlusOutlined /> }}
        />
      </div>
    )
  }
})
