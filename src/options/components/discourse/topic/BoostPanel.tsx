import { defineComponent, ref, computed } from 'vue'
import { Button, Input, message, Modal } from 'ant-design-vue'

import type { Boost, DiscoursePost } from '../types'
import { createBoost, deleteBoost, flagBoost } from '../actions'
import { getAvatarUrl } from '../utils'
import '../css/BoostPanel.css'

export default defineComponent({
  name: 'BoostPanel',
  props: {
    post: { type: Object as () => DiscoursePost, required: true },
    baseUrl: { type: String, required: true }
  },
  emits: ['refresh'],
  setup(props, { emit }) {
    const showInput = ref(false)
    const boostText = ref('')
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
      if (!showInput.value) {
        boostText.value = ''
      }
    }

    const handleSubmitBoost = async () => {
      const text = boostText.value.trim()
      if (!text) return
      submitting.value = true
      try {
        await createBoost(props.baseUrl, props.post.id, text)
        boostText.value = ''
        showInput.value = false
        message.success('Boost 已添加')
        emit('refresh')
      } catch (error) {
        const msg = error instanceof Error ? error.message : '添加 Boost 失败'
        message.error(msg)
      } finally {
        submitting.value = false
      }
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
      if (!flagTargetBoost.value) return
      flagSubmitting.value = true
      try {
        const flagType = flagTargetBoost.value.available_flags?.[0] || 'inappropriate'
        await flagBoost(props.baseUrl, flagTargetBoost.value.id, flagType)
        message.success('Boost 已举报')
        flagModalOpen.value = false
        flagTargetBoost.value = null
        emit('refresh')
      } catch (error) {
        const msg = error instanceof Error ? error.message : '举报 Boost 失败'
        message.error(msg)
      } finally {
        flagSubmitting.value = false
      }
    }

    const handleFlagCancel = () => {
      flagModalOpen.value = false
      flagTargetBoost.value = null
      flagMessage.value = ''
    }

    return () => (
      <div class="boost-panel">
        {hasBoosts.value && (
          <div class="boost-panel__list">
            {boosts.value.map(boost => (
              <div key={boost.id} class="boost-panel__item">
                <img
                  src={getAvatarUrl(boost.user.avatar_template, props.baseUrl, 24)}
                  alt={boost.user.username}
                  class="boost-panel__avatar"
                  title={boost.user.username}
                />
                <span class="boost-panel__cooked" innerHTML={boost.cooked} />
                {boost.can_delete && (
                  <button
                    type="button"
                    class="boost-panel__action boost-panel__action--delete"
                    title="删除"
                    onClick={() => handleDeleteBoost(boost)}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                )}
                {boost.can_flag && (
                  <button
                    type="button"
                    class="boost-panel__action boost-panel__action--flag"
                    title="举报"
                    onClick={() => handleFlagBoost(boost)}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                      <line x1="4" y1="22" x2="4" y2="15" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div class="boost-panel__actions">
          {canBoost.value && !showInput.value && (
            <Button
              size="small"
              type="dashed"
              class="boost-panel__add-btn"
              onClick={handleAddBoost}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                style="margin-right:4px;"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              Boost
            </Button>
          )}

          {showInput.value && (
            <div class="boost-panel__input-area">
              <Input
                size="small"
                placeholder="输入 Boost 内容..."
                value={boostText.value}
                onUpdate:value={value => {
                  boostText.value = String(value)
                }}
                maxlength={1000}
                onPressEnter={handleSubmitBoost}
              />
              <Button
                size="small"
                type="primary"
                loading={submitting.value}
                onClick={handleSubmitBoost}
              >
                发送
              </Button>
              <Button
                size="small"
                onClick={() => {
                  showInput.value = false
                  boostText.value = ''
                }}
              >
                取消
              </Button>
            </div>
          )}
        </div>

        <Modal
          open={flagModalOpen.value}
          title="举报 Boost"
          okText="提交举报"
          cancelText="取消"
          onCancel={handleFlagCancel}
          onOk={handleFlagSubmit}
          confirmLoading={flagSubmitting.value}
        >
          <div class="space-y-3">
            <p class="text-sm text-gray-600 dark:text-gray-400">确认要举报此 Boost 吗？</p>
            {flagTargetBoost.value && (
              <div class="boost-panel__flag-preview">
                <div innerHTML={flagTargetBoost.value.cooked} />
                <div class="text-xs text-gray-500">@{flagTargetBoost.value.user.username}</div>
              </div>
            )}
          </div>
        </Modal>
      </div>
    )
  }
})
