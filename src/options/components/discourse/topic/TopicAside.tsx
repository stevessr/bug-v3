import { defineComponent } from 'vue'
import type { DiscoursePost } from '../types'
import TopicTimeline from './TopicTimeline'

export default defineComponent({
  name: 'TopicAside',
  props: {
    posts: { type: Array as () => DiscoursePost[], required: true },
    maxPostNumber: { type: Number, required: true },
    currentPostNumber: { type: Number, required: true },
    onJump: { type: Function as () => (postNumber: number) => void, required: true }
  },
  setup(props) {
    return () => (
      <div class="topic-aside hidden lg:block w-56">
        <div class="topic-aside__inner">
          <TopicTimeline
            posts={props.posts}
            maxPostNumber={props.maxPostNumber}
            currentPostNumber={props.currentPostNumber}
            onJump={props.onJump}
          />
        </div>
      </div>
    )
  }
})
