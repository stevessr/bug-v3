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
  emits: ['jump', 'preview'],
  setup(props, { emit }) {
    const localValue = ref(props.currentPostNumber)
    const trackRef = ref<HTMLElement | null>(null)
    const dragging = ref(false)
    const ignoreNextTrackClick = ref(false)
    let clearIgnoreClickTimer: ReturnType<typeof setTimeout> | null = null

    watch(
      () => props.currentPostNumber,
      value => {
        if (!dragging.value && Number.isFinite(value)) {
          localValue.value = value
        }
      }
    )

    const roundedValue = computed(() => {
      const max = props.maxPostNumber || 1
      const value = Math.round(localValue.value)
      return clamp(value, 1, max)
    })

    const currentPost = computed(() =>
      props.posts.find(post => post.post_number === roundedValue.value)
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
      return 1 + ratio * range
    }

    const updateValue = (clientY: number, shouldJump = false) => {
      const value = getValueFromClientY(clientY)
      localValue.value = value
      if (shouldJump) {
        emit('jump', roundedValue.value)
      } else {
        emit('preview', roundedValue.value)
      }
    }

    const setValue = (value: number) => {
      localValue.value = clamp(value, 1, props.maxPostNumber || 1)
      emit('jump', roundedValue.value)
    }

    const handleKeydown = (event: KeyboardEvent) => {
      const pageStep = Math.max(5, Math.round((props.maxPostNumber || 1) / 10))
      let nextValue: number | null = null

      switch (event.key) {
        case 'ArrowUp':
        case 'ArrowLeft':
          nextValue = roundedValue.value - 1
          break
        case 'ArrowDown':
        case 'ArrowRight':
          nextValue = roundedValue.value + 1
          break
        case 'PageUp':
          nextValue = roundedValue.value - pageStep
          break
        case 'PageDown':
          nextValue = roundedValue.value + pageStep
          break
        case 'Home':
          nextValue = 1
          break
        case 'End':
          nextValue = props.maxPostNumber || 1
          break
      }

      if (nextValue === null) return
      event.preventDefault()
      setValue(nextValue)
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
      // Navigating to a not-yet-loaded floor can trigger a network fetch.
      // Do that only after the user has chosen the destination, not on every
      // drag frame across the timeline.
      emit('jump', roundedValue.value)
      // The thumb click bubbles to the track after mouseup.  It is already
      // committed above, so ignore that one duplicate jump/fetch.
      ignoreNextTrackClick.value = true
      if (clearIgnoreClickTimer) clearTimeout(clearIgnoreClickTimer)
      clearIgnoreClickTimer = setTimeout(() => {
        ignoreNextTrackClick.value = false
      }, 0)
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
      if (clearIgnoreClickTimer) clearTimeout(clearIgnoreClickTimer)
    })

    const handleTop = computed(() => {
      const range = props.maxPostNumber - 1
      if (range <= 0) return 0
      const ratio = (localValue.value - 1) / range
      return clamp(ratio * 100, 0, 100)
    })

    const targetLoaded = computed(() =>
      props.posts.some(post => post.post_number === roundedValue.value)
    )

    return () => (
      <section class="topic-timeline" aria-label="话题时间线">
        <div class="topic-timeline__icon">
          <svg class="topic-timeline__icon-svg" viewBox="0 0 24 24" fill="currentColor">
            <use href="#bookmark" />
          </svg>
        </div>
        <div class="topic-timeline__label topic-timeline__label--top">{minLabel.value}</div>
        <div
          class="topic-timeline__track"
          ref={trackRef}
          role="slider"
          tabindex={0}
          aria-label="跳转到帖子"
          aria-valuemin={1}
          aria-valuemax={props.maxPostNumber || 1}
          aria-valuenow={roundedValue.value}
          aria-valuetext={`第 ${roundedValue.value} 条，共 ${props.maxPostNumber} 条`}
          onClick={(event: MouseEvent) => {
            if (ignoreNextTrackClick.value) {
              ignoreNextTrackClick.value = false
              return
            }
            updateValue(event.clientY, true)
          }}
          onKeydown={handleKeydown}
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
            {roundedValue.value} / {props.maxPostNumber}
          </div>
          {currentPost.value && (
            <div class="topic-timeline__current-time">
              {formatTime(currentPost.value.created_at)}
            </div>
          )}
          {dragging.value && !targetLoaded.value && (
            <div class="topic-timeline__pending-load">松开后加载该楼层</div>
          )}
        </div>
        <div class="topic-timeline__label topic-timeline__label--bottom">{maxLabel.value}</div>
      </section>
    )
  }
})
