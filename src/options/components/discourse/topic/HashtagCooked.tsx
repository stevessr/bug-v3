import { defineComponent, computed } from 'vue'

import TagPill from '../layout/TagPill.vue'

export default defineComponent({
  name: 'HashtagCooked',
  props: {
    href: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, default: 'tag' },
    slug: { type: String, default: '' },
    tagId: { type: String, default: '' },
    styleType: { type: String, default: '' },
    icon: { type: String, default: '' },
    valid: { type: Boolean, default: true },
    extraClass: { type: Array as () => string[], default: () => [] },
    title: { type: String, default: '' }
  },
  setup(props) {
    const className = computed(() => {
      const classes = ['hashtag-cooked', ...props.extraClass]
      if (!props.valid) classes.push('is-invalid')
      return classes
    })

    const tagName = computed(() => props.slug || props.label)

    return () => (
      <a
        href={props.href}
        class={className.value}
        data-type={props.type || undefined}
        data-slug={props.slug || undefined}
        data-id={props.tagId || undefined}
        data-style-type={props.styleType || undefined}
        data-icon={props.icon || undefined}
        data-valid={props.valid ? undefined : 'false'}
        title={props.title || undefined}
      >
        <TagPill name={tagName.value} text={props.label} compact clickable />
      </a>
    )
  }
})
