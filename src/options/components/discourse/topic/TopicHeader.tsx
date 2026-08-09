import { defineComponent } from 'vue'

import type { DiscourseTopicDetail } from '../types'
import { formatTime } from '../utils'

export default defineComponent({
  name: 'TopicHeader',
  props: {
    topic: { type: Object as () => DiscourseTopicDetail, required: true }
  },
  setup(props) {
    return () => (
      <header class="topic-header">
        <span class="topic-header__eyebrow">讨论主题</span>
        <h1 class="topic-header__title">{props.topic.fancy_title || props.topic.title}</h1>
        <div class="topic-header__meta">
          <span class="topic-header__meta-item">{props.topic.posts_count} 回复</span>
          <span class="topic-header__meta-item">
            创建于{' '}
            <time datetime={props.topic.created_at}>{formatTime(props.topic.created_at)}</time>
          </span>
        </div>
      </header>
    )
  }
})
