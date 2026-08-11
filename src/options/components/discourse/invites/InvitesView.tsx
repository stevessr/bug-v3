import { defineComponent, ref, computed, onMounted } from 'vue'
import { Spin, Empty, Input, Select, message } from 'ant-design-vue'
import {
  CopyOutlined,
  DeleteOutlined,
  SendOutlined,
  LinkOutlined,
  PlusOutlined,
  UserOutlined,
  ClockCircleOutlined
} from '@ant-design/icons-vue'

import type { DiscourseUserProfile, Invite, InvitesState } from '../types'
import { formatTime, getAvatarUrl, extractData, pageFetch } from '../utils'
import InviteExpireDropdown from '../../InviteExpireDropdown'
import '../css/InvitesView.css'

type InviteFilter = 'pending' | 'redeemed' | 'expired'

const FILTER_LABELS: Record<InviteFilter, string> = {
  pending: '待使用',
  redeemed: '已使用',
  expired: '已过期'
}

export default defineComponent({
  name: 'InvitesView',
  props: {
    user: { type: Object as () => DiscourseUserProfile | null, default: null },
    invitesState: { type: Object as () => InvitesState, required: true },
    baseUrl: { type: String, required: true }
  },
  emits: ['switchFilter', 'create', 'delete', 'resend', 'loadMore', 'goToProfile'],
  setup(props, { emit }) {
    const showCreateForm = ref(false)
    const email = ref('')
    const groupNames = ref<string[]>([])
    const groupOptions = ref<Array<{ label: string; value: string }>>([])
    const groupsLoading = ref(false)
    const maxRedemptions = ref('')
    const expiresAt = ref('')
    const expirePickerOpen = ref(false)
    const customMessage = ref('')
    const description = ref('')
    const skipEmail = ref(false)

    const filters: InviteFilter[] = ['pending', 'redeemed', 'expired']

    const inviteLink = (invite: Invite) => {
      if (invite.link) return invite.link
      if (invite.invite_key) {
        return `${props.baseUrl}/invites/${invite.invite_key}`
      }
      return ''
    }

    const visibleInvites = computed(() => props.invitesState.invites)

    const canCreate = computed(() => props.invitesState.canSeeInviteDetails)

    const handleCreate = () => {
      const payload: Record<string, any> = {}
      if (email.value.trim()) payload.email = email.value.trim()
      if (groupNames.value.length) {
        payload.groupNames = groupNames.value.map(g => g.trim()).filter(Boolean)
      }
      if (maxRedemptions.value.trim()) {
        const parsed = Number(maxRedemptions.value.trim())
        if (Number.isFinite(parsed) && parsed > 0) {
          payload.maxRedemptionsAllowed = parsed
        }
      }
      if (expiresAt.value) payload.expiresAt = expiresAt.value
      if (customMessage.value.trim()) payload.customMessage = customMessage.value.trim()
      if (description.value.trim()) payload.description = description.value.trim()
      if (skipEmail.value) payload.skipEmail = true

      emit('create', payload)
      showCreateForm.value = false
      email.value = ''
      groupNames.value = []
      maxRedemptions.value = ''
      expiresAt.value = ''
      expirePickerOpen.value = false
      customMessage.value = ''
      description.value = ''
      skipEmail.value = false
    }

    // 自动获取可用用户组（/groups.json），供创建邀请时选择；
    // 失败时保留可自由输入（Select mode="tags" 支持自建）。
    const loadGroups = async () => {
      if (groupsLoading.value) return
      groupsLoading.value = true
      try {
        const result = await pageFetch<any>(`${props.baseUrl}/groups.json`)
        const data = extractData(result)
        const raw = Array.isArray(data?.groups) ? data.groups : []
        groupOptions.value = raw
          .filter((group: any) => group && typeof group.name === 'string')
          .map((group: any) => ({
            label: group.full_name || group.display_name || group.name,
            value: group.name
          }))
      } catch {
        // 静默失败：回退为自由输入
      } finally {
        groupsLoading.value = false
      }
    }

    onMounted(loadGroups)

    const handleCopyLink = async (invite: Invite) => {
      const link = inviteLink(invite)
      if (!link) {
        message.warning('该邀请不包含链接（可能没有查看邀请详情的权限）')
        return
      }
      try {
        await navigator.clipboard.writeText(link)
        message.success('邀请链接已复制')
      } catch {
        message.error('复制失败，请手动复制')
      }
    }

    const getInviteMeta = (invite: Invite) => {
      const parts: string[] = []
      if (invite.email) parts.push(`📧 ${invite.email}`)
      if (invite.domain) parts.push(`🌐 ${invite.domain}`)
      if (invite.groups?.length) {
        parts.push(`👥 ${invite.groups.map(g => g.name).join(', ')}`)
      }
      if (invite.max_redemptions_allowed != null) {
        parts.push(`🔁 可兑换 ${invite.max_redemptions_allowed} 次`)
      }
      if (typeof invite.redemption_count === 'number') {
        parts.push(`已兑换 ${invite.redemption_count} 次`)
      }
      if (invite.expires_at) {
        parts.push(`⏳ 到期 ${formatTime(invite.expires_at)}`)
      }
      return parts
    }

    const getAvatarForRedeemed = (invite: Invite) => {
      if (invite.user?.avatar_template) {
        return getAvatarUrl(invite.user.avatar_template, props.baseUrl, 40)
      }
      return ''
    }

    return () => (
      <section class="invites-view" aria-labelledby="invites-view-title">
        <div class="invites-header">
          <button
            type="button"
            class="invites-header__profile"
            onClick={() => emit('goToProfile')}
            aria-label={props.user ? `查看 ${props.user.username} 的个人资料` : '查看个人资料'}
          >
            {props.user ? (
              <img
                src={getAvatarUrl(props.user.avatar_template, props.baseUrl, 48)}
                alt={props.user.username}
                class="invites-header__avatar"
                data-user-card={props.user.username}
              />
            ) : (
              <div class="invites-header__avatar invites-header__avatar--fallback">
                <LinkOutlined />
              </div>
            )}
            <span class="invites-header__profile-copy">
              <span id="invites-view-title" class="invites-header__username">
                {props.user?.username || '邀请管理'}
              </span>
              <span class="invites-header__subtitle">管理链接邀请、邮件邀请与兑换状态</span>
            </span>
          </button>

          <div class="invites-header__counts">
            {props.invitesState.counts.pending !== undefined && (
              <span class="invite-count invite-count--pending">
                待使用 {props.invitesState.counts.pending}
              </span>
            )}
            {props.invitesState.counts.redeemed !== undefined && (
              <span class="invite-count invite-count--redeemed">
                已使用 {props.invitesState.counts.redeemed}
              </span>
            )}
            {props.invitesState.counts.expired !== undefined && (
              <span class="invite-count invite-count--expired">
                已过期 {props.invitesState.counts.expired}
              </span>
            )}
          </div>
        </div>

        <div class="invites-toolbar">
          <div class="invites-tabs" role="tablist" aria-label="按邀请状态筛选">
            {filters.map(filter => (
              <button
                key={filter}
                type="button"
                role="tab"
                aria-selected={props.invitesState.filter === filter}
                class={['invites-tab', props.invitesState.filter === filter ? 'is-active' : '']}
                onClick={() => emit('switchFilter', filter)}
              >
                {FILTER_LABELS[filter]}
                {props.invitesState.counts[filter] !== undefined && (
                  <span class="invites-tab__count">{props.invitesState.counts[filter]}</span>
                )}
              </button>
            ))}
          </div>

          {canCreate.value && (
            <button
              type="button"
              class="invites-create-btn"
              aria-expanded={showCreateForm.value}
              aria-controls="discourse-invite-create-form"
              onClick={() => (showCreateForm.value = !showCreateForm.value)}
            >
              <PlusOutlined /> {showCreateForm.value ? '收起' : '创建邀请'}
            </button>
          )}
        </div>

        {showCreateForm.value && (
          <form
            id="discourse-invite-create-form"
            class="invites-form"
            onSubmit={(event: Event) => {
              event.preventDefault()
              handleCreate()
            }}
          >
            <div class="invites-form__heading">
              <h3>创建新邀请</h3>
              <p>填写邮箱可直接发送；留空则生成可复制的邀请链接。</p>
            </div>
            <div class="invites-form__grid">
              <label class="invites-form__field">
                <span>邮箱（留空则生成链接邀请码）</span>
                <Input
                  value={email.value}
                  placeholder="user@example.com"
                  onUpdate:value={(v: string) => (email.value = v)}
                />
              </label>
              <label class="invites-form__field">
                <span>用户组（可搜索选择，也可直接输入）</span>
                <Select
                  mode="tags"
                  value={groupNames.value}
                  options={groupOptions.value}
                  loading={groupsLoading.value}
                  placeholder="选择或输入用户组名"
                  maxTagCount="responsive"
                  onChange={(value: unknown) => {
                    groupNames.value = Array.isArray(value) ? value.map(item => String(item)) : []
                  }}
                />
              </label>
              <label class="invites-form__field">
                <span>最大兑换次数（仅链接邀请）</span>
                <Input
                  type="number"
                  value={maxRedemptions.value}
                  placeholder="例如 5"
                  onUpdate:value={(v: string) => (maxRedemptions.value = v)}
                />
              </label>
              <label class="invites-form__field">
                <span>过期时间</span>
                <div class="invites-form__expiry-wrap">
                  <button
                    type="button"
                    class="invites-form__expiry-btn"
                    aria-expanded={expirePickerOpen.value}
                    onClick={() => (expirePickerOpen.value = !expirePickerOpen.value)}
                  >
                    <ClockCircleOutlined />
                    <span>
                      {expiresAt.value ? formatTime(expiresAt.value) : '选择过期日期与时间'}
                    </span>
                  </button>
                  <InviteExpireDropdown
                    open={expirePickerOpen.value}
                    value={expiresAt.value}
                    onUpdate:open={(open: boolean) => (expirePickerOpen.value = open)}
                    onUpdate:value={(value: string) => (expiresAt.value = value)}
                  />
                </div>
              </label>
            </div>
            <label class="invites-form__field">
              <span>自定义消息（发送给被邀请者）</span>
              <Input.TextArea
                value={customMessage.value}
                placeholder="欢迎加入社区！"
                autoSize={{ minRows: 2, maxRows: 4 }}
                onUpdate:value={(v: string) => (customMessage.value = v)}
              />
            </label>
            <label class="invites-form__field">
              <span>描述（内部备注）</span>
              <Input
                value={description.value}
                placeholder="例如：周末活动邀请"
                onUpdate:value={(v: string) => (description.value = v)}
              />
            </label>
            <label class="invites-form__checkbox">
              <input
                type="checkbox"
                checked={skipEmail.value}
                onChange={(e: Event) => {
                  skipEmail.value = (e.target as HTMLInputElement).checked
                }}
              />
              <span>跳过发送邮件（仅生成链接）</span>
            </label>
            <div class="invites-form__actions">
              <button
                type="button"
                class="invites-form__cancel"
                onClick={() => (showCreateForm.value = false)}
              >
                取消
              </button>
              <button type="submit" class="invites-form__submit">
                <PlusOutlined /> 生成邀请
              </button>
            </div>
          </form>
        )}

        {props.invitesState.errorMessage && (
          <div class="invites-error" role="alert">
            {props.invitesState.errorMessage}
          </div>
        )}

        <div class="invites-list" aria-busy={props.invitesState.loading} aria-live="polite">
          {props.invitesState.loading && visibleInvites.value.length === 0 && (
            <div class="invites-loading">
              <Spin />
              <span>加载邀请...</span>
            </div>
          )}

          {!props.invitesState.loading && visibleInvites.value.length === 0 && (
            <div class="invites-empty">
              <Empty description={`暂无${FILTER_LABELS[props.invitesState.filter]}邀请`} />
            </div>
          )}

          {visibleInvites.value.map(invite => (
            <article key={invite.id} class="invite-item">
              <div class="invite-item__avatar">
                {getAvatarForRedeemed(invite) ? (
                  <img
                    src={getAvatarForRedeemed(invite)}
                    alt={invite.user?.username}
                    data-user-card={invite.user?.username}
                  />
                ) : (
                  <span class="invite-item__avatar-fallback">
                    {invite.email ? <SendOutlined /> : <LinkOutlined />}
                  </span>
                )}
              </div>

              <div class="invite-item__body">
                <div class="invite-item__title">
                  {invite.user ? (
                    <span class="invite-item__user">
                      <UserOutlined /> {invite.user.username}
                    </span>
                  ) : (
                    <span>
                      {invite.email || (invite.link ? '链接邀请码' : `邀请 #${invite.id}`)}
                    </span>
                  )}
                  {invite.expired && <span class="invite-badge is-expired">已过期</span>}
                  {invite.grants_admin && <span class="invite-badge is-admin">管理员</span>}
                  {invite.grants_moderator && <span class="invite-badge is-moderator">版主</span>}
                  {invite.emailed && !invite.expired && (
                    <span class="invite-badge is-emailed">已发邮件</span>
                  )}
                </div>

                {invite.description && (
                  <div class="invite-item__description">{invite.description}</div>
                )}

                {invite.custom_message && (
                  <div class="invite-item__custom">💬 {invite.custom_message}</div>
                )}

                {inviteLink(invite) && props.invitesState.filter === 'pending' && (
                  <div class="invite-item__link">
                    <span class="invite-item__link-text">{inviteLink(invite)}</span>
                    <button
                      type="button"
                      class="invite-item__copy"
                      onClick={() => handleCopyLink(invite)}
                      title="复制链接"
                      aria-label={`复制邀请 ${invite.id} 的链接`}
                    >
                      <CopyOutlined />
                    </button>
                  </div>
                )}

                {getInviteMeta(invite).length > 0 && (
                  <div class="invite-item__meta">
                    {getInviteMeta(invite).map((part, index) => (
                      <span key={index} class="invite-item__meta-part">
                        {part}
                      </span>
                    ))}
                  </div>
                )}

                <div class="invite-item__time">
                  创建于 {formatTime(invite.created_at || '')}
                  {invite.redeemed_at && ` · 使用于 ${formatTime(invite.redeemed_at)}`}
                </div>
              </div>

              <div class="invite-item__actions">
                {props.invitesState.filter === 'pending' && invite.email && (
                  <button
                    type="button"
                    class="invite-action-btn"
                    title="重发邀请邮件"
                    aria-label={`向 ${invite.email} 重发邀请邮件`}
                    onClick={() => emit('resend', invite.email)}
                  >
                    <SendOutlined />
                  </button>
                )}
                {invite.can_delete_invite !== false && (
                  <button
                    type="button"
                    class="invite-action-btn is-danger"
                    title="删除邀请"
                    aria-label={`删除邀请 ${invite.id}`}
                    onClick={() => emit('delete', invite.id)}
                  >
                    <DeleteOutlined />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>

        {props.invitesState.hasMore && !props.invitesState.loading && (
          <div class="invites-loadmore">
            <button type="button" class="invites-loadmore__btn" onClick={() => emit('loadMore')}>
              加载更多
            </button>
          </div>
        )}
      </section>
    )
  }
})
