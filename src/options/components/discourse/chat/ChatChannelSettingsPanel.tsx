import { computed, defineComponent, ref, watch } from 'vue'
import type { PropType } from 'vue'
import { Input, Select, Switch } from 'ant-design-vue'
import {
  BellOutlined,
  MessageOutlined,
  PushpinOutlined,
  SafetyCertificateOutlined,
  StarOutlined,
  TeamOutlined
} from '@ant-design/icons-vue'

import type {
  ChatChannel,
  ChatChannelEditableStatus,
  ChatChannelUpdatePayload,
  ChatMembershipUpdatePayload
} from '../types'

type NotificationLevel = 'always' | 'mention' | 'never'

const normalizeNotificationLevel = (value: unknown): NotificationLevel => {
  if (value === 'always' || value === 2 || value === '2') return 'always'
  if (value === 'never' || value === 0 || value === '0') return 'never'
  return 'mention'
}

const channelDisplayName = (channel: ChatChannel) =>
  channel.title || channel.unicode_title || channel.chatable?.name || ''

export default defineComponent({
  name: 'ChatChannelSettingsPanel',
  props: {
    channel: { type: Object as PropType<ChatChannel>, required: true },
    savingChannel: { type: Boolean, default: false },
    savingMembership: { type: Boolean, default: false },
    savingStatus: { type: Boolean, default: false },
    savingFollow: { type: Boolean, default: false }
  },
  emits: ['updateChannel', 'updateMembership', 'updateStatus', 'follow', 'unfollow'],
  setup(props, { emit }) {
    const name = ref('')
    const description = ref('')
    const slug = ref('')
    const emoji = ref('')
    const threadingEnabled = ref(false)
    const autoJoinUsers = ref(false)
    const allowChannelWideMentions = ref(false)
    const validationMessage = ref('')

    const isDirect = computed(
      () =>
        props.channel.channelType === 'direct' ||
        props.channel.chatable_type === 'DirectMessage' ||
        !!props.channel.chatable?.users?.length
    )
    const isCategory = computed(() => props.channel.chatable_type?.toLowerCase() === 'category')
    const canModerate = computed(() =>
      Boolean(props.channel.meta?.can_moderate || props.channel.meta?.can_manage)
    )
    const canEditChannel = computed(() => canModerate.value && !isDirect.value)
    const canEditCategorySettings = computed(() => canEditChannel.value && isCategory.value)
    const membership = computed(() => props.channel.current_user_membership)
    const hasMembership = computed(() => !!membership.value)
    const canFollow = computed(
      () => hasMembership.value || !!props.channel.meta?.can_join_chat_channel
    )
    const isFollowing = computed(() => hasMembership.value && membership.value?.following !== false)
    const statusValue = computed(() => props.channel.status || 'open')

    const syncChannelForm = () => {
      name.value = channelDisplayName(props.channel)
      description.value = props.channel.description || ''
      slug.value = props.channel.slug || ''
      emoji.value = props.channel.emoji || props.channel.chatable?.emoji || ''
      threadingEnabled.value = !!props.channel.threading_enabled
      autoJoinUsers.value = !!props.channel.auto_join_users
      allowChannelWideMentions.value = !!props.channel.allow_channel_wide_mentions
      validationMessage.value = ''
    }

    watch(
      () => [
        props.channel.id,
        props.channel.title,
        props.channel.unicode_title,
        props.channel.description,
        props.channel.slug,
        props.channel.emoji,
        props.channel.threading_enabled,
        props.channel.auto_join_users,
        props.channel.allow_channel_wide_mentions
      ],
      syncChannelForm,
      { immediate: true }
    )

    const hasChannelChanges = computed(() => {
      const sourceEmoji = props.channel.emoji || props.channel.chatable?.emoji || ''
      return (
        name.value.trim() !== channelDisplayName(props.channel).trim() ||
        description.value.trim() !== (props.channel.description || '').trim() ||
        slug.value.trim() !== (props.channel.slug || '').trim() ||
        emoji.value.trim() !== sourceEmoji.trim() ||
        threadingEnabled.value !== !!props.channel.threading_enabled ||
        autoJoinUsers.value !== !!props.channel.auto_join_users ||
        allowChannelWideMentions.value !== !!props.channel.allow_channel_wide_mentions
      )
    })

    const saveChannel = () => {
      if (!canEditChannel.value || props.savingChannel || !hasChannelChanges.value) return
      if (!name.value.trim()) {
        validationMessage.value = '频道标题不能为空'
        return
      }

      const updates: ChatChannelUpdatePayload = {
        name: name.value.trim(),
        description: description.value.trim(),
        slug: slug.value.trim(),
        emoji: emoji.value.trim(),
        threading_enabled: threadingEnabled.value
      }
      if (isCategory.value) {
        updates.auto_join_users = autoJoinUsers.value
        updates.allow_channel_wide_mentions = allowChannelWideMentions.value
      }
      validationMessage.value = ''
      emit('updateChannel', { channelId: props.channel.id, updates })
    }

    const updateMembership = (updates: ChatMembershipUpdatePayload) => {
      if (!hasMembership.value || props.savingMembership) return
      emit('updateMembership', { channelId: props.channel.id, updates })
    }

    const updateStatus = (value: unknown) => {
      if (
        !canEditChannel.value ||
        props.savingStatus ||
        (value !== 'open' && value !== 'closed') ||
        value === statusValue.value
      ) {
        return
      }
      emit('updateStatus', {
        channelId: props.channel.id,
        status: value as ChatChannelEditableStatus
      })
    }

    const fieldDisabledCaption = computed(() => {
      if (isDirect.value) return '直接消息的频道字段由 Discourse 管理'
      if (!canModerate.value) return '仅频道管理员可修改'
      return ''
    })

    const renderSwitchRow = (
      id: string,
      title: string,
      caption: string,
      checked: boolean,
      disabled: boolean,
      onChange: (checked: boolean) => void,
      icon?: JSX.Element
    ) => (
      <div class={['chat-settings-row', disabled && 'is-disabled']}>
        <div class="chat-settings-row__copy">
          <div class="chat-settings-row__title">
            {icon}
            <label for={id}>{title}</label>
          </div>
          <div class="chat-settings-row__caption">{caption}</div>
        </div>
        <Switch
          id={id}
          checked={checked}
          disabled={disabled}
          aria-label={title}
          onChange={value => onChange(Boolean(value))}
        />
      </div>
    )

    return () => {
      const currentMembership = membership.value
      const fieldsDisabled = !canEditChannel.value || props.savingChannel
      const categoryFieldsDisabled = !canEditCategorySettings.value || props.savingChannel
      const membershipDisabled = !hasMembership.value || props.savingMembership
      const statusCanChange =
        canEditChannel.value && (statusValue.value === 'open' || statusValue.value === 'closed')
      const statusOptions = [
        { value: 'open', label: '开放（可发送消息）' },
        { value: 'closed', label: '关闭（暂停新消息）' }
      ]
      if (statusValue.value !== 'open' && statusValue.value !== 'closed') {
        statusOptions.push({ value: statusValue.value, label: `当前：${statusValue.value}` })
      }

      return (
        <div class="chat-settings-panel">
          <section class="chat-settings-card" aria-labelledby="chat-personal-settings-title">
            <div class="chat-settings-card__heading">
              <div>
                <h3 id="chat-personal-settings-title">我的频道设置</h3>
                <p>通知、收藏和关注设置只影响当前账号。</p>
              </div>
            </div>

            {renderSwitchRow(
              'chat-setting-muted',
              '将频道设为免打扰',
              '停止该频道的聊天通知，仍可随时查看消息。',
              !!currentMembership?.muted,
              membershipDisabled,
              checked => updateMembership({ muted: checked }),
              <BellOutlined />
            )}

            <div class={['chat-settings-row', membershipDisabled && 'is-disabled']}>
              <div class="chat-settings-row__copy">
                <div class="chat-settings-row__title">
                  <MessageOutlined />
                  <label for="chat-setting-notification-level">通知级别</label>
                </div>
                <div class="chat-settings-row__caption">选择所有消息、仅提及或从不通知。</div>
              </div>
              <Select
                id="chat-setting-notification-level"
                class="chat-settings-row__control"
                value={normalizeNotificationLevel(currentMembership?.notification_level)}
                disabled={membershipDisabled}
                options={[
                  { value: 'always', label: '所有消息' },
                  { value: 'mention', label: '仅提及' },
                  { value: 'never', label: '从不' }
                ]}
                onUpdate:value={value => updateMembership({ notification_level: String(value) })}
              />
            </div>

            {renderSwitchRow(
              'chat-setting-starred',
              '收藏频道',
              '将频道固定在收藏区域，便于快速访问。',
              !!currentMembership?.starred,
              membershipDisabled,
              checked => updateMembership({ starred: checked }),
              <StarOutlined />
            )}

            {renderSwitchRow(
              'chat-setting-following',
              '关注频道',
              hasMembership.value
                ? '取消关注后不再追踪新消息，但不会删除频道。'
                : '加入并开始关注该频道。',
              isFollowing.value,
              !canFollow.value || props.savingFollow,
              checked => emit(checked ? 'follow' : 'unfollow', props.channel.id),
              <PushpinOutlined />
            )}

            {!hasMembership.value && (
              <div class="chat-settings-card__notice">当前账号没有可编辑的频道成员资料。</div>
            )}
          </section>

          <section class="chat-settings-card" aria-labelledby="chat-channel-settings-title">
            <div class="chat-settings-card__heading">
              <div>
                <h3 id="chat-channel-settings-title">频道信息</h3>
                <p>编辑 Discourse 频道接口提供的所有频道字段。</p>
              </div>
              <span class="chat-settings-card__permission">
                {canEditChannel.value ? '可编辑' : '只读'}
              </span>
            </div>

            {fieldDisabledCaption.value && (
              <div class="chat-settings-card__notice">{fieldDisabledCaption.value}</div>
            )}

            <div class="chat-settings-field-grid">
              <label class="chat-settings-field is-wide" for="chat-setting-name">
                <span>标题</span>
                <Input
                  id="chat-setting-name"
                  value={name.value}
                  maxlength={100}
                  disabled={fieldsDisabled}
                  placeholder="频道标题"
                  onUpdate:value={value => (name.value = String(value))}
                />
              </label>

              <label class="chat-settings-field is-wide" for="chat-setting-description">
                <span>描述</span>
                <Input.TextArea
                  id="chat-setting-description"
                  value={description.value}
                  maxlength={500}
                  autoSize={{ minRows: 2, maxRows: 5 }}
                  disabled={fieldsDisabled}
                  placeholder="频道用途和规则"
                  onUpdate:value={value => (description.value = String(value))}
                />
              </label>

              <label class="chat-settings-field" for="chat-setting-slug">
                <span>Slug</span>
                <Input
                  id="chat-setting-slug"
                  value={slug.value}
                  disabled={fieldsDisabled}
                  placeholder="channel-slug"
                  onUpdate:value={value => (slug.value = String(value))}
                />
              </label>

              <label class="chat-settings-field" for="chat-setting-emoji">
                <span>频道表情</span>
                <Input
                  id="chat-setting-emoji"
                  value={emoji.value}
                  disabled={fieldsDisabled}
                  placeholder="speech_balloon"
                  onUpdate:value={value => (emoji.value = String(value))}
                />
              </label>
            </div>

            {renderSwitchRow(
              'chat-setting-threading',
              '启用消息串',
              '允许围绕单条消息创建独立对话。',
              threadingEnabled.value,
              fieldsDisabled,
              checked => (threadingEnabled.value = checked),
              <MessageOutlined />
            )}

            {renderSwitchRow(
              'chat-setting-auto-join',
              '用户自动加入',
              isCategory.value
                ? '让有权访问关联分类的用户自动加入频道。'
                : '仅 Discourse 分类频道支持此配置。',
              autoJoinUsers.value,
              categoryFieldsDisabled,
              checked => (autoJoinUsers.value = checked),
              <TeamOutlined />
            )}

            {renderSwitchRow(
              'chat-setting-wide-mentions',
              '允许全频道提及',
              isCategory.value
                ? '允许使用 @all 等全频道提及。'
                : '仅 Discourse 分类频道支持此配置。',
              allowChannelWideMentions.value,
              categoryFieldsDisabled,
              checked => (allowChannelWideMentions.value = checked),
              <SafetyCertificateOutlined />
            )}

            {validationMessage.value && (
              <div class="chat-settings-validation" role="alert">
                {validationMessage.value}
              </div>
            )}

            <div class="chat-settings-card__actions">
              <button
                type="button"
                class="chat-settings-button is-secondary"
                disabled={!hasChannelChanges.value || props.savingChannel}
                onClick={syncChannelForm}
              >
                重置
              </button>
              <button
                type="button"
                class="chat-settings-button is-primary"
                disabled={!canEditChannel.value || !hasChannelChanges.value || props.savingChannel}
                onClick={saveChannel}
              >
                {props.savingChannel ? '保存中…' : '保存频道信息'}
              </button>
            </div>
          </section>

          <section class="chat-settings-card" aria-labelledby="chat-status-settings-title">
            <div class="chat-settings-card__heading">
              <div>
                <h3 id="chat-status-settings-title">频道状态</h3>
                <p>开放或关闭频道的新消息。归档和只读状态仅作展示。</p>
              </div>
            </div>
            <div class="chat-settings-row">
              <div class="chat-settings-row__copy">
                <div class="chat-settings-row__title">当前状态</div>
                <div class="chat-settings-row__caption">
                  {statusCanChange ? '状态修改会立即生效。' : '当前状态或权限不允许在此修改。'}
                </div>
              </div>
              <Select
                id="chat-setting-status"
                class="chat-settings-row__control"
                value={statusValue.value}
                options={statusOptions}
                disabled={!statusCanChange || props.savingStatus}
                onUpdate:value={updateStatus}
              />
            </div>
          </section>
        </div>
      )
    }
  }
})
