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
      <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700">
        <h3 class="text-sm font-semibold mb-3 dark:text-white">快速导航</h3>
        <div class="space-y-1">
          {props.links.map(link => (
            <a
              key={link.path}
              class="quick-link flex items-center gap-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
              onClick={() => emit('navigate', link.path)}
            >
              <svg class="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="currentColor">
                <use href={`#${link.icon}`} />
              </svg>
              <span class="text-sm dark:text-gray-300">{link.label}</span>
            </a>
          ))}
        </div>
      </div>
    )
  }
})
