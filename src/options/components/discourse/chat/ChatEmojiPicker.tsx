import { defineComponent, ref, onMounted, onUnmounted } from 'vue'

const QUICK_EMOJIS = [
  '👍', '❤️', '😄', '🎉', '😢', '🙏',
  '🔥', '👀', '💯', '✅', '❌', '⭐',
  '😂', '🤔', '😮', '🙌', '💪', '👏',
  '🥳', '😎', '🤗', '💖', '✨', '🆒'
]

export default defineComponent({
  name: 'ChatEmojiPicker',
  props: {
    visible: { type: Boolean, required: true }
  },
  emits: ['select', 'close'],
  setup(props, { emit }) {
    const pickerRef = ref<HTMLDivElement | null>(null)

    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.value && !pickerRef.value.contains(e.target as Node)) {
        emit('close')
      }
    }

    onMounted(() => {
      document.addEventListener('mousedown', handleClickOutside)
    })

    onUnmounted(() => {
      document.removeEventListener('mousedown', handleClickOutside)
    })

    return () => {
      if (!props.visible) return null
      return (
        <div ref={pickerRef} class="chat-emoji-picker">
          <div class="chat-emoji-picker-title">快速反应</div>
          <div class="chat-emoji-picker-grid">
            {QUICK_EMOJIS.map(emoji => (
              <button
                key={emoji}
                class="chat-emoji-picker-item"
                onClick={() => emit('select', emoji)}
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )
    }
  }
})
