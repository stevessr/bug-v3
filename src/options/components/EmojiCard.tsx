/* @jsxImportSource vue */
import { defineComponent } from 'vue'
import { Popconfirm } from 'ant-design-vue'
import { QuestionCircleOutlined, TagOutlined } from '@ant-design/icons-vue'

import EmojiTags from './EmojiTags.vue'

import CachedImage from '@/components/CachedImage.vue'
import type { Emoji } from '@/types/type'

export default defineComponent({
  name: 'EmojiCard',
  props: {
    emoji: { type: Object as () => Emoji, required: true },
    groupId: { type: String, required: true },
    index: { type: Number, required: true },
    imageSrc: { type: String, required: true }
  },
  emits: ['edit', 'remove', 'quickTag'],
  setup(props, { emit }) {
    const handleQuickTag = () => {
      emit('quickTag', props.emoji)
    }

    const handleEdit = () => {
      emit('edit', props.emoji, props.groupId, props.index)
    }

    const handleRemove = () => {
      emit('remove', props.groupId, props.index)
    }

    return () => (
      <div class="emoji-card relative group cursor-move">
        <div class="emoji-thumb relative bg-gray-50 rounded-lg overflow-hidden hover:bg-gray-100 transition-colors dark:bg-gray-700 dark:hover:bg-gray-600">
          <CachedImage
            src={props.imageSrc}
            alt={props.emoji.name}
            class="w-full h-full object-contain"
            loading="lazy"
          />

          {/* 悬浮按钮锚定在表情图片容器上，而不是整张卡片 */}
          <button
            onClick={handleQuickTag}
            class="absolute bottom-1 left-1 w-6 h-6 bg-green-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-green-600"
            title="快速编辑标签"
            aria-label="快速编辑标签"
          >
            <TagOutlined class="text-xs" />
          </button>

          <button
            onClick={handleEdit}
            class="absolute bottom-1 right-1 w-4 h-4 bg-blue-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-blue-600"
            title="编辑表情"
            aria-label="编辑表情"
          >
            ✎
          </button>
        </div>
        <div class="emoji-name text-xs text-center text-gray-600 mt-1 truncate dark:text-white">
          {props.emoji.name}
        </div>
        <EmojiTags tags={props.emoji.tags || []} maxDisplay={2} />

        <Popconfirm
          title="确认移除此表情？"
          onConfirm={handleRemove}
          v-slots={{
            icon: () => <QuestionCircleOutlined style={{ color: 'red' }} />
          }}
        >
          <button
            class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
            title="移除表情"
            aria-label="移除表情"
          >
            ×
          </button>
        </Popconfirm>
      </div>
    )
  }
})
