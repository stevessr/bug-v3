import { computed, defineComponent, ref, watch } from 'vue'
import { Button, Modal, Spin } from 'ant-design-vue'

import type { DiscoursePost, DiscourseReactionUser } from '../types'
import { extractData, getAvatarUrl, pageFetch } from '../utils'

import '../css/ReactionDetailsModal.css'

const PAGE_SIZE = 50

export default defineComponent({
  name: 'ReactionDetailsModal',
  props: {
    open: { type: Boolean, required: true },
    post: { type: Object as () => DiscoursePost | null, default: null },
    reaction: { type: String as () => string | null, default: null },
    baseUrl: { type: String, required: true }
  },
  emits: ['close', 'openUser'],
  setup(props, { emit }) {
    const users = ref<DiscourseReactionUser[]>([])
    const total = ref(0)
    const page = ref(0)
    const loading = ref(false)
    const errorMessage = ref('')

    const title = computed(() => (props.reaction ? `:${props.reaction}: 反应详情` : '全部反应详情'))
    const hasMore = computed(() => users.value.length < total.value)

    const load = async (reset = false) => {
      if (!props.post || loading.value) return
      if (reset) {
        users.value = []
        total.value = 0
        page.value = 0
      }
      loading.value = true
      errorMessage.value = ''
      try {
        const params = new URLSearchParams({
          page: String(page.value),
          limit: String(PAGE_SIZE)
        })
        if (props.reaction) params.set('reaction_value', props.reaction)
        const result = await pageFetch<any>(
          `${props.baseUrl}/discourse-reactions/posts/${props.post.id}/reactions-users-list.json?${params}`
        )
        const data = extractData(result)
        if (!result.ok) {
          throw new Error(data?.errors?.join(', ') || data?.error || '获取反应详情失败')
        }
        const incoming = Array.isArray(data?.users) ? data.users : []
        const byKey = new Map<string, DiscourseReactionUser>()
        ;[...users.value, ...incoming].forEach(user => {
          if (!user?.username) return
          byKey.set(`${user.id || user.username}:${user.reaction || ''}`, user)
        })
        users.value = [...byKey.values()]
        total.value = Number(data?.total_rows ?? users.value.length) || users.value.length
        page.value += 1
      } catch (error) {
        errorMessage.value = error instanceof Error ? error.message : '获取反应详情失败'
      } finally {
        loading.value = false
      }
    }

    watch(
      () => [props.open, props.post?.id, props.reaction] as const,
      ([open]) => {
        if (open) void load(true)
      },
      { immediate: true }
    )

    return () => (
      <Modal
        open={props.open}
        title={title.value}
        width={520}
        footer={null}
        destroyOnClose={false}
        wrapClassName="reaction-details-modal-wrap"
        onCancel={() => emit('close')}
      >
        <div class="reaction-details-modal">
          <div class="reaction-details-modal__summary">
            <strong>{total.value}</strong>
            <span>人次</span>
            {props.reaction && <code>:{props.reaction}:</code>}
          </div>

          {users.value.length > 0 && (
            <div class="reaction-details-modal__list">
              {users.value.map(user => (
                <button
                  type="button"
                  key={`${user.id}-${user.reaction || ''}`}
                  class="reaction-details-modal__user"
                  data-discourse-url={`${props.baseUrl}/u/${encodeURIComponent(user.username)}`}
                  onClick={() => emit('openUser', user.username)}
                >
                  <img
                    src={getAvatarUrl(user.avatar_template, props.baseUrl, 40)}
                    alt=""
                    loading="lazy"
                  />
                  <span class="reaction-details-modal__identity">
                    <strong>{user.name || user.username}</strong>
                    <small>@{user.username}</small>
                  </span>
                  <span class="reaction-details-modal__reaction">
                    :{user.reaction || props.reaction || '反应'}:
                  </span>
                </button>
              ))}
            </div>
          )}

          {loading.value && (
            <div class="reaction-details-modal__state" role="status">
              <Spin size="small" /> 正在加载反应用户…
            </div>
          )}
          {!loading.value && errorMessage.value && (
            <div class="reaction-details-modal__state is-error" role="alert">
              {errorMessage.value}
            </div>
          )}
          {!loading.value && !errorMessage.value && users.value.length === 0 && (
            <div class="reaction-details-modal__state">暂无可显示的反应用户</div>
          )}
          {hasMore.value && (
            <Button block loading={loading.value} onClick={() => void load()}>
              加载更多
            </Button>
          )}
        </div>
      </Modal>
    )
  }
})
