/* @jsxImportSource vue */
import { defineComponent, type PropType } from 'vue'
import { Checkbox } from 'ant-design-vue'

import CachedImage from '@/components/CachedImage.vue'
import type { Emoji } from '@/types/type'
import { getEmojiImageUrlSync } from '@/utils/imageUrlHelper'

export default defineComponent({
  name: 'AIRenameEmojiCard',
  props: {
    emoji: { type: Object as PropType<Emoji>, required: true },
    selected: { type: Boolean, required: true }
  },
  emits: ['toggle'],
  setup(props, { emit }) {
    const handleToggle = () => {
      emit('toggle')
    }

    const handleToggleWithStop = (event: MouseEvent) => {
      event.stopPropagation()
      handleToggle()
    }

    return () => (
      <div
        class={[
          'relative h-full rounded-2xl border transition-all duration-200 cursor-pointer',
          'bg-white/90 dark:bg-gray-900/60 backdrop-blur',
          'hover:-translate-y-0.5 hover:shadow-lg',
          props.selected
            ? 'border-emerald-400 shadow-emerald-100/60 dark:shadow-emerald-900/40 ring-2 ring-emerald-200 dark:ring-emerald-700'
            : 'border-gray-200 dark:border-gray-700'
        ]}
        onClick={handleToggle}
      >
        <div class="h-1 w-full rounded-t-2xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-amber-300" />
        <div class="flex h-full flex-col items-center justify-between p-3">
          <div class="h-24 w-full flex items-center justify-center overflow-hidden rounded-xl bg-gray-50 dark:bg-gray-800">
            <CachedImage
              src={getEmojiImageUrlSync(props.emoji, { preferCache: true })}
              alt={props.emoji.name}
              class="max-h-full max-w-full object-contain"
              loading="lazy"
            />
          </div>
          <div class="mt-3 w-full text-center">
            <div
              class={[
                'truncate px-2 py-1 text-sm rounded-md',
                props.selected
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'
                  : 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
              ]}
            >
              {props.emoji.name}
            </div>
          </div>
        </div>
        <div class="absolute right-2 top-2 rounded-full bg-white/90 dark:bg-gray-900/80 p-1 shadow">
          <Checkbox checked={props.selected} onClick={handleToggleWithStop} />
        </div>
      </div>
    )
  }
})
