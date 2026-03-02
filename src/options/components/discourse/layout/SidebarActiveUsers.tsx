import { defineComponent } from 'vue'

import type { DiscourseUser } from '../types'
import { getAvatarUrl } from '../utils'

export default defineComponent({
  name: 'SidebarActiveUsers',
  props: {
    users: { type: Array as () => DiscourseUser[], required: true },
    baseUrl: { type: String, required: true }
  },
  emits: ['select'],
  setup(props, { emit }) {
    return () => (
      <div class="sidebar-card">
        <h3 class="sidebar-title">活跃用户</h3>
        <div class="flex flex-wrap gap-2">
          {props.users.slice(0, 20).map(user => (
            <img
              key={user.id}
              src={getAvatarUrl(user.avatar_template, props.baseUrl, 32)}
              alt={user.username}
              title={user.username}
              class="w-8 h-8 rounded-full cursor-pointer transition-all hover:ring-2"
              onClick={() => emit('select', user.username)}
            />
          ))}
        </div>
        {props.users.length > 20 && (
          <div class="sidebar-item__meta mt-2">还有 {props.users.length - 20} 位用户...</div>
        )}
      </div>
    )
  }
})
