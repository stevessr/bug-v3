import { defineComponent, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { message } from 'ant-design-vue'

import type { Boost, DiscoursePost } from '../types'
import { createBoost } from '../actions'
import DiscourseEmojiPicker from '../emoji/DiscourseEmojiPicker'
import '../css/BoostComposer.css'

export default defineComponent({
  name: 'BoostComposer',
  props: {
    post: { type: Object as () => DiscoursePost, required: true },
    baseUrl: { type: String, required: true },
    open: { type: Boolean, required: true },
    anchorEl: { type: Object as () => HTMLElement | null, default: null }
  },
  emits: ['close'],
  setup(props, { emit }) {
    const boostText = ref('')
    const showEmojiPicker = ref(false)
    const submitting = ref(false)
    const textareaRef = ref<HTMLTextAreaElement | null>(null)
    const emojiButtonRef = ref<HTMLButtonElement | null>(null)
    const panelRef = ref<HTMLDivElement | null>(null)
    const panelStyle = ref<Record<string, string>>({})

    const updatePosition = () => {
      if (typeof window === 'undefined') return
      const padding = 12
      const gap = 8
      const width = Math.min(420, Math.max(300, window.innerWidth - padding * 2))
      const anchor = props.anchorEl?.getBoundingClientRect()

      let left = padding
      let top = padding
      if (anchor) {
        left = Math.max(padding, Math.min(anchor.left, window.innerWidth - width - padding))
        const roomAbove = anchor.top - padding - gap
        const roomBelow = window.innerHeight - anchor.bottom - padding - gap
        if (roomAbove >= 200 || roomAbove >= roomBelow) {
          top = Math.max(padding, anchor.top - 200 - gap)
        } else {
          top = Math.min(window.innerHeight - 200 - padding, anchor.bottom + gap)
        }
      }
      panelStyle.value = {
        left: `${Math.round(left)}px`,
        top: `${Math.round(top)}px`,
        width: `${Math.round(width)}px`
      }
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('.discourse-emoji-picker-trigger')) return
      if (target instanceof Node && props.anchorEl?.contains(target)) return
      if (target instanceof Node && panelRef.value?.contains(target)) return
      if (target instanceof Node && !panelRef.value?.contains(target)) {
        emit('close')
      }
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') emit('close')
    }

    const updateDismissListeners = (visible: boolean) => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeydown)
      window.removeEventListener('resize', updatePosition)
      document.removeEventListener('scroll', updatePosition, true)
      if (visible) {
        document.addEventListener('pointerdown', handlePointerDown, true)
        document.addEventListener('keydown', handleKeydown)
        window.addEventListener('resize', updatePosition)
        document.addEventListener('scroll', updatePosition, true)
      }
    }

    watch(
      () => props.open,
      open => {
        updateDismissListeners(open)
        if (open) {
          boostText.value = ''
          showEmojiPicker.value = false
          void nextTick(() => {
            updatePosition()
            textareaRef.value?.focus()
          })
        }
      },
      { immediate: true }
    )

    watch(
      () => props.anchorEl,
      () => {
        if (props.open) void nextTick(updatePosition)
      }
    )

    onBeforeUnmount(() => updateDismissListeners(false))

    const handleCancel = () => {
      if (submitting.value) return
      boostText.value = ''
      showEmojiPicker.value = false
      emit('close')
    }

    const handleSubmit = async () => {
      if (submitting.value) return
      const text = boostText.value.trim()
      if (!text) return
      submitting.value = true
      try {
        const created = await createBoost(props.baseUrl, props.post.id, text)
        if (created?.id) {
          const boosts = Array.isArray(props.post.boosts) ? [...props.post.boosts] : []
          props.post.boosts = [...boosts, created as Boost]
        }
        props.post.can_boost = false
        handleCancel()
        message.success('Boost 已添加')
      } catch (error) {
        message.error(error instanceof Error ? error.message : '添加 Boost 失败')
      } finally {
        submitting.value = false
      }
    }

    const insertShortcode = (shortcode: string) => {
      const input = textareaRef.value
      const current = boostText.value
      const start = input?.selectionStart ?? current.length
      const end = input?.selectionEnd ?? start
      const needsLeadingSpace = start > 0 && !/\s$/.test(current.slice(0, start))
      const needsTrailingSpace = end < current.length && !/^\s/.test(current.slice(end))
      const insertion = `${needsLeadingSpace ? ' ' : ''}${shortcode}${needsTrailingSpace ? ' ' : ''}`
      boostText.value = `${current.slice(0, start)}${insertion}${current.slice(end)}`
      showEmojiPicker.value = false
      void nextTick(() => {
        const nextCursor = start + insertion.length
        textareaRef.value?.focus()
        textareaRef.value?.setSelectionRange(nextCursor, nextCursor)
      })
    }

    return () =>
      props.open ? (
        <div
          ref={panelRef}
          class="boost-composer"
          style={panelStyle.value}
          role="dialog"
          aria-label="添加 Boost"
        >
          <div class="boost-composer__input-wrap">
            <textarea
              ref={textareaRef}
              class="boost-composer__textarea"
              value={boostText.value}
              maxlength="1000"
              rows="3"
              placeholder="写一点 Boost 内容…"
              aria-label="Boost 内容"
              onInput={(event: Event) => {
                boostText.value = (event.target as HTMLTextAreaElement).value
              }}
              onKeydown={(event: KeyboardEvent) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                  event.preventDefault()
                  void handleSubmit()
                }
              }}
            />
            <button
              ref={emojiButtonRef}
              type="button"
              class="boost-composer__emoji-btn discourse-emoji-picker-trigger"
              aria-label="插入站点表情短码"
              title="插入站点表情短码"
              aria-expanded={showEmojiPicker.value}
              onPointerdown={(event: PointerEvent) => event.stopPropagation()}
              onClick={() => (showEmojiPicker.value = !showEmojiPicker.value)}
            >
              ☺
            </button>
            <DiscourseEmojiPicker
              visible={showEmojiPicker.value}
              baseUrl={props.baseUrl}
              mode="shortcode"
              anchorEl={emojiButtonRef.value}
              onSelect={insertShortcode}
              onClose={() => (showEmojiPicker.value = false)}
            />
          </div>
          <div class="boost-composer__footer">
            <span class="boost-composer__helper">Ctrl/⌘ + Enter 发送</span>
            <div class="boost-composer__actions">
              <button
                type="button"
                class="boost-composer__cancel-btn"
                title="取消"
                aria-label="取消"
                disabled={submitting.value}
                onClick={handleCancel}
              >
                ×
              </button>
              <button
                type="button"
                class="boost-composer__send-btn"
                title={submitting.value ? '发送中' : '发送 Boost'}
                aria-label={submitting.value ? '发送中' : '发送 Boost'}
                disabled={submitting.value || !boostText.value.trim()}
                onClick={() => void handleSubmit()}
              >
                {submitting.value ? '…' : '✓'}
              </button>
            </div>
          </div>
        </div>
      ) : null
  }
})
