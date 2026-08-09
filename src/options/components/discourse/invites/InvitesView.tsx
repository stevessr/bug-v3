import { defineComponent, ref, computed } from 'vue'
import { Spin, Empty, Input, message } from 'ant-design-vue'
import {
  CopyOutlined,
  DeleteOutlined,
  SendOutlined,
  LinkOutlined,
  PlusOutlined,
  UserOutlined
} from '@ant-design/icons-vue'

import type { DiscourseUserProfile, Invite, InvitesState } from '../types'
import { formatTime, getAvatarUrl } from '../utils'
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
    const groupNames = ref('')
    const maxRedemptions = ref('')
    const expiresAt = ref('')
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
      if (groupNames.value.trim()) {
        payload.groupNames = groupNames.value
          .split(/[,，\s]+/)
          .map(g => g.trim())
          .filter(Boolean)
      }
      if (maxRedemptions.value.trim()) {
        const parsed = Number(maxRedemptions.value.trim())
        if (Number.isFinite(parsed) && parsed > 0) {
          payload.maxRedemptionsAllowed = parsed
        }
      }
      if (expiresAt.value) payload.expiresAt = new Date(expiresAt.value).toISOString()
      if (customMessage.value.trim()) payload.customMessage = customMessage.value.trim()
      if (description.value.trim()) payload.description = description.value.trim()
      if (skipEmail.value) payload.skipEmail = true

      emit('create', payload)
      showCreateForm.value = false
      email.value = ''
      groupNames.value = ''
      maxRedemptions.value = ''
      expiresAt.value = ''
      customMessage.value = ''
      description.value = ''
      skipEmail.value = false
    }

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
      <div class="invites-view">
        <div class="invites-header">
          <div class="invites-header__profile" onClick={() => emit('goToProfile')}>
            {props.user ? (
              <img
                src={getAvatarUrl(props.user.avatar_template, props.baseUrl, 48)}
                alt={props.user.username}
                class="invites-header__avatar"
              />
            ) : (
              <div class="invites-header__avatar invites-header__avatar--fallback">
                <LinkOutlined />
              </div>
            )}
            <div>
              <div class="invites-header__username">
                {props.user?.username || '邀请管理'}
              </div>
              <div class="invites-header__subtitle">邀请管理</div>
            </div>
          </div>

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
          <div class="invites-tabs">
            {filters.map(filter => (
              <button
                key={filter}
                class={[
                  'invites-tab',
                  props.invitesState.filter === filter ? 'is-active' : ''
                ]}
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
            <button class="invites-create-btn" onClick={() => (showCreateForm.value = !showCreateForm.value)}>
              <PlusOutlined /> {showCreateForm.value ? '收起' : '创建邀请'}
            </button>
          )}
        </div>

        {showCreateForm.value && (
          <div class="invites-form">
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
                <span>用户组（逗号分隔）</span>
                <Input
                  value={groupNames.value}
                  placeholder="trust_level_1, 新用户"
                  onUpdate:value={(v: string) => (groupNames.value = v)}
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
                <Input
                  type="datetime-local"
                  value={expiresAt.value}
                  onUpdate:value={(v: string) => (expiresAt.value = v)}
                />
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
              <button class="invites-form__submit" onClick={handleCreate}>
                <PlusOutlined /> 生成邀请
              </button>
            </div>
          </div>
        )}

        {props.invitesState.errorMessage && (
          <div class="invites-error">{props.invitesState.errorMessage}</div>
        )}

        <div class="invites-list">
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
            <div key={invite.id} class="invite-item">
              <div class="invite-item__avatar">
                {getAvatarForRedeemed(invite) ? (
                  <img src={getAvatarForRedeemed(invite)} alt={invite.user?.username} />
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
                    <span>{invite.email || (invite.link ? '链接邀请码' : `邀请 #${invite.id}`)}</span>
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
                      class="invite-item__copy"
                      onClick={() => handleCopyLink(invite)}
                      title="复制链接"
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
                    class="invite-action-btn"
                    title="重发邀请邮件"
                    onClick={() => emit('resend', invite.email)}
                  >
                    <SendOutlined />
                  </button>
                )}
                {invite.can_delete_invite !== false && (
                  <button
                    class="invite-action-btn is-danger"
                    title="删除邀请"
                    onClick={() => emit('delete', invite.id)}
                  >
                    <DeleteOutlined />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {props.invitesState.hasMore && !props.invitesState.loading && (
          <div class="invites-loadmore">
            <button class="invites-loadmore__btn" onClick={() => emit('loadMore')}>
              加载更多
            </button>
          </div>
        )}
      </div>
    )
  }
})
