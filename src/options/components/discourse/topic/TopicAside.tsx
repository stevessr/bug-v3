import { defineComponent, computed, ref } from 'vue'
import type { PropType } from 'vue'

import type { DiscoursePost, DiscourseUser } from '../types'
import { formatTime, getAvatarUrl } from '../utils'

import TopicTimeline from './TopicTimeline'

type ViewDetailItem = Record<string, any>

type LikeDetailItem = {
  postNumber: number
  likeCount: number
  username: string
  avatarTemplate?: string
  blurb?: string
}

export default defineComponent({
  name: 'TopicAside',
  props: {
    posts: { type: Array as () => DiscoursePost[], required: true },
    baseUrl: { type: String, required: true },
    maxPostNumber: { type: Number, required: true },
    currentPostNumber: { type: Number, required: true },
    onJump: { type: Function as PropType<(postNumber: number) => void>, required: true },
    viewCount: { type: Number as () => number | null, default: null },
    likeCount: { type: Number as () => number | null, default: null },
    userCount: { type: Number as () => number | null, default: null },
    viewDetails: {
      type: Object as () => { views: ViewDetailItem[]; users: ViewDetailItem[] } | null,
      default: null
    },
    likeDetails: { type: Array as () => LikeDetailItem[], default: () => [] },
    participants: { type: Array as () => DiscourseUser[], default: () => [] },
    summaryMode: { type: Boolean, default: false },
    summaryLoading: { type: Boolean, default: false },
    onToggleSummary: { type: Function as PropType<() => void>, required: true }
  },
  setup(props, { slots }) {
    const activeDetail = ref<'views' | 'likes' | 'users' | null>(null)

    const stats = computed(() => [
      { key: 'views' as const, label: '浏览量', value: props.viewCount },
      { key: 'likes' as const, label: '赞', value: props.likeCount },
      { key: 'users' as const, label: '用户', value: props.userCount }
    ])

    const viewItems = computed(() => {
      const items = props.viewDetails?.views || []
      return [...items].sort((left, right) => {
        const leftTime = Date.parse(
          String(left?.date ?? left?.to ?? left?.from ?? left?.start ?? '')
        )
        const rightTime = Date.parse(
          String(right?.date ?? right?.to ?? right?.from ?? right?.start ?? '')
        )
        return (
          (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0)
        )
      })
    })
    const userItems = computed(() => props.participants || [])
    const likeItems = computed(() => props.likeDetails || [])

    const formatNumber = (value: number | null | undefined) => {
      if (value === null || typeof value === 'undefined') return '-'
      return new Intl.NumberFormat('zh-CN').format(value)
    }

    const formatRange = (item: ViewDetailItem) => {
      const from = item?.from ?? item?.start ?? item?.date
      const to = item?.to ?? item?.end
      if (from && to) return `${formatTime(from)} ~ ${formatTime(to)}`
      if (from) return formatTime(from)
      if (item?.label) return String(item.label)
      return '未知时间'
    }

    const getCount = (item: ViewDetailItem) => {
      const value = Number(item?.count ?? item?.views ?? item?.value ?? 0)
      return Number.isNaN(value) ? 0 : value
    }

    const handleDetailToggle = (key: 'views' | 'likes' | 'users') => {
      activeDetail.value = activeDetail.value === key ? null : key
    }

    const handleJump = (postNumber: number) => {
      if (!postNumber) return
      props.onJump(postNumber)
    }

    return () => (
      <aside class="topic-aside" aria-label="话题导航与数据">
        <div class="topic-aside__inner">
          {slots.default?.()}
          <div class="topic-aside__card">
            <div class="topic-aside__card-header">
              <span class="topic-aside__card-title">话题数据</span>
              <button
                type="button"
                class="topic-aside__summary-toggle"
                disabled={props.summaryLoading}
                aria-pressed={props.summaryMode}
                onClick={() => props.onToggleSummary()}
              >
                {props.summaryMode ? '全部回复' : '热门回复'}
              </button>
            </div>
            <div class="topic-aside__stats">
              {stats.value.map(item => (
                <button
                  key={item.key}
                  type="button"
                  class={[
                    'topic-aside__stat-item',
                    activeDetail.value === item.key ? 'is-active' : ''
                  ]}
                  aria-expanded={activeDetail.value === item.key}
                  onClick={() => handleDetailToggle(item.key)}
                >
                  <span class="topic-aside__stat-label">{item.label}</span>
                  <span class="topic-aside__stat-value">{formatNumber(item.value)}</span>
                </button>
              ))}
            </div>
            {activeDetail.value && (
              <div class="topic-aside__detail">
                {activeDetail.value === 'views' && (
                  <div class="topic-aside__detail-list">
                    <div class="topic-aside__detail-heading">最近浏览量（日期）</div>
                    {viewItems.value.length ? (
                      viewItems.value.map((item, index) => (
                        <div key={`${formatRange(item)}-${index}`} class="topic-aside__detail-row">
                          <span class="topic-aside__detail-label">{formatRange(item)}</span>
                          <span class="topic-aside__detail-value">
                            {formatNumber(getCount(item))} 次
                          </span>
                        </div>
                      ))
                    ) : (
                      <div class="topic-aside__detail-empty">暂无浏览量明细</div>
                    )}
                  </div>
                )}
                {activeDetail.value === 'likes' && (
                  <div class="topic-aside__detail-list">
                    {likeItems.value.length ? (
                      likeItems.value.map(item => (
                        <button
                          key={`like-${item.postNumber}`}
                          type="button"
                          class="topic-aside__detail-row topic-aside__detail-link"
                          onClick={() => handleJump(item.postNumber)}
                        >
                          {item.avatarTemplate ? (
                            <img
                              class="topic-aside__like-avatar"
                              src={getAvatarUrl(item.avatarTemplate, props.baseUrl, 32)}
                              alt=""
                              loading="lazy"
                            />
                          ) : (
                            <span class="topic-aside__like-avatar topic-aside__like-avatar--fallback">
                              {(item.username || '?')[0].toUpperCase()}
                            </span>
                          )}
                          <span class="topic-aside__like-copy">
                            <span class="topic-aside__detail-label">
                              #{item.postNumber} @{item.username || '未知用户'}
                            </span>
                            {item.blurb && (
                              <span class="topic-aside__like-excerpt">{item.blurb}</span>
                            )}
                          </span>
                          <span class="topic-aside__detail-value">
                            {formatNumber(item.likeCount)} 赞
                          </span>
                        </button>
                      ))
                    ) : (
                      <div class="topic-aside__detail-empty">暂无点赞明细</div>
                    )}
                  </div>
                )}
                {activeDetail.value === 'users' && (
                  <div class="topic-aside__detail-users">
                    {userItems.value.length ? (
                      userItems.value.map(user => (
                        <div key={user.id} class="topic-aside__user" data-user-card={user.username}>
                          <img
                            class="topic-aside__user-avatar"
                            src={getAvatarUrl(user.avatar_template, props.baseUrl, 32)}
                            alt={user.username}
                          />
                          <span class="topic-aside__user-name">{user.username}</span>
                        </div>
                      ))
                    ) : (
                      <div class="topic-aside__detail-empty">暂无用户信息</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <TopicTimeline
            posts={props.posts}
            maxPostNumber={props.maxPostNumber}
            currentPostNumber={props.currentPostNumber}
            onJump={props.onJump}
          />
        </div>
      </aside>
    )
  }
})
