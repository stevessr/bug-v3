import DOMPurify from 'dompurify'
import { computed, defineComponent, nextTick, ref } from 'vue'
import { message } from 'ant-design-vue'

import type { Boost, DiscourseFlagType, DiscoursePost } from '../types'
import { createBoost, deleteBoost, fetchFlagTypes, flagBoost } from '../actions'
import { getAvatarUrl } from '../utils'
import DiscourseEmojiPicker from '../emoji/DiscourseEmojiPicker'
import '../css/BoostPanel.css'

const sanitizeBoostHtml = (html: string) =>
  DOMPurify.sanitize(html || '', {
    ADD_ATTR: ['target', 'rel', 'class', 'title', 'alt', 'loading', 'width', 'height'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form']
  })

const appliesToBoost = (type: DiscourseFlagType) =>
  !type.applies_to?.length ||
  type.applies_to.some(value =>
    ['DiscourseBoosts::Boost', 'Boost'].includes(String(value || '').trim())
  )

export default defineComponent({
  name: 'BoostPanel',
  props: {
    post: { type: Object as () => DiscoursePost, required: true },
    baseUrl: { type: String, required: true },
    currentUsername: { type: String, default: '' }
  },
  setup(props) {
    const showInput = ref(false)
    const showEmojiPicker = ref(false)
    const boostText = ref('')
    const inputRef = ref<HTMLTextAreaElement | null>(null)
    const emojiButtonRef = ref<HTMLButtonElement | null>(null)
    const submitting = ref(false)
    const deletingIds = ref(new Set<number>())
    const flagTargetBoost = ref<Boost | null>(null)
    const flagMessage = ref('')
    const flagSubmitting = ref(false)
    const flagTypesLoading = ref(false)
    const flagTypes = ref<DiscourseFlagType[]>([])
    const selectedFlagTypeId = ref<number | null>(null)
    const flagModalOpen = ref(false)

    const boosts = computed(() => props.post.boosts || [])
    const canBoost = computed(() => props.post.can_boost ?? false)
    const hasBoosts = computed(() => boosts.value.length > 0)
    const selectedFlagType = computed(
      () => flagTypes.value.find(type => type.id === selectedFlagTypeId.value) || null
    )

    const replaceBoosts = (next: Boost[]) => {
      props.post.boosts = next
    }

    const handleAddBoost = () => {
      showInput.value = !showInput.value
      showEmojiPicker.value = false
      if (!showInput.value) boostText.value = ''
      if (showInput.value) void nextTick(() => inputRef.value?.focus())
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
        const created = await createBoost(props.baseUrl, props.post.id, text)
        if (created?.id) replaceBoosts([...boosts.value, created as Boost])
        props.post.can_boost = false
        handleCancelBoost()
        message.success('Boost 已添加')
      } catch (error) {
        message.error(error instanceof Error ? error.message : '添加 Boost 失败')
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
      if (!boost.can_delete || deletingIds.value.has(boost.id)) return
      const isOwnBoost =
        !!props.currentUsername &&
        boost.user.username.toLowerCase() === props.currentUsername.toLowerCase()
      // eslint-disable-next-line no-alert
      const confirmed = window.confirm(
        isOwnBoost
          ? '确定删除自己的 Boost 吗？此操作无法撤销。'
          : '确定删除此 Boost 吗？此操作无法撤销。'
      )
      if (!confirmed) {
        return
      }
      deletingIds.value.add(boost.id)
      try {
        await deleteBoost(props.baseUrl, boost.id)
        replaceBoosts(boosts.value.filter(item => item.id !== boost.id))
        if (isOwnBoost) props.post.can_boost = true
        message.success('Boost 已删除')
      } catch (error) {
        message.error(error instanceof Error ? error.message : '删除 Boost 失败')
      } finally {
        deletingIds.value.delete(boost.id)
      }
    }

    const handleFlagBoost = async (boost: Boost) => {
      if (!boost.can_flag) return
      flagTargetBoost.value = boost
      flagMessage.value = ''
      flagTypes.value = []
      selectedFlagTypeId.value = null
      flagModalOpen.value = true
      flagTypesLoading.value = true
      try {
        const available = new Set(boost.available_flags || [])
        const types = (await fetchFlagTypes(props.baseUrl)).filter(
          type => appliesToBoost(type) && (!available.size || available.has(type.name_key))
        )
        flagTypes.value = types
        selectedFlagTypeId.value = types[0]?.id ?? null
        if (!types.length) message.error('站点没有提供可用的 Boost 举报理由')
      } catch (error) {
        message.error(error instanceof Error ? error.message : '获取举报理由失败')
      } finally {
        flagTypesLoading.value = false
      }
    }

    const handleFlagSubmit = async () => {
      if (!flagTargetBoost.value || !selectedFlagTypeId.value || flagSubmitting.value) return
      if (selectedFlagType.value?.require_message && !flagMessage.value.trim()) {
        message.warning('此举报理由需要填写说明')
        return
      }
      flagSubmitting.value = true
      try {
        await flagBoost(props.baseUrl, flagTargetBoost.value.id, {
          flagTypeId: selectedFlagTypeId.value,
          message: flagMessage.value.trim() || undefined,
          takeAction: false,
          queueForReview: false
        })
        const target = boosts.value.find(item => item.id === flagTargetBoost.value?.id)
        if (target) {
          target.can_flag = false
          target.user_flag_status = selectedFlagTypeId.value
        }
        message.success('Boost 已举报')
        flagModalOpen.value = false
        flagTargetBoost.value = null
      } catch (error) {
        message.error(error instanceof Error ? error.message : '举报 Boost 失败')
      } finally {
        flagSubmitting.value = false
      }
    }

    const handleFlagCancel = () => {
      if (flagSubmitting.value) return
      flagModalOpen.value = false
      flagTargetBoost.value = null
      flagMessage.value = ''
      flagTypes.value = []
      selectedFlagTypeId.value = null
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
                  data-user-card={boost.user.username}
                />
                <span class="boost-panel__cooked" innerHTML={sanitizeBoostHtml(boost.cooked)} />
                {boost.can_flag && (
                  <button
                    type="button"
                    class="boost-panel__action boost-panel__action--flag"
                    title="举报 Boost"
                    aria-label="举报 Boost"
                    onClick={() => void handleFlagBoost(boost)}
                  >
                    ⚑
                  </button>
                )}
                {boost.can_delete && (
                  <button
                    type="button"
                    class="boost-panel__action boost-panel__action--delete"
                    title="删除 Boost"
                    aria-label="删除 Boost"
                    disabled={deletingIds.value.has(boost.id)}
                    onClick={() => void handleDeleteBoost(boost)}
                  >
                    🗑
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div class="boost-panel__actions">
          {canBoost.value && !showInput.value && (
            <button
              type="button"
              class="boost-panel__add-btn boost-panel__icon-btn"
              title="添加 Boost"
              aria-label="添加 Boost"
              onClick={handleAddBoost}
            >
              ⬆
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
                  ref={emojiButtonRef}
                  type="button"
                  class="boost-panel__emoji-btn discourse-emoji-picker-trigger"
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
              <div class="boost-panel__composer-footer">
                <span class="boost-panel__helper">Ctrl/⌘ + Enter 发送</span>
                <div class="boost-panel__composer-actions">
                  <button
                    type="button"
                    class="boost-panel__cancel-btn boost-panel__icon-btn"
                    title="取消"
                    aria-label="取消"
                    onClick={handleCancelBoost}
                  >
                    ×
                  </button>
                  <button
                    type="button"
                    class="boost-panel__send-btn boost-panel__icon-btn"
                    title={submitting.value ? '发送中' : '发送 Boost'}
                    aria-label={submitting.value ? '发送中' : '发送 Boost'}
                    disabled={submitting.value || !boostText.value.trim()}
                    onClick={() => void handleSubmitBoost()}
                  >
                    {submitting.value ? '…' : '✓'}
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
              <p class="boost-panel__modal-copy">请选择举报理由，举报将交由站点审核。</p>
              {flagTargetBoost.value && (
                <div class="boost-panel__flag-preview">
                  <div innerHTML={sanitizeBoostHtml(flagTargetBoost.value.cooked)} />
                  <div class="boost-panel__flag-user">@{flagTargetBoost.value.user.username}</div>
                </div>
              )}
              {flagTypesLoading.value ? (
                <div class="boost-panel__flag-state">正在加载站点举报理由…</div>
              ) : (
                <div class="boost-panel__flag-types" role="radiogroup" aria-label="举报理由">
                  {flagTypes.value.map(type => (
                    <label key={type.id} class="boost-panel__flag-type">
                      <input
                        type="radio"
                        name={`boost-flag-${flagTargetBoost.value?.id || 0}`}
                        value={type.id}
                        checked={selectedFlagTypeId.value === type.id}
                        onChange={() => (selectedFlagTypeId.value = type.id)}
                      />
                      <span>
                        <strong>{type.name || type.name_key}</strong>
                        {(type.short_description || type.description) && (
                          <small>{type.short_description || type.description}</small>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <textarea
                class="boost-panel__flag-message"
                value={flagMessage.value}
                rows="3"
                maxlength="500"
                placeholder={
                  selectedFlagType.value?.require_message ? '补充说明（必填）' : '补充说明（可选）'
                }
                aria-label="举报补充说明"
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
                  disabled={
                    flagSubmitting.value ||
                    flagTypesLoading.value ||
                    !selectedFlagTypeId.value ||
                    Boolean(selectedFlagType.value?.require_message && !flagMessage.value.trim())
                  }
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
