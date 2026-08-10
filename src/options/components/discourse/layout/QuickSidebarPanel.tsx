import { defineComponent, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ReloadOutlined, CloseOutlined } from '@ant-design/icons-vue'

import { getDiscourseIconHref } from './iconSprite'
import '../css/QuickSidebarPanel.css'

export type QuickSidebarItem = {
  id: string
  label: string
  path: string
  color?: string
  muted?: boolean
  icon?: string
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
    const panelRef = ref<HTMLElement | null>(null)
    const closeButtonRef = ref<HTMLButtonElement | null>(null)
    let previouslyFocused: HTMLElement | null = null

    const getFocusableElements = () => {
      if (!panelRef.value) return []
      return Array.from(
        panelRef.value.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), [tabindex]:not([tabindex="-1"])'
        )
      )
    }

    const handleDocumentKeydown = (event: KeyboardEvent) => {
      if (!props.open) return
      if (event.key === 'Escape') {
        event.preventDefault()
        emit('close')
        return
      }
      if (event.key !== 'Tab') return

      const focusable = getFocusableElements()
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    const removeKeydownListener = () => {
      document.removeEventListener('keydown', handleDocumentKeydown, true)
    }

    watch(
      () => props.open,
      open => {
        removeKeydownListener()
        if (open) {
          previouslyFocused = document.activeElement as HTMLElement | null
          document.addEventListener('keydown', handleDocumentKeydown, true)
          void nextTick(() => closeButtonRef.value?.focus())
        } else if (previouslyFocused) {
          previouslyFocused.focus()
          previouslyFocused = null
        }
      },
      { flush: 'sync' }
    )

    onBeforeUnmount(removeKeydownListener)

    return () => (
      <div class={['quick-sidebar-root', props.open ? 'is-open' : '']} aria-hidden={!props.open}>
        <button
          type="button"
          class="quick-sidebar-backdrop"
          onClick={() => emit('close')}
          aria-label="关闭快捷导航"
          tabindex={props.open ? 0 : -1}
        />
        <aside
          ref={panelRef}
          class="quick-sidebar-panel"
          role="dialog"
          aria-modal="true"
          aria-label="快捷导航"
        >
          <div class="quick-sidebar-header">
            <div class="quick-sidebar-header__meta">
              <span class="quick-sidebar-header__eyebrow">论坛导航</span>
              <span class="title">快捷侧栏</span>
            </div>
            <div class="actions">
              <button
                type="button"
                class="quick-sidebar-icon-button"
                onClick={() => emit('refresh')}
                aria-label="刷新侧栏"
                title="刷新"
              >
                <ReloadOutlined />
              </button>
              <button
                ref={closeButtonRef}
                type="button"
                class="quick-sidebar-icon-button"
                onClick={() => emit('close')}
                aria-label="关闭侧栏"
                title="关闭"
              >
                <CloseOutlined />
              </button>
            </div>
          </div>
          <nav class="quick-sidebar-body" aria-label="论坛导航项目">
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
                        data-discourse-url={item.path}
                        onClick={() => emit('navigate', item.path)}
                        type="button"
                      >
                        {item.icon ? (
                          <span class="quick-sidebar-icon">
                            <svg
                              class="fa d-icon svg-icon"
                              width="1em"
                              height="1em"
                              aria-hidden="true"
                            >
                              <use href={getDiscourseIconHref(item.icon)} />
                            </svg>
                          </span>
                        ) : item.color ? (
                          <span
                            class="quick-sidebar-dot"
                            style={{ backgroundColor: `#${item.color}` }}
                          />
                        ) : (
                          <span class="quick-sidebar-icon quick-sidebar-icon--placeholder" />
                        )}
                        <span class="quick-sidebar-label">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </nav>
        </aside>
      </div>
    )
  }
})
