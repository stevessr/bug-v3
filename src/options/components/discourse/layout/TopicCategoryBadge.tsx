import { computed, defineComponent } from 'vue'

import { resolveDiscourseHttpUrl } from '../navigation'
import type { DiscourseCategory } from '../types'

import { getDiscourseIconHref } from './iconSprite'

import '../css/TopicCategoryBadge.css'

const normalizeColor = (value: unknown, fallback: string) => {
  const normalized = String(value || '')
    .trim()
    .replace(/^#/, '')
  return /^[\da-f]{3,8}$/i.test(normalized) ? `#${normalized}` : fallback
}

export default defineComponent({
  name: 'TopicCategoryBadge',
  props: {
    category: { type: Object as () => DiscourseCategory, required: true },
    baseUrl: { type: String, required: true },
    clickable: { type: Boolean, default: false }
  },
  emits: ['click'],
  setup(props, { emit }) {
    const categoryColor = computed(() => normalizeColor(props.category.color, '#64748b'))
    const categoryTextColor = computed(() => normalizeColor(props.category.text_color, '#ffffff'))
    const logoUrl = computed(() => {
      const source = props.category.uploaded_logo?.url || props.category.uploaded_logo_dark?.url
      return source ? resolveDiscourseHttpUrl(source, props.baseUrl) || '' : ''
    })
    const iconHref = computed(() => getDiscourseIconHref(props.category.icon))
    const categoryUrl = computed(() => {
      const slug = String(props.category.slug || props.category.id)
        .split('/')
        .filter(Boolean)
        .map(segment => encodeURIComponent(segment))
        .join('/')
      return `${props.baseUrl.replace(/\/+$/, '')}/c/${slug}/${props.category.id}`
    })

    const handleClick = (event: MouseEvent) => {
      if (!props.clickable) return
      event.preventDefault()
      event.stopPropagation()
      emit('click', props.category)
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (!props.clickable || (event.key !== 'Enter' && event.key !== ' ')) return
      event.preventDefault()
      event.stopPropagation()
      emit('click', props.category)
    }

    return () => (
      <span
        class={['topic-category-badge', props.clickable ? 'is-clickable' : '']}
        style={
          {
            '--topic-category-color': categoryColor.value,
            '--topic-category-text-color': categoryTextColor.value
          } as Record<string, string>
        }
        title={props.category.name}
        data-discourse-url={props.clickable ? categoryUrl.value : undefined}
        role={props.clickable ? 'link' : undefined}
        tabindex={props.clickable ? 0 : undefined}
        onClick={handleClick}
        onKeydown={handleKeydown}
      >
        <span class="topic-category-badge__bar" aria-hidden="true" />
        <span class="topic-category-badge__icon" aria-hidden="true">
          {logoUrl.value ? (
            <img src={logoUrl.value} alt="" loading="lazy" />
          ) : props.category.emoji ? (
            <span class="topic-category-badge__emoji">{props.category.emoji}</span>
          ) : iconHref.value ? (
            <svg viewBox="0 0 24 24">
              <use href={iconHref.value} />
            </svg>
          ) : (
            <span class="topic-category-badge__dot" />
          )}
        </span>
        <span class="topic-category-badge__name">{props.category.name}</span>
      </span>
    )
  }
})
