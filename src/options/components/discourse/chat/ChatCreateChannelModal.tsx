import { computed, defineComponent, ref, watch } from 'vue'
import { Input, Spin } from 'ant-design-vue'
import { CloseOutlined, PlusOutlined, SmileOutlined } from '@ant-design/icons-vue'

import type { ChatCreateChannelPayload, DiscourseCategory } from '../types'
import DiscourseEmojiPicker from '../emoji/DiscourseEmojiPicker'
import '../css/chat/ChatCreateGroupModal.css'

export default defineComponent({
  name: 'ChatCreateChannelModal',
  props: {
    open: { type: Boolean, required: true },
    baseUrl: { type: String, required: true },
    categories: { type: Array as () => DiscourseCategory[], default: () => [] },
    creating: { type: Boolean, default: false },
    maxAutoJoinedUsers: { type: Number, default: 0 }
  },
  emits: ['close', 'create'],
  setup(props, { emit }) {
    const categoryId = ref(0)
    const name = ref('')
    const slug = ref('')
    const description = ref('')
    const emoji = ref('')
    const emojiPickerOpen = ref(false)
    const emojiPickerTrigger = ref<HTMLButtonElement | null>(null)
    const threadingEnabled = ref(false)
    const autoJoinUsers = ref(false)

    const categoryNames = computed(
      () => new Map(props.categories.map(category => [category.id, category.name]))
    )

    const categoryOptions = computed(() =>
      props.categories.map(category => ({
        id: category.id,
        label: category.parent_category_id
          ? `${categoryNames.value.get(category.parent_category_id) || '子分类'} / ${category.name}`
          : category.name
      }))
    )

    const canSubmit = computed(() => categoryId.value > 0 && !!name.value.trim() && !props.creating)

    watch(
      () => props.open,
      open => {
        if (!open) return
        categoryId.value = 0
        name.value = ''
        slug.value = ''
        description.value = ''
        emoji.value = ''
        emojiPickerOpen.value = false
        threadingEnabled.value = false
        autoJoinUsers.value = false
      }
    )

    const handleCreate = () => {
      if (!canSubmit.value) return
      const payload: ChatCreateChannelPayload = {
        name: name.value.trim(),
        chatableId: categoryId.value,
        slug: slug.value.trim() || undefined,
        description: description.value.trim() || undefined,
        emoji: emoji.value.trim().replace(/^:([^:]+):$/, '$1') || undefined,
        autoJoinUsers: props.maxAutoJoinedUsers > 0 && autoJoinUsers.value,
        threadingEnabled: threadingEnabled.value
      }
      emit('create', payload)
    }

    const selectChannelEmoji = (value: string) => {
      emoji.value = value.trim().replace(/^:([^:]+):$/, '$1')
      emojiPickerOpen.value = false
    }

    return () => {
      if (!props.open) return null

      return (
        <div class="chat-group-modal">
          <div class="chat-group-modal__backdrop" onClick={() => emit('close')} />
          <section
            class="chat-group-modal__panel"
            role="dialog"
            aria-modal="true"
            aria-label="创建公开频道"
          >
            <div class="chat-group-modal__header">
              <div class="chat-group-modal__title">
                <PlusOutlined /> 创建公开频道
              </div>
              <button
                type="button"
                class="chat-group-modal__close"
                aria-label="关闭创建频道窗口"
                disabled={props.creating}
                onClick={() => emit('close')}
              >
                <CloseOutlined />
              </button>
            </div>

            <div class="chat-group-modal__body">
              <p class="chat-group-modal__hint">
                公开频道会关联一个论坛分类，只有站点开放权限时才可创建。
              </p>

              <label class="chat-group-modal__label" for="chat-create-channel-category">
                所属分类
              </label>
              <select
                id="chat-create-channel-category"
                class="chat-group-modal__field"
                value={categoryId.value}
                disabled={props.creating || categoryOptions.value.length === 0}
                onChange={(event: Event) => {
                  categoryId.value = Number((event.target as HTMLSelectElement).value) || 0
                }}
              >
                <option value={0}>
                  {categoryOptions.value.length > 0 ? '请选择分类' : '没有可用分类'}
                </option>
                {categoryOptions.value.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>

              <label class="chat-group-modal__label" for="chat-create-channel-name">
                频道名称
              </label>
              <Input
                id="chat-create-channel-name"
                value={name.value}
                placeholder="例如：产品交流"
                maxlength={100}
                disabled={props.creating}
                onUpdate:value={(value: string) => (name.value = value)}
              />

              <label class="chat-group-modal__label" for="chat-create-channel-description">
                描述（可选）
              </label>
              <textarea
                id="chat-create-channel-description"
                class="chat-group-modal__field chat-group-modal__textarea"
                value={description.value}
                maxlength={500}
                placeholder="说明频道用途"
                disabled={props.creating}
                onInput={(event: Event) => {
                  description.value = (event.target as HTMLTextAreaElement).value
                }}
              />

              <div class="chat-group-modal__field-grid">
                <div>
                  <label class="chat-group-modal__label" for="chat-create-channel-slug">
                    Slug（可选）
                  </label>
                  <Input
                    id="chat-create-channel-slug"
                    value={slug.value}
                    placeholder="product-chat"
                    disabled={props.creating}
                    onUpdate:value={(value: string) => (slug.value = value)}
                  />
                </div>
                <div>
                  <label class="chat-group-modal__label" for="chat-create-channel-emoji">
                    频道表情（可选）
                  </label>
                  <div class="chat-group-modal__emoji-control">
                    <Input
                      id="chat-create-channel-emoji"
                      value={emoji.value}
                      placeholder="speech_balloon"
                      disabled={props.creating}
                      onUpdate:value={(value: string) => (emoji.value = value)}
                    />
                    <button
                      ref={emojiPickerTrigger}
                      type="button"
                      class="chat-group-modal__emoji-picker-trigger discourse-emoji-picker-trigger"
                      disabled={props.creating}
                      aria-label="选择频道表情"
                      aria-expanded={emojiPickerOpen.value}
                      onClick={() => (emojiPickerOpen.value = !emojiPickerOpen.value)}
                    >
                      <SmileOutlined />
                    </button>
                  </div>
                  <DiscourseEmojiPicker
                    visible={emojiPickerOpen.value}
                    baseUrl={props.baseUrl}
                    mode="shortcode"
                    anchorEl={emojiPickerTrigger.value}
                    onSelect={selectChannelEmoji}
                    onClose={() => (emojiPickerOpen.value = false)}
                  />
                </div>
              </div>

              <label class="chat-group-modal__check">
                <input
                  type="checkbox"
                  checked={threadingEnabled.value}
                  disabled={props.creating}
                  onChange={(event: Event) => {
                    threadingEnabled.value = (event.target as HTMLInputElement).checked
                  }}
                />
                <span>
                  <strong>启用消息串</strong>
                  <small>允许在频道内创建分组讨论</small>
                </span>
              </label>

              {props.maxAutoJoinedUsers > 0 && (
                <label class="chat-group-modal__check">
                  <input
                    type="checkbox"
                    checked={autoJoinUsers.value}
                    disabled={props.creating}
                    onChange={(event: Event) => {
                      autoJoinUsers.value = (event.target as HTMLInputElement).checked
                    }}
                  />
                  <span>
                    <strong>用户自动加入</strong>
                    <small>站点允许自动加入不超过 {props.maxAutoJoinedUsers} 名用户</small>
                  </span>
                </label>
              )}
            </div>

            <div class="chat-group-modal__footer">
              <button
                type="button"
                class="chat-group-modal__cancel"
                disabled={props.creating}
                onClick={() => emit('close')}
              >
                取消
              </button>
              <button
                type="button"
                class="chat-group-modal__create"
                aria-label="创建频道"
                disabled={!canSubmit.value}
                onClick={handleCreate}
              >
                {props.creating ? <Spin size="small" /> : <PlusOutlined />}
                创建频道
              </button>
            </div>
          </section>
        </div>
      )
    }
  }
})
