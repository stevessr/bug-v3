import { defineComponent, computed, ref, watch } from 'vue'
import { Button, Select, Switch, message } from 'ant-design-vue'

import type { DiscourseCategory, DiscourseUserPreferences, DiscourseUserProfile } from '../types'
import { pageFetch, extractData } from '../utils'
import { searchTags } from '../actions'
import TagPill from '../layout/TagPill'
import {
  ensurePreloadedCategoriesLoaded,
  getAllPreloadedCategories,
  isLinuxDoUrl
} from '../linux.do/preloadedCategories'

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
  | 'default_categories_watching'
  | 'default_categories_tracking'
  | 'default_categories_muted'
  | 'default_tags_watching'
  | 'default_tags_tracking'
  | 'default_tags_muted'
  | 'default_categories_watching_first_post'
  | 'email_level'
  | 'email_messages_level'
  | 'email_previous_replies'
  | 'like_notification_frequency'
  | 'digest_after_minutes'
  | 'auto_track_topics_after_msecs'
  | 'new_topic_duration_minutes'
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
    baseUrl: { type: String, required: true },
    categories: { type: Array as () => DiscourseCategory[], default: () => [] }
  },
  emits: ['switchMainTab', 'goToProfile'],
  setup(props, { emit }) {
    const preferences = computed(() => props.user._preferences)
    const saving = ref(false)
    const preloadedCategoriesReadyToken = ref(0)
    const tagOptions = ref<Array<{ value: string; label: string; description?: string | null }>>([])
    const tagsLoading = ref(false)
    let tagSearchTimer: number | null = null
    const form = ref<PreferencesPayload>({
      email_digests: false,
      email_private_messages: false,
      email_direct: false,
      email_always: false,
      mailing_list_mode: false,
      enable_quoting: false,
      enable_defer: false,
      external_links_in_new_tab: false,
      default_categories_watching: [],
      default_categories_tracking: [],
      default_categories_muted: [],
      default_categories_watching_first_post: [],
      default_tags_watching: [],
      default_tags_tracking: [],
      default_tags_muted: [],
      email_level: undefined,
      email_messages_level: undefined,
      email_previous_replies: undefined,
      like_notification_frequency: undefined,
      digest_after_minutes: undefined,
      auto_track_topics_after_msecs: undefined,
      new_topic_duration_minutes: undefined
    })

    watch(
      () => props.baseUrl,
      async value => {
        if (!isLinuxDoUrl(value)) return
        await ensurePreloadedCategoriesLoaded()
        preloadedCategoriesReadyToken.value++
      },
      { immediate: true }
    )

    const mergedCategories = computed(() => {
      const readyToken = preloadedCategoriesReadyToken.value
      const localMap = new Map<number, DiscourseCategory>()
      const usingLinuxDo = isLinuxDoUrl(props.baseUrl) && readyToken >= 0

      if (usingLinuxDo) {
        getAllPreloadedCategories().forEach(raw => {
          if (typeof raw.id !== 'number') return
          localMap.set(raw.id, {
            id: raw.id,
            name: raw.name || `category-${raw.id}`,
            slug: raw.slug || String(raw.id),
            color: raw.color || '0088CC',
            text_color: raw.text_color || 'FFFFFF',
            topic_count: 0,
            parent_category_id: raw.parent_category_id ?? null,
            style_type: raw.style_type ?? null,
            icon: raw.icon ?? null,
            emoji: raw.emoji ?? null,
            uploaded_logo: raw.uploaded_logo ?? null,
            uploaded_logo_dark: raw.uploaded_logo_dark ?? null
          })
        })
      }

      ;(props.categories || []).forEach(cat => {
        localMap.set(cat.id, { ...localMap.get(cat.id), ...cat })
      })

      return Array.from(localMap.values())
    })

    const categoryOptions = computed(() => {
      return mergedCategories.value.map(cat => {
        const slug = cat.slug || String(cat.id)
        const label = cat.name
          ? cat.slug && cat.slug !== cat.name
            ? `${cat.name} (${cat.slug})`
            : cat.name
          : slug
        return {
          value: cat.id,
          label,
          slug
        }
      })
    })

    const filterCategoryOption = (
      input: string,
      option?: { label?: string; value?: number; slug?: string }
    ) => {
      const keyword = input.trim().toLowerCase()
      if (!keyword) return true
      const label = String(option?.label || '').toLowerCase()
      const slug = String(option?.slug || '').toLowerCase()
      const id = option?.value != null ? String(option.value) : ''
      return label.includes(keyword) || slug.includes(keyword) || id.includes(keyword)
    }

    const getTagOption = (value: string) => {
      return tagOptions.value.find(option => option.value === value) || null
    }

    const runTagSearch = async (query: string) => {
      const trimmed = query.trim()
      tagsLoading.value = true
      try {
        const results = await searchTags(props.baseUrl, trimmed)
        tagOptions.value = results
          .map(item => ({
            value: item.name || item.text || '',
            label: item.text || item.name || '',
            description: item.description || null
          }))
          .filter(option => option.value)
      } catch {
        tagOptions.value = []
      } finally {
        tagsLoading.value = false
      }
    }

    const handleTagSearch = (query: string) => {
      if (tagSearchTimer) window.clearTimeout(tagSearchTimer)
      tagSearchTimer = window.setTimeout(() => runTagSearch(query), 250)
    }

    const handleTagDropdown = (open: boolean) => {
      if (open && tagOptions.value.length === 0) {
        runTagSearch('')
      }
    }

    const emailLevelOptions = [
      { value: 0, label: '从不' },
      { value: 1, label: '仅离线时' },
      { value: 2, label: '始终' }
    ]

    const emailPreviousRepliesOptions = [0, 1, 2, 3].map(value => ({
      value,
      label: value === 0 ? '不包含' : `包含 ${value} 条`
    }))

    const likeNotificationOptions = [
      { value: 0, label: '从不' },
      { value: 1, label: '仅离线时' },
      { value: 2, label: '始终' }
    ]

    const handleNumberInput = (
      key: 'digest_after_minutes' | 'auto_track_topics_after_msecs' | 'new_topic_duration_minutes',
      raw: string
    ) => {
      const trimmed = raw.trim()
      form.value[key] = trimmed === '' ? undefined : Number(trimmed)
    }

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
          external_links_in_new_tab: !!value.external_links_in_new_tab,
          default_categories_watching: value.default_categories_watching || [],
          default_categories_tracking: value.default_categories_tracking || [],
          default_categories_muted: value.default_categories_muted || [],
          default_categories_watching_first_post: value.default_categories_watching_first_post || [],
          default_tags_watching: value.default_tags_watching || [],
          default_tags_tracking: value.default_tags_tracking || [],
          default_tags_muted: value.default_tags_muted || [],
          email_level: value.email_level ?? undefined,
          email_messages_level: value.email_messages_level ?? undefined,
          email_previous_replies: value.email_previous_replies ?? undefined,
          like_notification_frequency: value.like_notification_frequency ?? undefined,
          digest_after_minutes: value.digest_after_minutes ?? undefined,
          auto_track_topics_after_msecs: value.auto_track_topics_after_msecs ?? undefined,
          new_topic_duration_minutes: value.new_topic_duration_minutes ?? undefined
        }
      },
      { immediate: true }
    )

    const handleSave = async () => {
      if (!preferences.value || saving.value) return
      saving.value = true
      try {
        const payload = { user: { ...form.value }, user_option: { ...form.value } }
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
                  <div class="text-gray-500">邮件通知级别</div>
                  <Select
                    allowClear
                    size="small"
                    class="w-full"
                    placeholder="选择级别"
                    options={emailLevelOptions}
                    value={form.value.email_level}
                    onUpdate:value={(value: number | undefined) => (form.value.email_level = value)}
                  />
                  <div class="text-gray-500">私信邮件级别</div>
                  <Select
                    allowClear
                    size="small"
                    class="w-full"
                    placeholder="选择级别"
                    options={emailLevelOptions}
                    value={form.value.email_messages_level}
                    onUpdate:value={(value: number | undefined) => (form.value.email_messages_level = value)}
                  />
                  <div class="text-gray-500">邮件包含回复</div>
                  <Select
                    allowClear
                    size="small"
                    class="w-full"
                    placeholder="选择数量"
                    options={emailPreviousRepliesOptions}
                    value={form.value.email_previous_replies}
                    onUpdate:value={(value: number | undefined) =>
                      (form.value.email_previous_replies = value)
                    }
                  />
                  <div class="text-gray-500">点赞通知频率</div>
                  <Select
                    allowClear
                    size="small"
                    class="w-full"
                    placeholder="选择频率"
                    options={likeNotificationOptions}
                    value={form.value.like_notification_frequency}
                    onUpdate:value={(value: number | undefined) =>
                      (form.value.like_notification_frequency = value)
                    }
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

              <div class="border-t border-gray-200/70 dark:border-gray-700 pt-3">
                <div class="text-xs font-semibold text-gray-400 mb-2">摘要与追踪</div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs items-center">
                  <div class="text-gray-500">摘要发送间隔（分钟）</div>
                  <input
                    type="number"
                    min="0"
                    class="w-full px-2 py-1 text-xs border rounded dark:bg-gray-900 dark:border-gray-700"
                    value={form.value.digest_after_minutes ?? ''}
                    onInput={(event: Event) =>
                      handleNumberInput(
                        'digest_after_minutes',
                        (event.target as HTMLInputElement).value
                      )
                    }
                  />
                  <div class="text-gray-500">自动追踪话题延迟（毫秒）</div>
                  <input
                    type="number"
                    min="0"
                    class="w-full px-2 py-1 text-xs border rounded dark:bg-gray-900 dark:border-gray-700"
                    value={form.value.auto_track_topics_after_msecs ?? ''}
                    onInput={(event: Event) =>
                      handleNumberInput(
                        'auto_track_topics_after_msecs',
                        (event.target as HTMLInputElement).value
                      )
                    }
                  />
                  <div class="text-gray-500">新话题时长（分钟）</div>
                  <input
                    type="number"
                    min="0"
                    class="w-full px-2 py-1 text-xs border rounded dark:bg-gray-900 dark:border-gray-700"
                    value={form.value.new_topic_duration_minutes ?? ''}
                    onInput={(event: Event) =>
                      handleNumberInput(
                        'new_topic_duration_minutes',
                        (event.target as HTMLInputElement).value
                      )
                    }
                  />
                </div>
              </div>

              <div class="border-t border-gray-200/70 dark:border-gray-700 pt-3">
                <div class="text-xs font-semibold text-gray-400 mb-2">默认分类</div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs items-center">
                  <div class="text-gray-500">关注</div>
                  <Select
                    mode="multiple"
                    size="small"
                    class="w-full"
                    placeholder="选择分类"
                    options={categoryOptions.value}
                    value={form.value.default_categories_watching}
                    filterOption={filterCategoryOption}
                    onUpdate:value={(value: number[]) =>
                      (form.value.default_categories_watching = value || [])
                    }
                  />
                  <div class="text-gray-500">追踪</div>
                  <Select
                    mode="multiple"
                    size="small"
                    class="w-full"
                    placeholder="选择分类"
                    options={categoryOptions.value}
                    value={form.value.default_categories_tracking}
                    filterOption={filterCategoryOption}
                    onUpdate:value={(value: number[]) =>
                      (form.value.default_categories_tracking = value || [])
                    }
                  />
                  <div class="text-gray-500">关注首帖</div>
                  <Select
                    mode="multiple"
                    size="small"
                    class="w-full"
                    placeholder="选择分类"
                    options={categoryOptions.value}
                    value={form.value.default_categories_watching_first_post}
                    filterOption={filterCategoryOption}
                    onUpdate:value={(value: number[]) =>
                      (form.value.default_categories_watching_first_post = value || [])
                    }
                  />
                  <div class="text-gray-500">静音</div>
                  <Select
                    mode="multiple"
                    size="small"
                    class="w-full"
                    placeholder="选择分类"
                    options={categoryOptions.value}
                    value={form.value.default_categories_muted}
                    filterOption={filterCategoryOption}
                    onUpdate:value={(value: number[]) =>
                      (form.value.default_categories_muted = value || [])
                    }
                  />
                </div>
              </div>

              <div class="border-t border-gray-200/70 dark:border-gray-700 pt-3">
                <div class="text-xs font-semibold text-gray-400 mb-2">默认标签</div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs items-center">
                  <div class="text-gray-500">关注</div>
                  <Select
                    mode="tags"
                    size="small"
                    class="w-full"
                    placeholder="搜索或输入标签"
                    value={form.value.default_tags_watching}
                    filterOption={false}
                    notFoundContent={tagsLoading.value ? '加载中...' : '无结果'}
                    onSearch={handleTagSearch}
                    onDropdownVisibleChange={handleTagDropdown}
                    onUpdate:value={(value: string[]) =>
                      (form.value.default_tags_watching = value || [])
                    }
                    v-slots={{
                      tagRender: ({ value, closable, onClose }: any) => (
                        <span class="inline-flex items-center gap-1 mr-1">
                          <TagPill
                            name={String(value)}
                            text={getTagOption(String(value))?.label || String(value)}
                            description={getTagOption(String(value))?.description || null}
                            compact
                          />
                          {closable ? (
                            <button
                              type="button"
                              class="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                              onMousedown={(event: Event) => event.preventDefault()}
                              onClick={onClose}
                            >
                              ×
                            </button>
                          ) : null}
                        </span>
                      ),
                      default: () =>
                        tagOptions.value.map(tag => (
                          <Select.Option key={tag.value} value={tag.value}>
                            <TagPill
                              name={tag.value}
                              text={tag.label}
                              description={tag.description || null}
                              compact
                            />
                          </Select.Option>
                        ))
                    }}
                  />
                  <div class="text-gray-500">追踪</div>
                  <Select
                    mode="tags"
                    size="small"
                    class="w-full"
                    placeholder="搜索或输入标签"
                    value={form.value.default_tags_tracking}
                    filterOption={false}
                    notFoundContent={tagsLoading.value ? '加载中...' : '无结果'}
                    onSearch={handleTagSearch}
                    onDropdownVisibleChange={handleTagDropdown}
                    onUpdate:value={(value: string[]) =>
                      (form.value.default_tags_tracking = value || [])
                    }
                    v-slots={{
                      tagRender: ({ value, closable, onClose }: any) => (
                        <span class="inline-flex items-center gap-1 mr-1">
                          <TagPill
                            name={String(value)}
                            text={getTagOption(String(value))?.label || String(value)}
                            description={getTagOption(String(value))?.description || null}
                            compact
                          />
                          {closable ? (
                            <button
                              type="button"
                              class="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                              onMousedown={(event: Event) => event.preventDefault()}
                              onClick={onClose}
                            >
                              ×
                            </button>
                          ) : null}
                        </span>
                      ),
                      default: () =>
                        tagOptions.value.map(tag => (
                          <Select.Option key={tag.value} value={tag.value}>
                            <TagPill
                              name={tag.value}
                              text={tag.label}
                              description={tag.description || null}
                              compact
                            />
                          </Select.Option>
                        ))
                    }}
                  />
                  <div class="text-gray-500">静音</div>
                  <Select
                    mode="tags"
                    size="small"
                    class="w-full"
                    placeholder="搜索或输入标签"
                    value={form.value.default_tags_muted}
                    filterOption={false}
                    notFoundContent={tagsLoading.value ? '加载中...' : '无结果'}
                    onSearch={handleTagSearch}
                    onDropdownVisibleChange={handleTagDropdown}
                    onUpdate:value={(value: string[]) =>
                      (form.value.default_tags_muted = value || [])
                    }
                    v-slots={{
                      tagRender: ({ value, closable, onClose }: any) => (
                        <span class="inline-flex items-center gap-1 mr-1">
                          <TagPill
                            name={String(value)}
                            text={getTagOption(String(value))?.label || String(value)}
                            description={getTagOption(String(value))?.description || null}
                            compact
                          />
                          {closable ? (
                            <button
                              type="button"
                              class="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                              onMousedown={(event: Event) => event.preventDefault()}
                              onClick={onClose}
                            >
                              ×
                            </button>
                          ) : null}
                        </span>
                      ),
                      default: () =>
                        tagOptions.value.map(tag => (
                          <Select.Option key={tag.value} value={tag.value}>
                            <TagPill
                              name={tag.value}
                              text={tag.label}
                              description={tag.description || null}
                              compact
                            />
                          </Select.Option>
                        ))
                    }}
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
