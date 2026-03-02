import { defineComponent } from 'vue'

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
              onClick={() => emit('navigate', link.path)}
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <use href={`#${link.icon}`} />
              </svg>
              <span class="sidebar-item__label text-sm">{link.label}</span>
            </a>
          ))}
        </div>
      </div>
    )
  }
})
