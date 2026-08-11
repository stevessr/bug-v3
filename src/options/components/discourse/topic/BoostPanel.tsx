import DOMPurify from 'dompurify'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'

import type { Boost, DiscourseFlagType, DiscoursePost } from '../types'
import { deleteBoost, fetchFlagTypes, flagBoost } from '../actions'
import { getAvatarUrl } from '../utils'
import { ensureEmojiShortcodesLoaded } from '../linux.do/emojis'
import { replaceEmojiShortcodesInHtml } from '../bbcode'
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
    const emojiReadyToken = ref(0)
    const selectedBoostId = ref<number | null>(null)
    const deletingIds = ref(new Set<number>())
    const flagTargetBoost = ref<Boost | null>(null)
    const flagMessage = ref('')
    const flagSubmitting = ref(false)
    const flagTypesLoading = ref(false)
    const flagTypes = ref<DiscourseFlagType[]>([])
    const selectedFlagTypeId = ref<number | null>(null)
    const flagModalOpen = ref(false)

    const boosts = computed(() => props.post.boosts || [])
    const hasBoosts = computed(() => boosts.value.length > 0)
    const selectedFlagType = computed(
      () => flagTypes.value.find(type => type.id === selectedFlagTypeId.value) || null
    )

    const replaceBoosts = (next: Boost[]) => {
      props.post.boosts = next
    }

    const isOwnBoost = (boost: Boost) =>
      !!props.currentUsername &&
      boost.user.username.toLowerCase() === props.currentUsername.toLowerCase()

    const renderBoostHtml = (cooked: string) => {
      const safe = sanitizeBoostHtml(cooked)
      if (!emojiReadyToken.value) return safe
      // boost 中的表情短码自动渲染为站点表情
      return sanitizeBoostHtml(replaceEmojiShortcodesInHtml(safe))
    }

    const toggleSelect = (boost: Boost) => {
      selectedBoostId.value = selectedBoostId.value === boost.id ? null : boost.id
    }

    const handleDeleteBoost = async (boost: Boost) => {
      if (!boost.can_delete || deletingIds.value.has(boost.id)) return
      const own = isOwnBoost(boost)
      // eslint-disable-next-line no-alert
      const confirmed = window.confirm(
        own ? '确定删除自己的 Boost 吗？此操作无法撤销。' : '确定删除此 Boost 吗？此操作无法撤销。'
      )
      if (!confirmed) return
      deletingIds.value.add(boost.id)
      try {
        await deleteBoost(props.baseUrl, boost.id)
        replaceBoosts(boosts.value.filter(item => item.id !== boost.id))
        if (own) props.post.can_boost = true
        if (selectedBoostId.value === boost.id) selectedBoostId.value = null
        message.success('Boost 已删除')
      } catch (error) {
        message.error(error instanceof Error ? error.message : '删除 Boost 失败')
      } finally {
        deletingIds.value.delete(boost.id)
      }
    }

    const handleFlagBoost = async (boost: Boost) => {
      if (!boost.can_flag || isOwnBoost(boost)) return
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

    onMounted(() => {
      void ensureEmojiShortcodesLoaded(props.baseUrl).then(count => {
        if (count > 0) emojiReadyToken.value++
      })
    })

    watch(
      () => props.baseUrl,
      async value => {
        if (!value) return
        const count = await ensureEmojiShortcodesLoaded(value)
        if (count > 0) emojiReadyToken.value++
      }
    )

    return () => (
      <div class="boost-panel">
        {hasBoosts.value && (
          <div class="boost-panel__list" aria-label="Boost 列表">
            {boosts.value.map(boost => {
              const selected = selectedBoostId.value === boost.id
              const showFlag = selected && boost.can_flag && !isOwnBoost(boost)
              const showDelete = selected && boost.can_delete
              return (
                <div
                  key={boost.id}
                  class={['boost-panel__item', selected ? 'is-selected' : '']}
                  onClick={() => toggleSelect(boost)}
                  role="button"
                  tabindex={0}
                  aria-pressed={selected}
                  title={selected ? '收起操作' : '展开操作'}
                  onKeydown={(event: KeyboardEvent) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      toggleSelect(boost)
                    }
                  }}
                >
                  <img
                    src={getAvatarUrl(boost.user.avatar_template, props.baseUrl, 24)}
                    alt={boost.user.username}
                    class="boost-panel__avatar"
                    title={boost.user.username}
                    data-user-card={boost.user.username}
                  />
                  <span class="boost-panel__cooked" innerHTML={renderBoostHtml(boost.cooked)} />
                  {showFlag && (
                    <button
                      type="button"
                      class="boost-panel__action boost-panel__action--flag"
                      title="举报 Boost"
                      aria-label="举报 Boost"
                      onClick={(event: MouseEvent) => {
                        event.stopPropagation()
                        void handleFlagBoost(boost)
                      }}
                    >
                      ⚑
                    </button>
                  )}
                  {showDelete && (
                    <button
                      type="button"
                      class="boost-panel__action boost-panel__action--delete"
                      title="删除 Boost"
                      aria-label="删除 Boost"
                      disabled={deletingIds.value.has(boost.id)}
                      onClick={(event: MouseEvent) => {
                        event.stopPropagation()
                        void handleDeleteBoost(boost)
                      }}
                    >
                      🗑
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

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
                  <div innerHTML={renderBoostHtml(flagTargetBoost.value.cooked)} />
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
