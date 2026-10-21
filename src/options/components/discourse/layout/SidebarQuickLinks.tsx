import { defineComponent } from 'vue'

import FaIcon from './FaIcon'

export default defineComponent({
  name: 'SidebarQuickLinks',
  props: {
    links: {
      type: Array as () => Array<{ path: string; label: string; icon: string }>,
      required: true
    }
  },
  emits: ['navigate'],
  setup(props, { emit }) {
    return () => (
      <div class="sidebar-card">
        <h3 class="sidebar-title">快速导航</h3>
        <div class="space-y-1">
          {props.links.map(link => (
            <a
              key={link.path}
              class="quick-link sidebar-item"
              href={link.path}
              data-discourse-url={link.path}
              onClick={(event: MouseEvent) => {
                event.preventDefault()
                emit('navigate', link.path)
              }}
            >
              <FaIcon name={link.icon} className="w-4 h-4" />
              <span class="sidebar-item__label text-sm">{link.label}</span>
            </a>
          ))}
        </div>
      </div>
    )
  }
})
