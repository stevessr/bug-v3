import { defineComponent, computed } from 'vue'

import { getTagVisual, hexToRgba, stripHtml } from '../tagVisuals'

export default defineComponent({
  name: 'TagPill',
  props: {
    name: { type: String, required: true },
    text: { type: String, default: '' },
    description: { type: String, default: null },
    clickable: { type: Boolean, default: false },
    compact: { type: Boolean, default: false }
  },
  setup(props) {
    const visual = computed(() => getTagVisual(props.name, props.text))

    const titleText = computed(() => {
      const cleaned = stripHtml(props.description)
      return cleaned || undefined
    })

    const labelStyle = computed(() => {
      if (!visual.value) return undefined
      return {
        color: visual.value.color,
        borderColor: hexToRgba(visual.value.color, 0.35),
        backgroundColor: hexToRgba(visual.value.color, 0.12)
      }
    })

    return () => (
      <span
        class={[
          'tag-pill inline-flex items-center rounded border',
          props.compact ? 'text-xs px-2 py-0.5' : 'px-2 py-1',
          props.clickable ? 'cursor-pointer' : '',
          !visual.value
            ? 'bg-gray-100 text-gray-700 border-transparent dark:bg-gray-700 dark:text-gray-200'
            : ''
        ]}
        style={labelStyle.value}
        title={titleText.value}
      >
        {visual.value && (
          <svg class="w-3.5 h-3.5 mr-1" viewBox="0 0 512 512" fill="currentColor">
            <use href={`#${visual.value.icon}`} />
          </svg>
        )}
        <span class="truncate">{props.text || props.name}</span>
      </span>
    )
  }
})
