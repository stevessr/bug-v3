import { defineComponent, computed, ref, watch, onUnmounted } from 'vue'

import type { DiscoursePost } from '../types'
import { formatTime } from '../utils'

export default defineComponent({
  name: 'TopicTimeline',
  props: {
    posts: { type: Array as () => DiscoursePost[], default: () => [] },
    maxPostNumber: { type: Number, required: true },
    currentPostNumber: { type: Number, required: true }
  },
  emits: ['jump'],
  setup(props, { emit }) {
    const localValue = ref(props.currentPostNumber)
    const trackRef = ref<HTMLElement | null>(null)
    const dragging = ref(false)

    watch(
      () => props.currentPostNumber,
      value => {
        if (Number.isFinite(value)) {
          localValue.value = value
        }
      }
    )

    const currentPost = computed(() =>
      props.posts.find(post => post.post_number === localValue.value)
    )

    const minLabel = computed(() => {
      const first = props.posts.find(post => post.post_number === 1) || props.posts[0]
      return first ? formatTime(first.created_at) : ''
    })

    const maxLabel = computed(() => {
      const last = props.posts[props.posts.length - 1]
      return last ? formatTime(last.created_at) : ''
    })

    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

    const getValueFromClientY = (clientY: number) => {
      if (!trackRef.value) return localValue.value
      const rect = trackRef.value.getBoundingClientRect()
      if (rect.height === 0) return localValue.value
      const ratio = clamp((clientY - rect.top) / rect.height, 0, 1)
      const range = props.maxPostNumber - 1
      if (range <= 0) return 1
      return Math.round(props.maxPostNumber - ratio * range)
    }

    const updateValue = (clientY: number) => {
      const value = getValueFromClientY(clientY)
      localValue.value = value
      emit('jump', value)
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!dragging.value) return
      updateValue(event.clientY)
    }

    const handleMouseUp = () => {
      if (!dragging.value) return
      dragging.value = false
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    const handleMouseDown = (event: MouseEvent) => {
      dragging.value = true
      updateValue(event.clientY)
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    onUnmounted(() => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    })

    const handleTop = computed(() => {
      const range = props.maxPostNumber - 1
      if (range <= 0) return 0
      const ratio = (props.maxPostNumber - localValue.value) / range
      return clamp(ratio * 100, 0, 100)
    })

    return () => (
      <div class="topic-timeline">
        <div class="topic-timeline__icon">
          <svg class="topic-timeline__icon-svg" viewBox="0 0 24 24" fill="currentColor">
            <use href="#bookmark" />
          </svg>
        </div>
        <div class="topic-timeline__label topic-timeline__label--top">{maxLabel.value}</div>
        <div
          class="topic-timeline__track"
          ref={trackRef}
          onClick={(event: MouseEvent) => updateValue(event.clientY)}
        >
          <div class="topic-timeline__line" />
          <div
            class={['topic-timeline__thumb', dragging.value ? 'is-dragging' : '']}
            style={{ top: `${handleTop.value}%` }}
            onMousedown={handleMouseDown}
          />
        </div>
        <div class="topic-timeline__current">
          <div class="topic-timeline__current-count">
            {localValue.value} / {props.maxPostNumber}
          </div>
          {currentPost.value && (
            <div class="topic-timeline__current-time">
              {formatTime(currentPost.value.created_at)}
            </div>
          )}
        </div>
        <div class="topic-timeline__label topic-timeline__label--bottom">{minLabel.value}</div>
      </div>
    )
  }
})
