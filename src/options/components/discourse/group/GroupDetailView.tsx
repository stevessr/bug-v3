import { defineComponent, onMounted, ref } from 'vue'
import { Input, message } from 'ant-design-vue'
import {
  ArrowLeftOutlined,
  ClockCircleOutlined,
  LinkOutlined,
  PlusOutlined,
  TeamOutlined,
  UserOutlined
} from '@ant-design/icons-vue'

import type { DiscourseGroup } from '../types'
import { extractData, pageFetch } from '../utils'
import InviteExpireDropdown from '../../InviteExpireDropdown'

import '../css/GroupDetailView.css'

type GroupMember = {
  id: number
  username: string
  name?: string
  avatar_template?: string
}

export default defineComponent({
  name: 'GroupDetailView',
  props: {
    groupName: { type: String, required: true },
    baseUrl: { type: String, required: true }
  },
  emits: ['goToProfile', 'openUser', 'createInvite'],
  setup(props, { emit }) {
    const group = ref<DiscourseGroup | null>(null)
    const members = ref<GroupMember[]>([])
    const loading = ref(true)
    const errorMessage = ref('')

    const showInviteForm = ref(false)
    const inviteEmail = ref('')
    const inviteMaxRedemptions = ref('')
    const inviteExpiresAt = ref('')
    const inviteExpirePickerOpen = ref(false)
    const inviteMessage = ref('')
    const inviteSaving = ref(false)

    const loadGroup = async () => {
      loading.value = true
      errorMessage.value = ''
      try {
        const result = await pageFetch<any>(
          `${props.baseUrl}/g/${encodeURIComponent(props.groupName)}.json`
        )
        const data = extractData(result)
        if (result.ok && data) {
          group.value = data.group || (data as DiscourseGroup)
          members.value = Array.isArray(data.members)
            ? data.members
            : Array.isArray(data.users)
              ? data.users
              : []
          if (!group.value?.name && typeof data.name === 'string') {
            group.value = data as DiscourseGroup
          }
        } else {
          errorMessage.value = '加载分组失败'
        }
      } catch {
        errorMessage.value = '加载分组失败'
      } finally {
        loading.value = false
      }
    }

    const handleCopyLink = async () => {
      try {
        await navigator.clipboard.writeText(
          `${props.baseUrl}/g/${encodeURIComponent(props.groupName)}`
        )
        message.success('分组链接已复制')
      } catch {
        message.error('复制失败，请手动复制')
      }
    }

    const submitInvite = () => {
      const payload: Record<string, any> = {
        groupNames: [group.value?.name || props.groupName]
      }
      if (inviteEmail.value.trim()) payload.email = inviteEmail.value.trim()
      if (inviteMaxRedemptions.value.trim()) {
        const parsed = Number(inviteMaxRedemptions.value.trim())
        if (Number.isFinite(parsed) && parsed > 0) {
          payload.maxRedemptionsAllowed = parsed
        }
      }
      if (inviteExpiresAt.value) payload.expiresAt = inviteExpiresAt.value
      if (inviteMessage.value.trim()) payload.customMessage = inviteMessage.value.trim()
      inviteSaving.value = true
      emit('createInvite', payload)
      // 父组件保存成功后由它提示；这里稍作停顿后收起表单并复位
      window.setTimeout(() => {
        inviteSaving.value = false
        showInviteForm.value = false
        inviteEmail.value = ''
        inviteMaxRedemptions.value = ''
        inviteExpiresAt.value = ''
        inviteExpirePickerOpen.value = false
        inviteMessage.value = ''
      }, 300)
    }

    onMounted(loadGroup)

    return () => (
      <div class="group-detail-view" aria-labelledby="group-detail-title">
        <div class="group-detail-toolbar">
          <button
            type="button"
            class="user-extras-back-btn"
            onClick={() => emit('goToProfile')}
            aria-label="返回"
          >
            <ArrowLeftOutlined /> 返回
          </button>
          <h3 id="group-detail-title" class="user-extras-section-title">
            分组详情
          </h3>
          <button
            type="button"
            class="group-detail-copy-btn"
            onClick={() => void handleCopyLink()}
            aria-label="复制分组链接"
            title="复制分组链接"
          >
            <LinkOutlined />
          </button>
        </div>

        {loading.value && (
          <section class="user-extras-card">
            <div class="user-extras-state-loading">加载分组中...</div>
          </section>
        )}

        {!loading.value && errorMessage.value && (
          <section class="user-extras-card">
            <div class="user-extras-empty">{errorMessage.value}</div>
          </section>
        )}

        {!loading.value && !errorMessage.value && group.value && (
          <>
            <section class="user-extras-card">
              <div class="group-detail-header">
                <div class="group-detail-header__avatar" aria-hidden="true">
                  {(group.value.full_name || group.value.name || 'G').slice(0, 1).toUpperCase()}
                </div>
                <div class="group-detail-header__info">
                  <div class="group-detail-header__title">
                    {group.value.full_name || group.value.title || group.value.name}
                  </div>
                  <div class="group-detail-header__slug">@{group.value.name}</div>
                  {group.value.description && (
                    <p class="group-detail-header__desc">{group.value.description}</p>
                  )}
                </div>
                <div class="group-detail-header__meta">
                  <span class="group-detail-header__count">
                    <TeamOutlined /> {group.value.user_count ?? members.value.length} 成员
                  </span>
                  <button
                    type="button"
                    class="group-detail-invite-btn"
                    aria-expanded={showInviteForm.value}
                    onClick={() => (showInviteForm.value = !showInviteForm.value)}
                  >
                    <PlusOutlined /> {showInviteForm.value ? '收起邀请' : '快速邀请'}
                  </button>
                </div>
              </div>
            </section>

            {showInviteForm.value && (
              <section class="user-extras-card">
                <form
                  class="group-detail-invite-form"
                  onSubmit={(event: Event) => {
                    event.preventDefault()
                    submitInvite()
                  }}
                >
                  <h4>生成加入 {group.value.full_name || group.value.name} 的邀请</h4>
                  <div class="group-detail-invite-form__grid">
                    <label class="group-detail-invite-field">
                      <span>邮箱（留空则生成链接邀请码）</span>
                      <Input
                        value={inviteEmail.value}
                        placeholder="user@example.com"
                        onUpdate:value={(v: string) => (inviteEmail.value = v)}
                      />
                    </label>
                    <label class="group-detail-invite-field">
                      <span>最大兑换次数（仅链接邀请）</span>
                      <Input
                        type="number"
                        value={inviteMaxRedemptions.value}
                        placeholder="例如 5"
                        onUpdate:value={(v: string) => (inviteMaxRedemptions.value = v)}
                      />
                    </label>
                    <label class="group-detail-invite-field">
                      <span>过期时间</span>
                      <div class="invites-form__expiry-wrap">
                        <button
                          type="button"
                          class="invites-form__expiry-btn"
                          aria-expanded={inviteExpirePickerOpen.value}
                          onClick={() =>
                            (inviteExpirePickerOpen.value = !inviteExpirePickerOpen.value)
                          }
                        >
                          <ClockCircleOutlined />
                          <span>
                            {inviteExpiresAt.value
                              ? new Date(inviteExpiresAt.value).toLocaleString()
                              : '选择过期日期与时间'}
                          </span>
                        </button>
                        <InviteExpireDropdown
                          open={inviteExpirePickerOpen.value}
                          value={inviteExpiresAt.value}
                          onUpdate:open={(open: boolean) => (inviteExpirePickerOpen.value = open)}
                          onUpdate:value={(value: string) => (inviteExpiresAt.value = value)}
                        />
                      </div>
                    </label>
                    <label class="group-detail-invite-field">
                      <span>自定义消息</span>
                      <Input
                        value={inviteMessage.value}
                        placeholder="欢迎加入！"
                        onUpdate:value={(v: string) => (inviteMessage.value = v)}
                      />
                    </label>
                  </div>
                  <div class="group-detail-invite-form__actions">
                    <button
                      type="button"
                      class="invites-form__cancel"
                      onClick={() => (showInviteForm.value = false)}
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      class="invites-form__submit"
                      disabled={inviteSaving.value}
                    >
                      <PlusOutlined /> 生成邀请
                    </button>
                  </div>
                </form>
              </section>
            )}

            <section class="user-extras-card">
              <div class="user-extras-group-members">
                <div class="user-extras-group-members__title">
                  {group.value.full_name || group.value.name} 成员
                </div>
                {members.value.length === 0 ? (
                  <div class="user-extras-state-end">暂无成员数据</div>
                ) : (
                  <div class="user-extras-member-grid">
                    {members.value.slice(0, 60).map(member => (
                      <button
                        key={member.id}
                        type="button"
                        class="user-extras-member-pill"
                        onClick={() => emit('openUser', member.username)}
                        data-user-card={member.username}
                      >
                        {member.avatar_template ? (
                          <img
                            src={member.avatar_template.replace('{size}', '40')}
                            alt={member.username}
                            loading="lazy"
                          />
                        ) : (
                          <UserOutlined />
                        )}
                        <span>{member.name || member.username}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    )
  }
})
