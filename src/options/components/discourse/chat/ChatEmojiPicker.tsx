import { defineComponent } from 'vue'

import DiscourseEmojiPicker from '../emoji/DiscourseEmojiPicker'

export default defineComponent({
  name: 'ChatEmojiPicker',
  props: {
    visible: { type: Boolean, required: true },
    baseUrl: { type: String, required: true }
  },
  emits: ['select', 'close'],
  setup(props, { emit }) {
    return () => (
      <DiscourseEmojiPicker
        visible={props.visible}
        baseUrl={props.baseUrl}
        mode="reaction"
        onSelect={(emoji: string) => emit('select', emoji)}
        onClose={() => emit('close')}
      />
    )
  }
})
