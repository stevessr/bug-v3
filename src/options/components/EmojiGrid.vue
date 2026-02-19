<script lang="tsx">
import { defineComponent, ref, type PropType } from 'vue'

import QuickTagEditor from './QuickTagEditor.vue'
import EmojiCard from './EmojiCard'

import { useEmojiImages } from '@/composables/useEmojiImages'
import type { Emoji } from '@/types/type'

export default defineComponent({
  name: 'EmojiGrid',
  props: {
    emojis: { type: Array as PropType<Emoji[]>, required: true },
    groupId: { type: String, required: true },
    gridColumns: { type: Number, required: true }
  },
  emits: ['editEmoji', 'removeEmoji', 'emojiDragStart', 'emojiDrop'],
  setup(props, { emit }) {
    const showQuickTagEditor = ref(false)
    const editingEmoji = ref<Emoji | null>(null)

    const openQuickTagEditor = (emoji: Emoji) => {
      editingEmoji.value = emoji
      showQuickTagEditor.value = true
    }

    const closeQuickTagEditor = () => {
      showQuickTagEditor.value = false
      editingEmoji.value = null
    }

    const { imageSources, getImageSrcSync } = useEmojiImages(() => props.emojis, {
      preload: true,
      preloadBatchSize: 3,
      preloadDelay: 50
    })

    const handleEmojiDragStart = (emoji: Emoji, index: number, event: DragEvent) => {
      emit('emojiDragStart', emoji, props.groupId, index, event)
    }

    const handleEmojiDrop = (index: number, event: DragEvent) => {
      emit('emojiDrop', props.groupId, index, event)
    }

    const addEmojiTouchEvents = (_element: HTMLElement, _emoji: Emoji, _index: number) => {
      // 由父组件通过 TouchDragHandler 处理
    }

    return () => (
      <div class="options-emoji-grid-container">
        <div
          class="options-emoji-grid"
          style={{ gridTemplateColumns: `repeat(${props.gridColumns}, minmax(0, 1fr))` }}
        >
          {props.emojis.map((emoji, index) => (
            <div
              key={emoji.id}
              class="options-emoji-item relative group cursor-move"
              draggable
              onDragstart={(event: DragEvent) => handleEmojiDragStart(emoji, index, event)}
              onDragover={(event: DragEvent) => event.preventDefault()}
              onDrop={(event: DragEvent) => handleEmojiDrop(index, event)}
              ref={(el: Element | null) => {
                if (el instanceof HTMLElement) addEmojiTouchEvents(el, emoji, index)
              }}
            >
              <EmojiCard
                emoji={emoji}
                groupId={props.groupId}
                index={index}
                imageSrc={imageSources.value.get(emoji.id) || getImageSrcSync(emoji)}
                onQuickTag={openQuickTagEditor}
                onEdit={(e: Emoji, g: string, i: number) => emit('editEmoji', e, g, i)}
                onRemove={(g: string, i: number) => emit('removeEmoji', g, i)}
              />
            </div>
          ))}
        </div>

        {editingEmoji.value ? (
          <QuickTagEditor
            show={showQuickTagEditor.value}
            emoji={editingEmoji.value}
            onClose={closeQuickTagEditor}
            {...{
              'onUpdate:show': (value: boolean) => {
                showQuickTagEditor.value = value
              }
            }}
          />
        ) : null}
      </div>
    )
  }
})
</script>

<style scoped src="./EmojiGrid.css" />
