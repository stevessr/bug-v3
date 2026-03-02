import { defineComponent } from 'vue'
import '../css/UserTabs.css'

type UserMainTab = 'summary' | 'activity' | 'messages' | 'badges' | 'follow' | 'groups' | 'settings'

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
      { key: 'summary', label: '概览' },
      { key: 'activity', label: '动态' },
      { key: 'messages', label: '私信' },
      { key: 'badges', label: '徽章' },
      { key: 'follow', label: '关注' },
      { key: 'groups', label: '用户组', visible: () => props.showGroups },
      { key: 'settings', label: '设置', visible: () => props.showSettings }
    ]

    return () => (
      <div class="user-tabs">
        {tabs
          .filter(tab => (tab.visible ? tab.visible() : true))
          .map(tab => (
            <button
              key={tab.key}
              class={['user-tabs__item', props.active === tab.key ? 'is-active' : '']}
              onClick={() => emit('switchTab', tab.key)}
            >
              {tab.label}
            </button>
          ))}
      </div>
    )
  }
})
