import { defineComponent } from 'vue'

export default defineComponent({
  name: 'SidebarStats',
  props: {
    categoriesCount: { type: Number, required: true },
    usersCount: { type: Number, required: true }
  },
  setup(props) {
    return () => (
      <div class="sidebar-card">
        <h3 class="sidebar-title">统计</h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="sidebar-item__meta">分类数</span>
            <span class="sidebar-item__label">{props.categoriesCount}</span>
          </div>
          <div class="flex justify-between">
            <span class="sidebar-item__meta">活跃用户</span>
            <span class="sidebar-item__label">{props.usersCount}</span>
          </div>
        </div>
      </div>
    )
  }
})
