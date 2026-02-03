import { defineComponent, computed, ref, watch } from 'vue'

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

    return () => (
      <div class="topic-timeline">
        <div class="topic-timeline__icon">
          <svg class="topic-timeline__icon-svg" viewBox="0 0 24 24" fill="currentColor">
            <use href="#bookmark" />
          </svg>
        </div>
        <div class="topic-timeline__label topic-timeline__label--top">{maxLabel.value}</div>
        <div class="topic-timeline__track">
          <input
            type="range"
            min={1}
            max={props.maxPostNumber}
            value={localValue.value}
            onInput={(event: Event) => {
              const value = Number((event.target as HTMLInputElement).value)
              localValue.value = value
              emit('jump', value)
            }}
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
