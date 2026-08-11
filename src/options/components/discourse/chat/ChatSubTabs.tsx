import { defineComponent } from 'vue'

export type ChatSidebarTab = 'threads' | 'starred' | 'public' | 'direct'

export default defineComponent({
  name: 'ChatSubTabs',
  props: {
    active: { type: String as () => ChatSidebarTab, required: true },
    unreadPublic: { type: Number, default: 0 },
    unreadDirect: { type: Number, default: 0 },
    unreadStarred: { type: Number, default: 0 },
    unreadThreads: { type: Number, default: 0 }
  },
  emits: ['select'],
  setup(props, { emit }) {
    const tabs: Array<{
      id: ChatSidebarTab
      label: string
      unread: number
    }> = [
      { id: 'threads', label: '我的消息串', unread: props.unreadThreads },
      { id: 'starred', label: '收藏', unread: props.unreadStarred },
      { id: 'public', label: '频道', unread: props.unreadPublic },
      { id: 'direct', label: '直接消息', unread: props.unreadDirect }
    ]

    return () => (
      <nav class="chat-sub-tabs" aria-label="聊天列表筛选" role="tablist">
        {tabs.map(tab => (
          <button
            type="button"
            key={tab.id}
            role="tab"
            aria-selected={props.active === tab.id}
            class={['chat-sub-tab', props.active === tab.id ? 'active' : '']}
            onClick={() => emit('select', tab.id)}
          >
            <span class="chat-sub-tab__label">{tab.label}</span>
            {tab.unread > 0 && <span class="chat-sub-tab__badge">{tab.unread}</span>}
          </button>
        ))}
      </nav>
    )
  }
})
