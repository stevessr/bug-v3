import { defineComponent, computed } from 'vue'

import type { DiscourseTopicDetail, DiscourseUser } from '../types'
import { formatTime, getAvatarUrl } from '../utils'

export default defineComponent({
  name: 'TopicHeader',
  props: {
    topic: { type: Object as () => DiscourseTopicDetail, required: true },
    baseUrl: { type: String, required: true },
    viewCount: { type: Number as () => number | null, default: null },
    likeCount: { type: Number as () => number | null, default: null },
    participants: { type: Array as () => DiscourseUser[], default: () => [] },
    summaryMode: { type: Boolean, default: false },
    summaryLoading: { type: Boolean, default: false }
  },
  emits: ['toggleSummary'],
  setup(props, { emit }) {
    const maxAvatars = 6
    const visibleParticipants = computed(() => props.participants.slice(0, maxAvatars))
    const extraParticipants = computed(() =>
      Math.max(props.participants.length - maxAvatars, 0)
    )
    const formatNumber = (value: number | null | undefined) => {
      if (value === null || typeof value === 'undefined') return '-'
      return new Intl.NumberFormat('zh-CN').format(value)
    }

    return () => (
      <div class="topic-header border-b dark:border-gray-700 pb-4">
        <h1 class="text-xl font-bold dark:text-white">
          {props.topic.fancy_title || props.topic.title}
        </h1>
        <div class="topic-header__meta flex items-center gap-4 mt-2 text-sm text-gray-500">
          <span>{props.topic.posts_count} 回复</span>
          <span>创建于 {formatTime(props.topic.created_at)}</span>
        </div>
        <div class="topic-header__stats-row">
          <div class="topic-header__stats">
            <div class="topic-header__stat">
              <span class="topic-header__stat-label">浏览量</span>
              <span class="topic-header__stat-value">{formatNumber(props.viewCount)}</span>
            </div>
            <div class="topic-header__stat">
              <span class="topic-header__stat-label">赞</span>
              <span class="topic-header__stat-value">{formatNumber(props.likeCount)}</span>
            </div>
            <div class="topic-header__stat">
              <span class="topic-header__stat-label">用户</span>
              <span class="topic-header__stat-value">
                {formatNumber(props.participants.length)}
              </span>
            </div>
          </div>
          <div class="topic-header__summary">
            <button
              class="topic-header__summary-toggle"
              disabled={props.summaryLoading}
              onClick={() => emit('toggleSummary')}
            >
              {props.summaryMode ? '全部回复' : '热门回复'}
            </button>
          </div>
        </div>
        {props.participants.length > 0 && (
          <div class="topic-header__users">
            <div class="topic-header__avatars">
              {visibleParticipants.value.map(user => (
                <img
                  key={user.id}
                  class="topic-header__avatar"
                  src={getAvatarUrl(user.avatar_template, props.baseUrl, 32)}
                  alt={user.username}
                />
              ))}
              {extraParticipants.value > 0 && (
                <span class="topic-header__avatar-more">+{extraParticipants.value}</span>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }
})
