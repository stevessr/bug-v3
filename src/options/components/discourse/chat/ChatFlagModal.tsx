import { computed, defineComponent, ref, watch, type PropType } from 'vue'
import { Input, Modal, Radio, Spin } from 'ant-design-vue'

import type { ChatMessage, DiscourseFlagType } from '../types'
import { sanitizeDiscourseHtml } from '../sanitizeHtml'

import '../css/chat/ChatFlagModal.css'

const plainText = (value?: string) =>
  String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export default defineComponent({
  name: 'ChatFlagModal',
  props: {
    open: { type: Boolean, required: true },
    message: { type: Object as PropType<ChatMessage | null>, default: null },
    flagTypes: { type: Array as PropType<DiscourseFlagType[]>, default: () => [] },
    loading: { type: Boolean, default: false },
    submitting: { type: Boolean, default: false },
    onCancel: { type: Function as PropType<() => void>, required: true },
    onSubmit: {
      type: Function as PropType<(flagTypeId: number, message: string) => void>,
      required: true
    }
  },
  setup(props) {
    const selectedFlagType = ref<number | null>(null)
    const details = ref('')

    const selectedFlagInfo = computed(() =>
      props.flagTypes.find(type => type.id === selectedFlagType.value)
    )
    const requiresMessage = computed(() => Boolean(selectedFlagInfo.value?.require_message))
    const canSubmit = computed(
      () =>
        !props.loading &&
        !props.submitting &&
        selectedFlagType.value !== null &&
        (!requiresMessage.value || Boolean(details.value.trim()))
    )
    const targetUsername = computed(
      () => props.message?.user?.username || props.message?.username || ''
    )
    const messagePreview = computed(() => {
      const content = plainText(props.message?.message || props.message?.cooked)
      return content.length > 180 ? `${content.slice(0, 177)}…` : content
    })

    const formatDescription = (description: string) => {
      const username = targetUsername.value.trim()
      if (!username) return description
      return description
        .replace(/@%\{username\}/g, () => `@${username}`)
        .replace(/%\{username\}/g, () => username)
    }

    watch(
      () => props.open,
      open => {
        if (!open) return
        selectedFlagType.value = null
        details.value = ''
      }
    )

    const handleSubmit = () => {
      if (!canSubmit.value || selectedFlagType.value === null) return
      props.onSubmit(selectedFlagType.value, details.value.trim())
    }

    return () => (
      <Modal
        open={props.open}
        title="举报聊天消息"
        okText="提交举报"
        cancelText="取消"
        width="520px"
        maskClosable={!props.submitting}
        closable={!props.submitting}
        onCancel={props.onCancel}
        onOk={handleSubmit}
        okButtonProps={{ disabled: !canSubmit.value }}
        confirmLoading={props.submitting}
      >
        <div class="chat-flag-modal">
          {messagePreview.value && (
            <div class="chat-flag-modal__target" aria-label="将要举报的消息">
              <span>{targetUsername.value ? `@${targetUsername.value}` : '聊天消息'}</span>
              <p>{messagePreview.value}</p>
            </div>
          )}

          {props.loading ? (
            <div class="chat-flag-modal__state" role="status">
              <Spin /> 正在加载举报类型…
            </div>
          ) : props.flagTypes.length === 0 ? (
            <div class="chat-flag-modal__state">站点没有提供可用于聊天消息的举报类型</div>
          ) : (
            <>
              <p class="chat-flag-modal__hint">请选择举报理由：</p>
              <Radio.Group
                value={selectedFlagType.value}
                class="chat-flag-modal__options"
                onChange={(event: { target?: { value?: number } }) => {
                  selectedFlagType.value = Number(event.target?.value) || null
                }}
              >
                {props.flagTypes.map(flagType => (
                  <label
                    key={flagType.id}
                    class={[
                      'chat-flag-modal__option',
                      selectedFlagType.value === flagType.id ? 'is-selected' : ''
                    ]}
                  >
                    <Radio value={flagType.id}>
                      <span class="chat-flag-modal__option-name">{flagType.name}</span>
                    </Radio>
                    {flagType.description && (
                      <span
                        class="chat-flag-modal__option-description"
                        innerHTML={sanitizeDiscourseHtml(formatDescription(flagType.description))}
                      />
                    )}
                  </label>
                ))}
              </Radio.Group>

              {selectedFlagInfo.value && (
                <div class="chat-flag-modal__details">
                  {requiresMessage.value && (
                    <p class="chat-flag-modal__required">此举报理由需要填写详细说明</p>
                  )}
                  <Input.TextArea
                    value={details.value}
                    rows={3}
                    maxlength={500}
                    showCount
                    aria-label="举报补充说明"
                    placeholder={
                      requiresMessage.value ? '请详细描述问题（必填）' : '补充说明（可选）'
                    }
                    onChange={(event: { target?: { value?: string } }) => {
                      details.value = event.target?.value || ''
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
    )
  }
})
