import { defineComponent } from 'vue'
import { Button } from 'ant-design-vue'
import { ReloadOutlined, CloseOutlined } from '@ant-design/icons-vue'

import '../css/QuickSidebarPanel.css'

export type QuickSidebarItem = {
  id: string
  label: string
  path: string
  color?: string
  muted?: boolean
}

export type QuickSidebarSection = {
  title: string
  items: QuickSidebarItem[]
}

export default defineComponent({
  name: 'QuickSidebarPanel',
  props: {
    open: { type: Boolean, required: true },
    loading: { type: Boolean, required: true },
    sections: { type: Array as () => QuickSidebarSection[], required: true },
    error: { type: String, default: null }
  },
  emits: {
    close: () => true,
    navigate: (path: string) => typeof path === 'string',
    refresh: () => true
  },
  setup(props, { emit }) {
    return () => (
      <div class={['quick-sidebar-root', props.open ? 'is-open' : '']}>
        <div class="quick-sidebar-backdrop" onClick={() => emit('close')} />
        <aside class="quick-sidebar-panel">
          <div class="quick-sidebar-header">
            <span class="title">快捷导航</span>
            <div class="actions">
              <Button size="small" onClick={() => emit('refresh')}>
                <ReloadOutlined />
              </Button>
              <Button size="small" onClick={() => emit('close')}>
                <CloseOutlined />
              </Button>
            </div>
          </div>
          <div class="quick-sidebar-body">
            {props.loading ? (
              <div class="quick-sidebar-empty">加载中…</div>
            ) : props.error ? (
              <div class="quick-sidebar-empty">{props.error}</div>
            ) : (
              props.sections.map(section => (
                <div class="quick-sidebar-section" key={section.title}>
                  <div class="quick-sidebar-section__title">{section.title}</div>
                  <div class="quick-sidebar-section__items">
                    {section.items.map(item => (
                      <button
                        class={['quick-sidebar-item', item.muted ? 'is-muted' : '']}
                        key={item.id}
                        onClick={() => emit('navigate', item.path)}
                        type="button"
                      >
                        <span
                          class="quick-sidebar-dot"
                          style={item.color ? { backgroundColor: `#${item.color}` } : {}}
                        />
                        <span class="quick-sidebar-label">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    )
  }
})
