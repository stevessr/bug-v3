import { defineComponent, type PropType } from 'vue'

import DiscourseEmojiPicker from '../emoji/DiscourseEmojiPicker'

export default defineComponent({
  name: 'ChatEmojiPicker',
  props: {
    visible: { type: Boolean, required: true },
    baseUrl: { type: String, required: true },
    anchorEl: { type: Object as PropType<HTMLElement | null>, default: null },
    /** 聊天反应始终允许任意表情（不受站点反应白名单限制） */
    allowAnyEmoji: { type: Boolean, default: true }
  },
  emits: ['select', 'close'],
  setup(props, { emit }) {
    return () => (
      <DiscourseEmojiPicker
        visible={props.visible}
        baseUrl={props.baseUrl}
        mode="reaction"
        allowAnyEmoji={props.allowAnyEmoji}
        anchorEl={props.anchorEl}
        onSelect={(emoji: string) => emit('select', emoji)}
        onClose={() => emit('close')}
      />
    )
  }
})
