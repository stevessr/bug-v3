import { computed, defineComponent, onBeforeUnmount, ref, watch } from 'vue'
import { message } from 'ant-design-vue'

import type { DiscourseTopicDetail, DiscourseUser } from '../types'
import { extractData, getAvatarUrl, pageFetch } from '../utils'
import { inviteUserToPrivateMessage, removeUserFromPrivateMessage } from '../actions'

import '../css/PrivateMessageParticipants.css'

export default defineComponent({
  name: 'PrivateMessageParticipants',
  props: {
    topic: { type: Object as () => DiscourseTopicDetail, required: true },
    baseUrl: { type: String, required: true },
    currentUsername: { type: String, default: '' }
  },
  emits: ['openUser', 'refresh'],
  setup(props, { emit }) {
    const expanded = ref(true)
    const usernameInput = ref('')
    const saving = ref(false)
    const searching = ref(false)
    const searchResults = ref<DiscourseUser[]>([])
    let searchTimer: ReturnType<typeof setTimeout> | null = null

    const participants = computed(() => {
      const values: DiscourseUser[] = []
      const allowed = props.topic.details?.allowed_users || []
      allowed.forEach(user => values.push(user))
      ;(props.topic.details?.participants || []).forEach(value => {
        const user = 'user' in value ? value.user : value
        if (user?.username) values.push(user)
      })
      if (props.topic.details?.created_by?.username) values.push(props.topic.details.created_by)

      const unique = new Map<string, DiscourseUser>()
      values.forEach(user => {
        if (!user?.username) return
        unique.set(user.username.toLowerCase(), user)
      })
      return [...unique.values()]
    })

    const groups = computed(() => props.topic.details?.allowed_groups || [])
    const canInvite = computed(() => props.topic.details?.can_invite_to === true)
    const canRemove = computed(() => props.topic.details?.can_remove_allowed_users === true)
    const canLeave = computed(
      () =>
        Boolean(props.currentUsername) &&
        participants.value.some(
          user => user.username.toLowerCase() === props.currentUsername.toLowerCase()
        )
    )

    const searchUsers = async (query: string) => {
      const term = query.trim().replace(/^@/, '')
      if (!term) {
        searchResults.value = []
        return
      }
      searching.value = true
      try {
        const result = await pageFetch<any>(
          `${props.baseUrl}/u/search.json?term=${encodeURIComponent(term)}&limit=8`
        )
        const data = extractData(result)
        const users = Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : []
        searchResults.value = users.filter(
          (user: DiscourseUser) =>
            user?.username &&
            !participants.value.some(
              member => member.username.toLowerCase() === user.username.toLowerCase()
            )
        )
      } catch {
        searchResults.value = []
      } finally {
        searching.value = false
      }
    }

    watch(usernameInput, value => {
      if (searchTimer) clearTimeout(searchTimer)
      const term = value.trim()
      if (!term) {
        searchResults.value = []
        return
      }
      searchTimer = setTimeout(() => void searchUsers(term), 220)
    })

    onBeforeUnmount(() => {
      if (searchTimer) clearTimeout(searchTimer)
    })

    const addParticipant = async (selectedUsername?: string) => {
      const username = (selectedUsername || usernameInput.value).trim().replace(/^@/, '')
      if (!username || saving.value) return
      if (participants.value.some(user => user.username.toLowerCase() === username.toLowerCase())) {
        message.info('@' + username + ' 已在私信中')
        return
      }

      saving.value = true
      try {
        const userResult = await pageFetch<any>(
          `${props.baseUrl}/u/${encodeURIComponent(username)}.json`
        )
        const userData = extractData(userResult)
        const user = userData?.user as DiscourseUser | undefined
        if (!user?.id || !user.username) throw new Error('未找到该用户')

        await inviteUserToPrivateMessage(props.baseUrl, props.topic.id, username)
        if (!props.topic.details.allowed_users) props.topic.details.allowed_users = []
        props.topic.details.allowed_users.push(user)
        usernameInput.value = ''
        searchResults.value = []
        message.success(`已添加 @${user.username}`)
        emit('refresh')
      } catch (error) {
        message.error(error instanceof Error ? error.message : '添加参与者失败')
      } finally {
        saving.value = false
      }
    }

    const leavePrivateMessage = async () => {
      if (!canLeave.value || saving.value || !props.currentUsername) return
      // eslint-disable-next-line no-alert
      if (!window.confirm('确定退出这个私信吗？退出后需要再次被邀请才能回来。')) return
      saving.value = true
      try {
        await removeUserFromPrivateMessage(props.baseUrl, props.topic.id, props.currentUsername)
        message.success('已退出私信')
        emit('refresh')
      } catch (error) {
        message.error(error instanceof Error ? error.message : '退出私信失败')
      } finally {
        saving.value = false
      }
    }

    const removeParticipant = async (user: DiscourseUser) => {
      if (!canRemove.value || saving.value) return
      if (user.username.toLowerCase() === props.currentUsername.toLowerCase()) return
      // eslint-disable-next-line no-alert
      if (!window.confirm(`确定将 @${user.username} 移出这个私信吗？`)) return

      saving.value = true
      try {
        await removeUserFromPrivateMessage(props.baseUrl, props.topic.id, user.username)
        const allowed = props.topic.details.allowed_users || []
        props.topic.details.allowed_users = allowed.filter(
          item => item.username.toLowerCase() !== user.username.toLowerCase()
        )
        message.success(`已移除 @${user.username}`)
        emit('refresh')
      } catch (error) {
        message.error(error instanceof Error ? error.message : '移除参与者失败')
      } finally {
        saving.value = false
      }
    }

    return () => (
      <section class="pm-participants" aria-label="私信参与者">
        <button
          type="button"
          class="pm-participants__heading"
          aria-expanded={expanded.value}
          onClick={() => (expanded.value = !expanded.value)}
        >
          <span class="pm-participants__chevron" aria-hidden="true">
            {expanded.value ? '▼' : '▶'}
          </span>
          <strong>参与者</strong>
          <span class="pm-participants__count">{participants.value.length} 人</span>
          {groups.value.length > 0 && (
            <span class="pm-participants__groups">+ {groups.value.length} 个群组</span>
          )}
        </button>

        {expanded.value && (
          <div class="pm-participants__content">
            <div class="pm-participants__list">
              {participants.value.map(user => (
                <div class="pm-participants__person" key={user.id || user.username}>
                  <button
                    type="button"
                    class="pm-participants__identity"
                    data-user-card={user.username}
                    data-discourse-url={`${props.baseUrl}/u/${encodeURIComponent(user.username)}`}
                    onClick={() => emit('openUser', user.username)}
                  >
                    <img
                      src={getAvatarUrl(user.avatar_template, props.baseUrl, 32)}
                      alt=""
                      loading="lazy"
                    />
                    <span>
                      <strong>{user.name || user.username}</strong>
                      <small>@{user.username}</small>
                    </span>
                  </button>
                  {canRemove.value &&
                    user.username.toLowerCase() !== props.currentUsername.toLowerCase() && (
                      <button
                        type="button"
                        class="pm-participants__remove"
                        disabled={saving.value}
                        aria-label={`移除 @${user.username}`}
                        title="移除参与者"
                        onClick={() => void removeParticipant(user)}
                      >
                        −
                      </button>
                    )}
                </div>
              ))}
              {groups.value.map(group => (
                <div class="pm-participants__group" key={`group-${group.id}`}>
                  <span aria-hidden="true">#</span>
                  <strong>{group.full_name || group.name}</strong>
                </div>
              ))}
            </div>

            {(canInvite.value || canLeave.value) && (
              <aside class="pm-participants__editor" aria-label="编辑私信参与者">
                {canInvite.value && (
                  <form
                    class="pm-participants__add"
                    onSubmit={(event: Event) => {
                      event.preventDefault()
                      void addParticipant()
                    }}
                  >
                    <label for="pm-participant-username">添加参与者</label>
                    <div class="pm-participants__add-row">
                      <input
                        id="pm-participant-username"
                        value={usernameInput.value}
                        disabled={saving.value}
                        placeholder="输入用户名查找"
                        aria-label="新参与者用户名"
                        autocomplete="off"
                        onInput={(event: Event) =>
                          (usernameInput.value = (event.target as HTMLInputElement).value)
                        }
                      />
                      <button type="submit" disabled={saving.value || !usernameInput.value.trim()}>
                        {saving.value ? '处理中…' : '添加'}
                      </button>
                    </div>
                    {(searching.value || searchResults.value.length > 0) && (
                      <div class="pm-participants__suggestions" role="listbox">
                        {searching.value && <span>正在查找…</span>}
                        {!searching.value &&
                          searchResults.value.map(user => (
                            <button
                              key={user.id || user.username}
                              type="button"
                              role="option"
                              onClick={() => void addParticipant(user.username)}
                            >
                              <img
                                src={getAvatarUrl(user.avatar_template, props.baseUrl, 28)}
                                alt=""
                              />
                              <span>
                                <strong>{user.name || user.username}</strong>
                                <small>@{user.username}</small>
                              </span>
                            </button>
                          ))}
                      </div>
                    )}
                  </form>
                )}
                {canLeave.value && (
                  <button
                    type="button"
                    class="pm-participants__leave"
                    disabled={saving.value}
                    onClick={() => void leavePrivateMessage()}
                  >
                    {saving.value ? '处理中…' : '退出私信'}
                  </button>
                )}
              </aside>
            )}
          </div>
        )}
      </section>
    )
  }
})
