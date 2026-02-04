import { defineComponent, computed, ref, watch } from 'vue'
import { Button, Switch, message } from 'ant-design-vue'

import type { DiscourseUserPreferences, DiscourseUserProfile } from '../types'
import { pageFetch, extractData } from '../utils'

import UserTabs from './UserTabs'
import '../css/UserExtrasView.css'

type PreferencesPayload = Pick<
  DiscourseUserPreferences,
  | 'email_digests'
  | 'email_private_messages'
  | 'email_direct'
  | 'email_always'
  | 'mailing_list_mode'
  | 'enable_quoting'
  | 'enable_defer'
  | 'external_links_in_new_tab'
>

export default defineComponent({
  name: 'UserSettingsView',
  props: {
    user: {
      type: Object as () => DiscourseUserProfile & {
        _preferences?: DiscourseUserPreferences | null
      },
      required: true
    },
    baseUrl: { type: String, required: true }
  },
  emits: ['switchMainTab', 'goToProfile'],
  setup(props, { emit }) {
    const preferences = computed(() => props.user._preferences)
    const saving = ref(false)
    const form = ref<PreferencesPayload>({
      email_digests: false,
      email_private_messages: false,
      email_direct: false,
      email_always: false,
      mailing_list_mode: false,
      enable_quoting: false,
      enable_defer: false,
      external_links_in_new_tab: false
    })

    watch(
      preferences,
      value => {
        if (!value) return
        form.value = {
          email_digests: !!value.email_digests,
          email_private_messages: !!value.email_private_messages,
          email_direct: !!value.email_direct,
          email_always: !!value.email_always,
          mailing_list_mode: !!value.mailing_list_mode,
          enable_quoting: !!value.enable_quoting,
          enable_defer: !!value.enable_defer,
          external_links_in_new_tab: !!value.external_links_in_new_tab
        }
      },
      { immediate: true }
    )

    const handleSave = async () => {
      if (!preferences.value || saving.value) return
      saving.value = true
      try {
        const payload = { user: { ...form.value } }
        const result = await pageFetch<any>(
          `${props.baseUrl}/u/${props.user.username}/preferences.json`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(payload)
          }
        )
        const data = extractData(result)
        if (result.ok === false) {
          const msg = data?.errors?.join(', ') || '保存失败'
          throw new Error(msg)
        }
        ;(props.user as any)._preferences = {
          ...(preferences.value || {}),
          ...form.value
        }
        message.success('设置已保存')
      } catch (e: any) {
        message.error(e?.message || '设置保存失败')
      } finally {
        saving.value = false
      }
    }

    return () => (
      <div class="user-extras space-y-4">
        <UserTabs
          active="settings"
          showSettings={true}
          showGroups={true}
          onSwitchTab={(
            tab: 'summary' | 'activity' | 'messages' | 'badges' | 'follow' | 'groups' | 'settings'
          ) => emit('switchMainTab', tab)}
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
              </div>

              <div class="border-t border-gray-200/70 dark:border-gray-700 pt-3">
                <div class="text-xs font-semibold text-gray-400 mb-2">通知</div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div class="text-gray-500">邮件摘要</div>
                  <Switch
                    size="small"
                    checked={form.value.email_digests}
                    onChange={(val: boolean) => (form.value.email_digests = val)}
                  />
                  <div class="text-gray-500">私信邮件</div>
                  <Switch
                    size="small"
                    checked={form.value.email_private_messages}
                    onChange={(val: boolean) => (form.value.email_private_messages = val)}
                  />
                  <div class="text-gray-500">邮件提醒</div>
                  <Switch
                    size="small"
                    checked={form.value.email_direct}
                    onChange={(val: boolean) => (form.value.email_direct = val)}
                  />
                  <div class="text-gray-500">邮件总是</div>
                  <Switch
                    size="small"
                    checked={form.value.email_always}
                    onChange={(val: boolean) => (form.value.email_always = val)}
                  />
                </div>
              </div>

              <div class="border-t border-gray-200/70 dark:border-gray-700 pt-3">
                <div class="text-xs font-semibold text-gray-400 mb-2">行为</div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div class="text-gray-500">引用回复</div>
                  <Switch
                    size="small"
                    checked={form.value.enable_quoting}
                    onChange={(val: boolean) => (form.value.enable_quoting = val)}
                  />
                  <div class="text-gray-500">延迟加载</div>
                  <Switch
                    size="small"
                    checked={form.value.enable_defer}
                    onChange={(val: boolean) => (form.value.enable_defer = val)}
                  />
                  <div class="text-gray-500">新标签页打开外链</div>
                  <Switch
                    size="small"
                    checked={form.value.external_links_in_new_tab}
                    onChange={(val: boolean) => (form.value.external_links_in_new_tab = val)}
                  />
                  <div class="text-gray-500">邮件列表模式</div>
                  <Switch
                    size="small"
                    checked={form.value.mailing_list_mode}
                    onChange={(val: boolean) => (form.value.mailing_list_mode = val)}
                  />
                </div>
              </div>

              <div class="flex justify-end">
                <Button type="primary" size="small" onClick={handleSave} loading={saving.value}>
                  保存设置
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }
})
