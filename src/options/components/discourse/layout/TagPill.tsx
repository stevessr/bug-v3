import { defineComponent, computed } from 'vue'

import { getTagVisual, hexToRgba, stripHtml } from '../tagVisuals'

import { getDiscourseIconHref } from './iconSprite'
import '../css/TagPill.css'

export default defineComponent({
  name: 'TagPill',
  props: {
    name: { type: String, required: true },
    text: { type: String, default: '' },
    description: { type: String, default: null },
    clickable: { type: Boolean, default: false },
    compact: { type: Boolean, default: false },
    truncate: { type: Boolean, default: false }
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
          'tag-pill',
          { 'tag-pill--compact': props.compact },
          { 'tag-pill--clickable': props.clickable },
          { 'tag-pill--neutral': !visual.value }
        ]}
        style={labelStyle.value}
        title={titleText.value}
      >
        {visual.value && (
          <svg class="tag-pill__icon" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
            <use href={getDiscourseIconHref(visual.value.icon)} />
          </svg>
        )}
        <span class={['tag-pill__label', { 'tag-pill__label--truncate': props.truncate }]}>
          {props.text || props.name}
        </span>
      </span>
    )
  }
})
