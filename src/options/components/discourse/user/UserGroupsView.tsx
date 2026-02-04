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
      <div class="user-extras space-y-4">
        <UserTabs
          active="groups"
          showSettings={props.showSettings}
          showGroups={true}
          onSwitchTab={(
            tab: 'summary' | 'activity' | 'messages' | 'badges' | 'follow' | 'groups' | 'settings'
          ) => emit('switchMainTab', tab)}
        />

        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold dark:text-white">用户组</h3>
          <button
            class="px-3 py-1 text-sm rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
            onClick={() => emit('goToProfile')}
          >
            返回主页
          </button>
        </div>

        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border">
          {!props.user._groups || props.user._groups.length === 0 ? (
            <div class="text-sm text-gray-500">暂无加入的用户组</div>
          ) : (
            <div class="space-y-3">
              {props.user._groups.map(group => (
                <div
                  key={group.id}
                  class="p-3 rounded bg-white/70 dark:bg-gray-900/40 border border-gray-200/70 dark:border-gray-700 cursor-pointer"
                  onClick={() => loadGroupDetail(group)}
                >
                  <div class="flex items-center justify-between">
                    <div>
                      <div class="text-sm font-medium dark:text-white">
                        {group.title || group.full_name || group.name}
                      </div>
                      <div class="text-xs text-gray-500">@{group.name}</div>
                    </div>
                    {group.user_count !== undefined && (
                      <div class="text-xs text-gray-400">{group.user_count} 成员</div>
                    )}
                  </div>
                  {group.description && (
                    <div class="text-xs text-gray-500 mt-2 whitespace-pre-line">
                      {group.description}
                    </div>
                  )}
                </div>
              ))}

              {activeGroup.value && (
                <div class="mt-2 rounded border border-gray-200/70 dark:border-gray-700 p-3">
                  <div class="text-xs text-gray-500 mb-2">
                    {activeGroup.value.title || activeGroup.value.name} 成员
                  </div>
                  {loading.value ? (
                    <div class="text-xs text-gray-400">加载中...</div>
                  ) : groupMembers.value.length === 0 ? (
                    <div class="text-xs text-gray-400">暂无成员数据</div>
                  ) : (
                    <div class="flex flex-wrap gap-2">
                      {groupMembers.value.slice(0, 30).map(member => (
                        <div
                          key={member.id}
                          class="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-800"
                        >
                          {member.name || member.username}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }
})
