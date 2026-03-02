import { defineComponent, ref } from 'vue'

import type { DiscourseGroup, DiscourseUserProfile } from '../types'
import { pageFetch, extractData } from '../utils'

import UserTabs from './UserTabs'
import '../css/UserExtrasView.css'

export default defineComponent({
  name: 'UserGroupsView',
  props: {
    user: {
      type: Object as () => DiscourseUserProfile & { _groups?: DiscourseGroup[] },
      required: true
    },
    baseUrl: { type: String, required: true },
    showSettings: { type: Boolean, default: false }
  },
  emits: ['switchMainTab', 'goToProfile'],
  setup(props, { emit }) {
    const activeGroup = ref<DiscourseGroup | null>(null)
    const groupMembers = ref<
      Array<{ id: number; username: string; name?: string; avatar_template?: string }>
    >([])
    const loading = ref(false)

    const loadGroupDetail = async (group: DiscourseGroup) => {
      activeGroup.value = group
      loading.value = true
      try {
        const result = await pageFetch<any>(`${props.baseUrl}/g/${group.name}.json`)
        const data = extractData(result)
        groupMembers.value = data?.members || data?.users || []
      } catch (e) {
        groupMembers.value = []
      } finally {
        loading.value = false
      }
    }

    return () => (
      <div class="user-extras">
        <UserTabs
          active="groups"
          showSettings={props.showSettings}
          showGroups={true}
          onSwitchTab={(
            tab: 'summary' | 'activity' | 'messages' | 'badges' | 'follow' | 'groups' | 'settings'
          ) => emit('switchMainTab', tab)}
        />

        <div class="user-extras-toolbar user-extras-toolbar--groups">
          <h3 class="user-extras-section-title">用户组</h3>
          <button class="user-extras-back-btn" onClick={() => emit('goToProfile')}>
            返回主页
          </button>
        </div>

        <section class="user-extras-card">
          {!props.user._groups || props.user._groups.length === 0 ? (
            <div class="user-extras-empty">暂无加入的用户组</div>
          ) : (
            <div class="user-extras-group-list">
              {props.user._groups.map(group => (
                <div
                  key={group.id}
                  class="user-extras-group-item"
                  onClick={() => loadGroupDetail(group)}
                >
                  <div class="user-extras-group-item__header">
                    <div>
                      <div class="user-extras-group-item__title">
                        {group.title || group.full_name || group.name}
                      </div>
                      <div class="user-extras-group-item__slug">@{group.name}</div>
                    </div>
                    {group.user_count !== undefined && (
                      <div class="user-extras-group-item__count">{group.user_count} 成员</div>
                    )}
                  </div>
                  {group.description && (
                    <div class="user-extras-group-item__desc">{group.description}</div>
                  )}
                </div>
              ))}

              {activeGroup.value && (
                <div class="user-extras-group-members">
                  <div class="user-extras-group-members__title">
                    {activeGroup.value.title || activeGroup.value.name} 成员
                  </div>
                  {loading.value ? (
                    <div class="user-extras-state-loading">加载中...</div>
                  ) : groupMembers.value.length === 0 ? (
                    <div class="user-extras-state-end">暂无成员数据</div>
                  ) : (
                    <div class="user-extras-member-grid">
                      {groupMembers.value.slice(0, 30).map(member => (
                        <div key={member.id} class="user-extras-member-pill">
                          {member.name || member.username}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    )
  }
})
