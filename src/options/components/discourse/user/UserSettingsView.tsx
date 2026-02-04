import { defineComponent, computed } from 'vue'

import type { DiscourseUserPreferences, DiscourseUserProfile } from '../types'

import UserTabs from './UserTabs'
import '../css/UserExtrasView.css'

export default defineComponent({
  name: 'UserSettingsView',
  props: {
    user: {
      type: Object as () => DiscourseUserProfile & {
        _preferences?: DiscourseUserPreferences | null
      },
      required: true
    }
  },
  emits: ['switchMainTab', 'goToProfile'],
  setup(props, { emit }) {
    const preferences = computed(() => props.user._preferences)

    const formatBool = (value?: boolean) => (value ? '开启' : '关闭')

    return () => (
      <div class="user-extras space-y-4">
        <UserTabs
          active="settings"
          showSettings={true}
          showGroups={true}
          onSwitchTab={tab => emit('switchMainTab', tab)}
        />

        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold dark:text-white">个人设置</h3>
          <button
            class="px-3 py-1 text-sm rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
            onClick={() => emit('goToProfile')}
          >
            返回主页
          </button>
        </div>

        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border space-y-4">
          {!preferences.value ? (
            <div class="text-sm text-gray-500">暂无设置数据（可能需要登录自己的账号）</div>
          ) : (
            <>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div class="text-gray-500">邮箱</div>
                <div class="dark:text-gray-300">{preferences.value.email || '-'}</div>
                <div class="text-gray-500">语言</div>
                <div class="dark:text-gray-300">{preferences.value.locale || '-'}</div>
                <div class="text-gray-500">时区</div>
                <div class="dark:text-gray-300">{preferences.value.timezone || '-'}</div>
                <div class="text-gray-500">主题</div>
                <div class="dark:text-gray-300">
                  {preferences.value.theme_ids?.length
                    ? preferences.value.theme_ids.join(', ')
                    : '-'}
                </div>
              </div>

              <div class="border-t border-gray-200/70 dark:border-gray-700 pt-3">
                <div class="text-xs font-semibold text-gray-400 mb-2">通知</div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div class="text-gray-500">邮件摘要</div>
                  <div class="dark:text-gray-300">
                    {formatBool(preferences.value.email_digests)}
                  </div>
                  <div class="text-gray-500">私信邮件</div>
                  <div class="dark:text-gray-300">
                    {formatBool(preferences.value.email_private_messages)}
                  </div>
                  <div class="text-gray-500">邮件提醒</div>
                  <div class="dark:text-gray-300">{formatBool(preferences.value.email_direct)}</div>
                  <div class="text-gray-500">邮件总是</div>
                  <div class="dark:text-gray-300">{formatBool(preferences.value.email_always)}</div>
                </div>
              </div>

              <div class="border-t border-gray-200/70 dark:border-gray-700 pt-3">
                <div class="text-xs font-semibold text-gray-400 mb-2">行为</div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div class="text-gray-500">引用回复</div>
                  <div class="dark:text-gray-300">
                    {formatBool(preferences.value.enable_quoting)}
                  </div>
                  <div class="text-gray-500">延迟加载</div>
                  <div class="dark:text-gray-300">{formatBool(preferences.value.enable_defer)}</div>
                  <div class="text-gray-500">新标签页打开外链</div>
                  <div class="dark:text-gray-300">
                    {formatBool(preferences.value.external_links_in_new_tab)}
                  </div>
                  <div class="text-gray-500">邮件列表模式</div>
                  <div class="dark:text-gray-300">
                    {formatBool(preferences.value.mailing_list_mode)}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }
})
