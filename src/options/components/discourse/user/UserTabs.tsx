import { defineComponent } from 'vue'
import '../css/UserTabs.css'

export type UserMainTab =
  | 'summary'
  | 'activity'
  | 'notifications'
  | 'messages'
  | 'invites'
  | 'badges'
  | 'portfolio'
  | 'follow'
  | 'solved'
  | 'groups'
  | 'settings'

export default defineComponent({
  name: 'UserTabs',
  props: {
    active: { type: String as () => UserMainTab, required: true },
    showSettings: { type: Boolean, default: false },
    showGroups: { type: Boolean, default: true }
  },
  emits: ['switchTab'],
  setup(props, { emit }) {
    const tabs: { key: UserMainTab; label: string; visible?: () => boolean }[] = [
      { key: 'summary', label: '总结' },
      { key: 'activity', label: '活动' },
      { key: 'notifications', label: '通知', visible: () => props.showSettings },
      { key: 'messages', label: '消息', visible: () => props.showSettings },
      { key: 'invites', label: '邀请', visible: () => props.showSettings },
      { key: 'badges', label: '徽章' },
      { key: 'portfolio', label: '作品集' },
      { key: 'follow', label: '关注' },
      { key: 'solved', label: '已解决' },
      { key: 'groups', label: '用户组', visible: () => props.showGroups },
      { key: 'settings', label: '偏好设置', visible: () => props.showSettings }
    ]

    return () => (
      <div class="user-tabs" role="tablist" aria-label="用户页面">
        {tabs
          .filter(tab => (tab.visible ? tab.visible() : true))
          .map(tab => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              class={['user-tabs__item', props.active === tab.key ? 'is-active' : '']}
              aria-selected={props.active === tab.key}
              onClick={() => emit('switchTab', tab.key)}
            >
              {tab.label}
            </button>
          ))}
      </div>
    )
  }
})
