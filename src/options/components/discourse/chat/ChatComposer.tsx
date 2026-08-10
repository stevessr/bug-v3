import { defineComponent, shallowRef, ref, watch } from 'vue'
import {
  LoadingOutlined,
  PaperClipOutlined,
  CloseOutlined,
  SmileOutlined
} from '@ant-design/icons-vue'

import type { ChatMessage } from '../types'
import { useDiscourseUpload } from '../composables/useDiscourseUpload'
import DiscourseEmojiPicker from '../emoji/DiscourseEmojiPicker'
import '../css/chat/ChatComposer.css'

export default defineComponent({
  name: 'ChatComposer',
  props: {
    disabled: { type: Boolean, required: true },
    replyTo: { type: Object as () => ChatMessage | null, default: null },
    editingMessage: { type: Object as () => ChatMessage | null, default: null },
    baseUrl: { type: String, required: true },
    channelId: { type: Number, required: true }
  },
  emits: ['send', 'cancelReply', 'cancelEdit', 'uploadStart', 'uploadEnd'],
  setup(props, { emit }) {
    const message = shallowRef('')
    const textareaRef = ref<HTMLTextAreaElement | null>(null)
    const emojiButtonRef = ref<HTMLButtonElement | null>(null)
    const showEmojiPicker = ref(false)

    // Upload integration
    const { handleUploadClick, handleUploadChange, fileInputRef, isUploading, uploadFile } =
      useDiscourseUpload({
        baseUrl: props.baseUrl,
        inputFormat: () => 'markdown',
        onInsertText: (text: string) => {
          message.value = message.value + text
        }
      })

    watch(isUploading, val => {
      if (val) emit('uploadStart')
      else emit('uploadEnd')
    })

    // Focus textarea when entering edit/reply mode
    watch(
      () => props.editingMessage,
      msg => {
        if (msg) {
          message.value = msg.message || ''
          nextTickFocus()
        }
      }
    )

    watch(
      () => props.replyTo,
      () => {
        nextTickFocus()
      }
    )

    const nextTickFocus = () => {
      requestAnimationFrame(() => {
        textareaRef.value?.focus()
      })
    }

    const handleSend = () => {
      const trimmed = message.value.trim()
      if (!trimmed) return
      emit('send', trimmed)
      message.value = ''
      showEmojiPicker.value = false
    }

    const insertEmojiShortcode = (shortcode: string) => {
      const textarea = textareaRef.value
      const start = textarea?.selectionStart ?? message.value.length
      const end = textarea?.selectionEnd ?? start
      const prefix = message.value.slice(0, start)
      const suffix = message.value.slice(end)
      message.value = `${prefix}${shortcode}${suffix}`
      showEmojiPicker.value = false
      requestAnimationFrame(() => {
        const cursor = start + shortcode.length
        textareaRef.value?.focus()
        textareaRef.value?.setSelectionRange(cursor, cursor)
      })
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        handleSend()
      }
    }

    const handlePaste = async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (!items) return
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.startsWith('image/')) {
          event.preventDefault()
          const file = item.getAsFile()
          if (file) {
            emit('uploadStart')
            try {
              await uploadFile(file)
            } catch {
              // upload error handled inside composable
            } finally {
              emit('uploadEnd')
            }
          }
          return
        }
      }
    }

    const placeholder = props.editingMessage
      ? '编辑消息...'
      : props.replyTo
        ? '回复消息...'
        : '输入消息，回车发送'

    const getReplyPreviewText = () => {
      if (!props.replyTo) return ''
      const username = props.replyTo.user?.username || props.replyTo.username || '匿名'
      const text = props.replyTo.message || props.replyTo.cooked || ''
      const plainText = text.replace(/<[^>]*>/g, '').slice(0, 80)
      return `回复 @${username}: ${plainText}${plainText.length >= 80 ? '...' : ''}`
    }

    return () => (
      <div
        class={[
          'chat-composer',
          props.replyTo ? 'has-reply' : '',
          props.editingMessage ? 'is-editing' : ''
        ]}
      >
        {props.replyTo && (
          <div class="chat-composer-reply-banner">
            <span class="chat-composer-reply-text">{getReplyPreviewText()}</span>
            <button
              type="button"
              class="chat-composer-reply-cancel"
              onClick={() => emit('cancelReply')}
              title="取消回复"
              aria-label="取消回复"
            >
              <CloseOutlined />
            </button>
          </div>
        )}
        {props.editingMessage && (
          <div class="chat-composer-edit-banner">
            <span class="chat-composer-edit-text">编辑消息</span>
            <button
              type="button"
              class="chat-composer-edit-cancel"
              onClick={() => {
                message.value = ''
                emit('cancelEdit')
              }}
              title="取消编辑"
              aria-label="取消编辑"
            >
              <CloseOutlined />
            </button>
          </div>
        )}
        <div class="chat-composer-input-row">
          <textarea
            ref={textareaRef}
            value={message.value}
            class="chat-composer-input"
            disabled={props.disabled}
            placeholder={placeholder}
            aria-label={placeholder}
            rows={2}
            onKeydown={handleKeydown}
            onPaste={handlePaste}
            onInput={(e: Event) => (message.value = (e.target as HTMLTextAreaElement).value)}
          />
          <div class="chat-composer-actions">
            <button
              ref={emojiButtonRef}
              type="button"
              class="chat-composer-emoji-btn discourse-emoji-picker-trigger"
              disabled={props.disabled}
              onPointerdown={(event: PointerEvent) => event.stopPropagation()}
              onClick={() => (showEmojiPicker.value = !showEmojiPicker.value)}
              title="插入当前站点表情"
              aria-label="插入当前站点表情"
              aria-expanded={showEmojiPicker.value}
            >
              <SmileOutlined />
            </button>
            <button
              type="button"
              class="chat-composer-upload-btn"
              disabled={props.disabled}
              onClick={handleUploadClick}
              title="上传文件或图片"
              aria-label={isUploading.value ? '正在上传附件' : '上传文件或图片'}
            >
              {isUploading.value ? <LoadingOutlined /> : <PaperClipOutlined />}
            </button>
            <button
              type="button"
              class="chat-composer-send"
              disabled={props.disabled || !message.value.trim()}
              onClick={handleSend}
            >
              {props.editingMessage ? '保存' : '发送'}
            </button>
          </div>
          <DiscourseEmojiPicker
            visible={showEmojiPicker.value}
            baseUrl={props.baseUrl}
            mode="shortcode"
            anchorEl={emojiButtonRef.value}
            onSelect={insertEmojiShortcode}
            onClose={() => (showEmojiPicker.value = false)}
          />
          <input
            ref={fileInputRef}
            type="file"
            class="chat-composer-file-input"
            multiple
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
            onChange={handleUploadChange}
          />
        </div>
        {isUploading.value && <div class="chat-composer-uploading">上传中...</div>}
      </div>
    )
  }
})
