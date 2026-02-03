import { defineComponent, shallowRef } from 'vue'
import '../css/chat/ChatComposer.css'

export default defineComponent({
  name: 'ChatComposer',
  props: {
    disabled: { type: Boolean, required: true }
  },
  emits: ['send'],
  setup(props, { emit }) {
    const message = shallowRef('')

    const handleSend = () => {
      const trimmed = message.value.trim()
      if (!trimmed) return
      emit('send', trimmed)
      message.value = ''
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        handleSend()
      }
    }

    return () => (
      <div class="chat-composer">
        <textarea
          value={message.value}
          class="chat-composer-input"
          disabled={props.disabled}
          placeholder="输入消息，回车发送"
          rows={2}
          onKeydown={handleKeydown}
          onInput={(e: Event) => (message.value = (e.target as HTMLTextAreaElement).value)}
        />
        <button
          class="chat-composer-send"
          disabled={props.disabled || !message.value.trim()}
          onClick={handleSend}
        >
          发送
        </button>
      </div>
    )
  }
})
