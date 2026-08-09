import DOMPurify from 'dompurify'
import { computed, defineComponent, nextTick, ref } from 'vue'
import { message } from 'ant-design-vue'

import type { Boost, DiscoursePost } from '../types'
import { createBoost, deleteBoost, flagBoost } from '../actions'
import { getAvatarUrl } from '../utils'
import DiscourseEmojiPicker from '../emoji/DiscourseEmojiPicker'
import '../css/BoostPanel.css'

const sanitizeBoostHtml = (html: string) =>
  DOMPurify.sanitize(html || '', {
    ADD_ATTR: ['target', 'rel', 'class', 'title', 'alt', 'loading', 'width', 'height'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form']
  })

export default defineComponent({
  name: 'BoostPanel',
  props: {
    post: { type: Object as () => DiscoursePost, required: true },
    baseUrl: { type: String, required: true }
  },
  emits: ['refresh'],
  setup(props, { emit }) {
    const showInput = ref(false)
    const showEmojiPicker = ref(false)
    const boostText = ref('')
    const inputRef = ref<HTMLTextAreaElement | null>(null)
    const submitting = ref(false)
    const flagTargetBoost = ref<Boost | null>(null)
    const flagMessage = ref('')
    const flagSubmitting = ref(false)
    const flagModalOpen = ref(false)

    const boosts = computed(() => props.post.boosts || [])
    const canBoost = computed(() => props.post.can_boost ?? false)
    const hasBoosts = computed(() => boosts.value.length > 0)

    const handleAddBoost = () => {
      showInput.value = !showInput.value
      showEmojiPicker.value = false
      if (!showInput.value) boostText.value = ''
      if (showInput.value) {
        void nextTick(() => inputRef.value?.focus())
      }
    }

    const handleCancelBoost = () => {
      showInput.value = false
      showEmojiPicker.value = false
      boostText.value = ''
    }

    const handleSubmitBoost = async () => {
      if (submitting.value) return
      const text = boostText.value.trim()
      if (!text) return
      submitting.value = true
      try {
        await createBoost(props.baseUrl, props.post.id, text)
        handleCancelBoost()
        message.success('Boost 已添加')
        emit('refresh')
      } catch (error) {
        const msg = error instanceof Error ? error.message : '添加 Boost 失败'
        message.error(msg)
      } finally {
        submitting.value = false
      }
    }

    const insertShortcode = (shortcode: string) => {
      const input = inputRef.value
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
        inputRef.value?.focus()
        inputRef.value?.setSelectionRange(nextCursor, nextCursor)
      })
    }

    const handleDeleteBoost = async (boost: Boost) => {
      if (!boost.can_delete) return
      try {
        await deleteBoost(props.baseUrl, boost.id)
        message.success('Boost 已删除')
        emit('refresh')
      } catch (error) {
        const msg = error instanceof Error ? error.message : '删除 Boost 失败'
        message.error(msg)
      }
    }

    const handleFlagBoost = (boost: Boost) => {
      if (!boost.can_flag) return
      flagTargetBoost.value = boost
      flagMessage.value = ''
      flagModalOpen.value = true
    }

    const handleFlagSubmit = async () => {
      if (!flagTargetBoost.value || flagSubmitting.value) return
      flagSubmitting.value = true
      try {
        const flagType = flagTargetBoost.value.available_flags?.[0] || 'inappropriate'
        await flagBoost(
          props.baseUrl,
          flagTargetBoost.value.id,
          flagType,
          flagMessage.value.trim() || undefined
        )
        message.success('Boost 已举报')
        flagModalOpen.value = false
        flagTargetBoost.value = null
        flagMessage.value = ''
        emit('refresh')
      } catch (error) {
        const msg = error instanceof Error ? error.message : '举报 Boost 失败'
        message.error(msg)
      } finally {
        flagSubmitting.value = false
      }
    }

    const handleFlagCancel = () => {
      if (flagSubmitting.value) return
      flagModalOpen.value = false
      flagTargetBoost.value = null
      flagMessage.value = ''
    }

    return () => (
      <div class="boost-panel">
        {hasBoosts.value && (
          <div class="boost-panel__list" aria-label="Boost 列表">
            {boosts.value.map(boost => (
              <div key={boost.id} class="boost-panel__item">
                <img
                  src={getAvatarUrl(boost.user.avatar_template, props.baseUrl, 24)}
                  alt={boost.user.username}
                  class="boost-panel__avatar"
                  title={boost.user.username}
                />
                <span class="boost-panel__cooked" innerHTML={sanitizeBoostHtml(boost.cooked)} />
                {boost.can_delete && (
                  <button
                    type="button"
                    class="boost-panel__action boost-panel__action--delete"
                    title="删除 Boost"
                    aria-label="删除 Boost"
                    onClick={() => void handleDeleteBoost(boost)}
                  >
                    ×
                  </button>
                )}
                {boost.can_flag && (
                  <button
                    type="button"
                    class="boost-panel__action boost-panel__action--flag"
                    title="举报 Boost"
                    aria-label="举报 Boost"
                    onClick={() => handleFlagBoost(boost)}
                  >
                    !
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div class="boost-panel__actions">
          {canBoost.value && !showInput.value && (
            <button type="button" class="boost-panel__add-btn" onClick={handleAddBoost}>
              <span aria-hidden="true">✎</span> Boost
            </button>
          )}

          {showInput.value && (
            <div class="boost-panel__composer">
              <div class="boost-panel__input-wrap">
                <textarea
                  ref={inputRef}
                  class="boost-panel__textarea"
                  value={boostText.value}
                  maxlength="1000"
                  rows="2"
                  placeholder="写一点 Boost 内容…"
                  aria-label="Boost 内容"
                  onInput={(event: Event) => {
                    boostText.value = (event.target as HTMLTextAreaElement).value
                  }}
                  onKeydown={(event: KeyboardEvent) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                      event.preventDefault()
                      void handleSubmitBoost()
                    }
                  }}
                />
                <button
                  type="button"
                  class="boost-panel__emoji-btn discourse-emoji-picker-trigger"
                  aria-label="插入站点表情短码"
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
                  onSelect={insertShortcode}
                  onClose={() => (showEmojiPicker.value = false)}
                />
              </div>
              <div class="boost-panel__composer-footer">
                <span class="boost-panel__helper">Ctrl/⌘ + Enter 发送</span>
                <div class="boost-panel__composer-actions">
                  <button type="button" class="boost-panel__cancel-btn" onClick={handleCancelBoost}>
                    取消
                  </button>
                  <button
                    type="button"
                    class="boost-panel__send-btn"
                    disabled={submitting.value || !boostText.value.trim()}
                    onClick={() => void handleSubmitBoost()}
                  >
                    {submitting.value ? '发送中…' : '发送'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {flagModalOpen.value && (
          <div class="boost-panel__modal" role="dialog" aria-modal="true" aria-label="举报 Boost">
            <button
              type="button"
              class="boost-panel__modal-backdrop"
              aria-label="关闭举报窗口"
              onClick={handleFlagCancel}
            />
            <div class="boost-panel__modal-card">
              <div class="boost-panel__modal-header">
                <strong>举报 Boost</strong>
                <button type="button" onClick={handleFlagCancel} aria-label="关闭">
                  ×
                </button>
              </div>
              <p class="boost-panel__modal-copy">确认要举报此 Boost 吗？</p>
              {flagTargetBoost.value && (
                <div class="boost-panel__flag-preview">
                  <div innerHTML={sanitizeBoostHtml(flagTargetBoost.value.cooked)} />
                  <div class="boost-panel__flag-user">@{flagTargetBoost.value.user.username}</div>
                </div>
              )}
              <textarea
                class="boost-panel__flag-message"
                value={flagMessage.value}
                rows="3"
                maxlength="500"
                placeholder="补充说明（可选）"
                onInput={(event: Event) => {
                  flagMessage.value = (event.target as HTMLTextAreaElement).value
                }}
              />
              <div class="boost-panel__modal-actions">
                <button type="button" class="boost-panel__cancel-btn" onClick={handleFlagCancel}>
                  取消
                </button>
                <button
                  type="button"
                  class="boost-panel__send-btn is-danger"
                  disabled={flagSubmitting.value}
                  onClick={() => void handleFlagSubmit()}
                >
                  {flagSubmitting.value ? '提交中…' : '提交举报'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }
})
