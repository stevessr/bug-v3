import { defineComponent } from 'vue'

export default defineComponent({
  name: 'SidebarStats',
  props: {
    categoriesCount: { type: Number, required: true },
    usersCount: { type: Number, required: true }
  },
  setup(props) {
    return () => (
      <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700">
        <h3 class="text-sm font-semibold mb-3 dark:text-white">统计</h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-500">分类数</span>
            <span class="dark:text-gray-300">{props.categoriesCount}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">活跃用户</span>
            <span class="dark:text-gray-300">{props.usersCount}</span>
          </div>
        </div>
      </div>
    )
  }
})
