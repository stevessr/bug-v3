/* @jsxImportSource vue */
import { defineComponent, type PropType } from 'vue'
import { Button, Checkbox, Popconfirm } from 'ant-design-vue'
import { QuestionCircleOutlined } from '@ant-design/icons-vue'

import CachedImage from '@/components/CachedImage.vue'
import { useEmojiImages } from '@/composables/useEmojiImages'
import type { Emoji } from '@/types/type'

import './BufferEmojiGrid.css'

export default defineComponent({
  name: 'BufferEmojiGrid',
  props: {
    emojis: { type: Array as PropType<Emoji[]>, required: true },
    gridColumns: { type: Number, required: true },
    isMultiSelectMode: { type: Boolean, default: false },
    selectedEmojis: { type: Set as PropType<Set<number>>, default: () => new Set() }
  },
  emits: ['edit', 'remove', 'toggle-selection', 'click'],
  setup(props, { emit }) {
    const { imageSources, getImageSrcSync } = useEmojiImages(() => props.emojis, {
      preload: true,
      preloadBatchSize: 3,
      preloadDelay: 50
    })

    const handleClick = (index: number) => {
      emit('click', index)
    }

    const handleEdit = (emoji: Emoji, index: number) => {
      emit('edit', emoji, index)
    }

    const handleRemove = (index: number) => {
      emit('remove', index)
    }

    const handleToggleSelection = (index: number) => {
      emit('toggle-selection', index)
    }

    return () => (
      <div
        class="buffer-emoji-grid"
        style={{
          gridTemplateColumns: `repeat(${props.gridColumns}, minmax(0, 1fr))`
        }}
      >
        {props.emojis.map((emoji, idx) => {
          const src = imageSources.value.get(emoji.id) || getImageSrcSync(emoji)
          const isSelected = props.selectedEmojis.has(idx)

          return (
            <div key={`buffer-${emoji.id || idx}`} class="emoji-card relative group">
              <div
                class={[
                  'emoji-thumb bg-gray-50 rounded-lg overflow-hidden hover:bg-gray-100 transition-colors dark:bg-gray-700 dark:hover:bg-gray-600 relative',
                  {
                    'cursor-pointer': props.isMultiSelectMode,
                    'ring-2 ring-blue-500': props.isMultiSelectMode && isSelected
                  }
                ]}
                onClick={() => handleClick(idx)}
              >
                <CachedImage
                  src={src}
                  alt={emoji.name}
                  class="w-full h-full object-contain"
                  loading="lazy"
                />
              </div>

              {/* Multi-select checkbox */}
              {props.isMultiSelectMode ? (
                <div class="absolute bottom-6 right-1">
                  <Checkbox
                    checked={isSelected}
                    onChange={() => handleToggleSelection(idx)}
                  />
                  <span class="sr-only">{`选择表情 ${emoji.name}`}</span>
                </div>
              ) : (
                /* Edit/Remove buttons */
                <div class="absolute bottom-6 left-0 right-0 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="small"
                    onClick={() => handleEdit(emoji, idx)}
                    class="text-xs px-2 py-0.5"
                  >
                    编辑
                  </Button>
                  <Popconfirm
                    title="确认移除此表情？"
                    onConfirm={() => handleRemove(idx)}
                    v-slots={{
                      icon: () => <QuestionCircleOutlined style="color: red" />
                    }}
                  >
                    <Button size="small" class="text-xs px-2 py-0.5">
                      移除
                    </Button>
                  </Popconfirm>
                </div>
              )}

              <div class="emoji-name text-xs text-center text-gray-600 mt-1 truncate dark:text-white">
                {emoji.name}
              </div>
            </div>
          )
        })}
      </div>
    )
  }
})
