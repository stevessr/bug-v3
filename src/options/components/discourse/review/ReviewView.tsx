import { computed, defineComponent, nextTick, ref, watch } from 'vue'
import { Spin, Empty } from 'ant-design-vue'
import { EyeOutlined, UndoOutlined, FlagOutlined } from '@ant-design/icons-vue'

import type {
  DiscourseUser,
  ReviewState,
  ReviewStatus,
  Reviewable,
  ReviewableAction
} from '../types'
import { formatTime, getAvatarUrl } from '../utils'
import '../css/ReviewView.css'

const STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: '待处理',
  approved: '已通过',
  rejected: '已拒绝',
  ignored: '已忽略',
  deleted: '已删除'
}

const STATUS_META: Record<ReviewStatus, { class: string; icon: string }> = {
  pending: { class: 'is-pending', icon: '⏳' },
  approved: { class: 'is-approved', icon: '✅' },
  rejected: { class: 'is-rejected', icon: '❌' },
  ignored: { class: 'is-ignored', icon: '🙈' },
  deleted: { class: 'is-deleted', icon: '🗑️' }
}

const typeLabel = (type: string) => {
  const map: Record<string, string> = {
    ReviewablePost: '举报帖子',
    ReviewableQueuedPost: '待审帖子',
    ReviewableQueuedTopic: '待审主题',
    ReviewableUser: '用户审核',
    ReviewableChatMessage: '举报聊天消息',
    ReviewableChatChannel: '举报聊天频道'
  }
  return map[type] || type.replace(/^Reviewable/, '')
}

export default defineComponent({
  name: 'ReviewView',
  props: {
    reviewState: { type: Object as () => ReviewState, required: true },
    baseUrl: { type: String, required: true },
    currentUsername: { type: String, default: undefined },
    users: { type: Object as () => Map<number, DiscourseUser>, required: true }
  },
  emits: [
    'switchStatus',
    'perform',
    'update',
    'delete',
    'openTopic',
    'openUser',
    'navigate',
    'loadMore'
  ],
  setup(props, { emit }) {
    const confirmAction = ref<{
      reviewableId: number
      version: number
      action: ReviewableAction
    } | null>(null)
    const rejectReason = ref('')
    const categoryId = ref<number | undefined>(undefined)
    const editingCategory = ref<number | null>(null)
    const modalPanel = ref<HTMLDivElement | null>(null)
    const modalTrigger = ref<HTMLElement | null>(null)

    const statusTabs: ReviewStatus[] = ['pending', 'approved', 'rejected', 'ignored', 'deleted']

    const visibleReviewables = computed(() => props.reviewState.reviewables)

    const getScoreReason = (reviewable: Reviewable) => {
      const scores = reviewable.reviewable_scores || []
      return scores.map(score => {
        const title = score.score_type?.title || score.reason || '举报'
        return {
          title,
          user: score.user,
          createdAt: score.created_at,
          reason: score.reason
        }
      })
    }

    const getActions = (reviewable: Reviewable) => {
      const result: Array<ReviewableAction & { bundleLabel?: string }> = []
      for (const bundle of reviewable.bundled_actions || []) {
        for (const action of bundle.actions) {
          result.push({ ...action, bundleLabel: bundle.label })
        }
      }
      return result
    }

    const getPostPreview = (reviewable: Reviewable) => {
      const raw = reviewable.cooked || reviewable.raw || reviewable.payload?.raw
      if (!raw) return ''
      const html = reviewable.cooked || ''
      if (html) {
        return html
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 300)
      }
      return String(raw).slice(0, 300)
    }

    const getPayloadTags = (reviewable: Reviewable): string[] => {
      const tags = reviewable.payload?.tags
      return Array.isArray(tags) ? (tags as string[]) : []
    }

    const getTitle = (reviewable: Reviewable) => {
      return (
        reviewable.fancy_title ||
        reviewable.payload?.title ||
        reviewable.topic?.fancy_title ||
        reviewable.topic?.title ||
        ''
      )
    }

    const getTargetUsername = (reviewable: Reviewable) => {
      const targetUser = reviewable.target || reviewable.target_created_by || reviewable.created_by
      return targetUser?.username || ''
    }

    const avatarFor = (user?: DiscourseUser | null) => {
      if (!user) return ''
      return getAvatarUrl(user.avatar_template, props.baseUrl, 40)
    }

    const usernameFor = (user?: DiscourseUser | null) => {
      if (!user) return ''
      const cached = props.users.get(user.id)
      return cached?.username || user.username || ''
    }

    const isPerforming = (reviewableId: number) => props.reviewState.performingId === reviewableId

    const handlePerform = (reviewable: Reviewable, action: ReviewableAction) => {
      if (action.confirm_message) {
        modalTrigger.value =
          typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null)
        confirmAction.value = { reviewableId: reviewable.id, version: reviewable.version, action }
        return
      }
      emit('perform', {
        reviewableId: reviewable.id,
        version: reviewable.version,
        serverAction: action.server_action,
        extra: {}
      })
    }

    const handleConfirmedPerform = () => {
      const pending = confirmAction.value
      if (!pending) return
      emit('perform', {
        reviewableId: pending.reviewableId,
        version: pending.version,
        serverAction: pending.action.server_action,
        extra: rejectReason.value ? { reject_reason: rejectReason.value } : {}
      })
      closeConfirm()
    }

    const closeConfirm = () => {
      confirmAction.value = null
      rejectReason.value = ''
      nextTick(() => modalTrigger.value?.focus())
    }

    const handleModalKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeConfirm()
        return
      }

      if (event.key !== 'Tab' || !modalPanel.value) return

      const focusable = Array.from(
        modalPanel.value.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      )
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || active === modalPanel.value)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || active === modalPanel.value)) {
        event.preventDefault()
        first.focus()
      }
    }

    watch(confirmAction, action => {
      if (action) nextTick(() => modalPanel.value?.focus())
    })

    const handleSaveCategory = (reviewable: Reviewable) => {
      if (editingCategory.value !== reviewable.id) {
        editingCategory.value = reviewable.id
        categoryId.value = reviewable.category_id || undefined
        return
      }
      emit('update', {
        reviewableId: reviewable.id,
        version: reviewable.version,
        updates: categoryId.value ? { category_id: categoryId.value } : {}
      })
      editingCategory.value = null
    }

    const handleOpenPayloadUrl = (reviewable: Reviewable) => {
      const url = reviewable.target_url || reviewable.topic_url
      if (url) {
        emit('navigate', url)
      }
    }

    const actionIcon = (action: ReviewableAction) => {
      if (action.icon) return action.icon
      if (action.button_class?.includes('approve') || action.server_action === 'approve') {
        return '✅'
      }
      if (action.server_action === 'reject' || action.server_action === 'delete') return '❌'
      if (action.server_action === 'ignore') return '🙈'
      if (action.server_action === 'agree') return '👍'
      if (action.server_action === 'disagree') return '👎'
      return '▶'
    }

    return () => (
      <section class="review-view" aria-labelledby="review-view-title">
        <div class="review-header">
          <div class="review-header__content">
            <div class="review-header__eyebrow">社区管理</div>
            <div class="review-header__title">
              <h2 id="review-view-title">审核队列</h2>
              <p>集中处理举报、待审内容与用户审核请求。</p>
            </div>
            <div class="review-header__counts">
              {props.reviewState.reviewableCount > 0 && (
                <span class="review-count review-count--total">
                  可审 {props.reviewState.reviewableCount}
                </span>
              )}
              {props.reviewState.unseenReviewableCount > 0 && (
                <span class="review-count review-count--unseen">
                  未读 {props.reviewState.unseenReviewableCount}
                </span>
              )}
              <span class="review-count">共 {props.reviewState.totalRows} 项</span>
            </div>
          </div>

          <div class="review-status-tabs" role="tablist" aria-label="按审核状态筛选">
            {statusTabs.map(status => (
              <button
                key={status}
                type="button"
                role="tab"
                aria-selected={props.reviewState.status === status}
                class={[
                  'review-status-tab',
                  props.reviewState.status === status ? 'is-active' : ''
                ]}
                onClick={() => emit('switchStatus', status)}
              >
                <span class={`review-status-dot ${STATUS_META[status].class}`}>
                  {STATUS_META[status].icon}
                </span>
                {STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </div>

        {props.reviewState.errorMessage && (
          <div class="review-error" role="alert">
            {props.reviewState.errorMessage}
          </div>
        )}

        <div class="review-list" aria-busy={props.reviewState.loading} aria-live="polite">
          {props.reviewState.loading && visibleReviewables.value.length === 0 && (
            <div class="review-loading">
              <Spin />
              <span>加载审核队列...</span>
            </div>
          )}

          {!props.reviewState.loading && visibleReviewables.value.length === 0 && (
            <div class="review-empty">
              <Empty description={`暂无${STATUS_LABELS[props.reviewState.status]}审核项`} />
            </div>
          )}

          {visibleReviewables.value.map(reviewable => (
            <article key={reviewable.id} class="review-item">
              <div class="review-item__head">
                <span class={`review-item__type ${STATUS_META[props.reviewState.status].class}`}>
                  {typeLabel(reviewable.type)}
                </span>
                <span class="review-item__status">
                  {STATUS_META[props.reviewState.status].icon}{' '}
                  {STATUS_LABELS[props.reviewState.status]}
                </span>
                <span class="review-item__time">{formatTime(reviewable.created_at)}</span>
                {reviewable.score !== undefined && reviewable.score !== null && (
                  <span class="review-item__score">评分 {reviewable.score}</span>
                )}
              </div>

              <div class="review-item__content">
                {getTitle(reviewable) &&
                  (reviewable.target_url || reviewable.topic_url ? (
                    <button
                      type="button"
                      class="review-item__title review-item__title--button"
                      onClick={() => handleOpenPayloadUrl(reviewable)}
                      innerHTML={getTitle(reviewable)}
                    />
                  ) : (
                    <h3 class="review-item__title" innerHTML={getTitle(reviewable)} />
                  ))}

                {getPostPreview(reviewable) && (
                  <div class="review-item__preview">{getPostPreview(reviewable)}</div>
                )}

                {getPayloadTags(reviewable).length > 0 && (
                  <div class="review-item__tags">
                    {getPayloadTags(reviewable).map(tag => (
                      <span key={tag} class="review-item__tag">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {reviewable.topic_tags && reviewable.topic_tags.length > 0 && (
                  <div class="review-item__tags">
                    {reviewable.topic_tags.map(tag => (
                      <span key={tag} class="review-item__tag">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                <div class="review-item__meta">
                  {getTargetUsername(reviewable) && (
                    <button
                      type="button"
                      class="review-item__user"
                      onClick={() => emit('openUser', getTargetUsername(reviewable))}
                    >
                      👤 {getTargetUsername(reviewable)}
                    </button>
                  )}
                  {reviewable.category_id && (
                    <span class="review-item__category">分类 {reviewable.category_id}</span>
                  )}
                  {reviewable.topic_id && (
                    <button
                      type="button"
                      class="review-item__link"
                      onClick={() => handleOpenPayloadUrl(reviewable)}
                    >
                      查看主题 →
                    </button>
                  )}
                  {reviewable.can_edit && (
                    <button
                      type="button"
                      class="review-item__link"
                      onClick={() => handleSaveCategory(reviewable)}
                    >
                      {editingCategory.value === reviewable.id ? '保存分类' : '修改分类'}
                    </button>
                  )}
                </div>

                {editingCategory.value === reviewable.id && (
                  <div class="review-item__edit-row">
                    <input
                      type="number"
                      class="review-item__input"
                      placeholder="分类 ID"
                      value={categoryId.value ?? ''}
                      onInput={(e: Event) => {
                        categoryId.value = Number((e.target as HTMLInputElement).value) || undefined
                      }}
                    />
                    <button
                      type="button"
                      class="review-item__link"
                      onClick={() => {
                        editingCategory.value = null
                        categoryId.value = undefined
                      }}
                    >
                      取消
                    </button>
                  </div>
                )}
              </div>

              {getScoreReason(reviewable).length > 0 && (
                <div class="review-item__scores">
                  {getScoreReason(reviewable).map((score, index) => (
                    <div key={index} class="review-score">
                      <span class="review-score__icon">
                        {score.user ? (
                          <img
                            src={avatarFor(score.user)}
                            alt={usernameFor(score.user)}
                            class="review-score__avatar"
                          />
                        ) : (
                          <FlagOutlined />
                        )}
                      </span>
                      <div class="review-score__body">
                        <div class="review-score__title">
                          {score.title}
                          {score.user && (
                            <button
                              type="button"
                              class="review-score__user"
                              onClick={() => emit('openUser', usernameFor(score.user))}
                            >
                              @{usernameFor(score.user)}
                            </button>
                          )}
                          {score.createdAt && (
                            <span class="review-score__time">{formatTime(score.createdAt)}</span>
                          )}
                        </div>
                        {score.reason && <div class="review-score__reason">{score.reason}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div class="review-item__actions">
                {getActions(reviewable).map(action => (
                  <button
                    key={action.id}
                    type="button"
                    class={[
                      'review-action-btn',
                      action.button_class || '',
                      action.server_action === 'reject' || action.server_action === 'delete'
                        ? 'is-danger'
                        : '',
                      action.server_action === 'approve' ? 'is-primary' : ''
                    ]}
                    disabled={isPerforming(reviewable.id)}
                    onClick={() => handlePerform(reviewable, action)}
                    title={action.description || action.label}
                  >
                    {isPerforming(reviewable.id) ? (
                      <Spin size="small" />
                    ) : (
                      <span>{actionIcon(action)}</span>
                    )}
                    <span>{action.label}</span>
                  </button>
                ))}

                {reviewable.can_edit && (
                  <button
                    type="button"
                    class="review-action-btn"
                    disabled={isPerforming(reviewable.id)}
                    onClick={() =>
                      emit('update', {
                        reviewableId: reviewable.id,
                        version: reviewable.version,
                        updates: { category_id: reviewable.category_id }
                      })
                    }
                  >
                    <UndoOutlined /> 刷新
                  </button>
                )}

                {reviewable.type === 'ReviewableUser' && (
                  <button
                    type="button"
                    class="review-action-btn"
                    onClick={() => emit('openUser', getTargetUsername(reviewable))}
                  >
                    <EyeOutlined /> 查看用户
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>

        {props.reviewState.hasMore && !props.reviewState.loading && (
          <div class="review-loadmore">
            <button type="button" class="review-loadmore__btn" onClick={() => emit('loadMore')}>
              加载更多
            </button>
          </div>
        )}

        {confirmAction.value && (
          <div class="review-modal">
            <div class="review-modal__backdrop" aria-hidden="true" onClick={closeConfirm} />
            <div
              ref={modalPanel}
              class="review-modal__panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="review-confirm-title"
              tabindex={-1}
              onKeydown={handleModalKeydown}
            >
              <div id="review-confirm-title" class="review-modal__title">
                {confirmAction.value.action.confirm_message ||
                  `确认执行「${confirmAction.value.action.label}」？`}
              </div>
              {confirmAction.value.action.require_reject_reason && (
                <textarea
                  class="review-modal__textarea"
                  placeholder="请输入拒绝原因（必填）"
                  value={rejectReason.value}
                  onInput={(e: Event) => {
                    rejectReason.value = (e.target as HTMLTextAreaElement).value
                  }}
                />
              )}
              <div class="review-modal__actions">
                <button type="button" class="review-modal__cancel" onClick={closeConfirm}>
                  取消
                </button>
                <button
                  type="button"
                  class="review-modal__confirm"
                  disabled={
                    confirmAction.value.action.require_reject_reason && !rejectReason.value.trim()
                  }
                  onClick={handleConfirmedPerform}
                >
                  确认
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    )
  }
})
