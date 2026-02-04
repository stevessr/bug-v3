import { defineComponent, computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'

import type { DiscourseCategory, DiscourseUserPreferences, DiscourseUserProfile } from '../types'
import { pageFetch, extractData } from '../utils'
import { searchTags } from '../actions'
import {
  ensurePreloadedCategoriesLoaded,
  getAllPreloadedCategories,
  isLinuxDoUrl
} from '../linux.do/preloadedCategories'

import UserTabs from './UserTabs'
import SettingsBasicInfo from './settings/SettingsBasicInfo'
import SettingsEmailSection from './settings/SettingsEmailSection'
import SettingsNotificationSection from './settings/SettingsNotificationSection'
import SettingsTrackingSection from './settings/SettingsTrackingSection'
import SettingsCategorySection from './settings/SettingsCategorySection'
import SettingsTagSection from './settings/SettingsTagSection'
import SettingsInterfaceSection from './settings/SettingsInterfaceSection'
import SettingsPrivacySection from './settings/SettingsPrivacySection'
import SettingsSaveActions from './settings/SettingsSaveActions'
import {
  emailLevelOptions,
  emailPreviousRepliesOptions,
  digestFrequencyOptions,
  mailingListModeOptions,
  likeNotificationOptions,
  autoTrackOptions,
  newTopicDurationOptions,
  notificationLevelOptions,
  titleCountModeOptions,
  textSizeOptions,
  homepageOptions
} from './settings/options'
import type { CategoryOption, PreferencesPayload, TagOption } from './settings/types'
import '../css/UserExtrasView.css'

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
    const tagOptions = ref<TagOption[]>([])
    const tagsLoading = ref(false)
    let tagSearchTimer: number | null = null
    const form = ref<PreferencesPayload>({
      email_digests: false,
      email_level: undefined,
      email_messages_level: undefined,
      email_previous_replies: undefined,
      email_in_reply_to: false,
      mailing_list_mode: false,
      mailing_list_mode_frequency: undefined,
      digest_after_minutes: undefined,
      include_tl0_in_digests: false,
      like_notification_frequency: undefined,
      notify_on_linked_posts: false,
      auto_track_topics_after_msecs: undefined,
      new_topic_duration_minutes: undefined,
      notification_level_when_replying: undefined,
      topics_unread_when_closed: false,
      watched_precedence_over_muted: false,
      enable_quoting: false,
      enable_smart_lists: false,
      enable_defer: false,
      enable_markdown_monospace_font: false,
      external_links_in_new_tab: false,
      automatically_unpin_topics: false,
      dynamic_favicon: false,
      title_count_mode: undefined,
      text_size: undefined,
      homepage_id: undefined,
      allow_private_messages: false,
      enable_allowed_pm_users: false,
      hide_profile: false,
      hide_presence: false,
      watched_category_ids: [],
      tracked_category_ids: [],
      watched_first_post_category_ids: [],
      muted_category_ids: [],
      watched_tags: [],
      tracked_tags: [],
      watching_first_post_tags: [],
      muted_tags: []
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

    const categoryOptions = computed<CategoryOption[]>(() => {
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

    const normalizeStringArray = (value?: string[] | string | null) => {
      if (!value) return []
      if (Array.isArray(value)) return value.filter(Boolean)
      return value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
    }

    const normalizeNumberArray = (value?: number[] | string | null) => {
      if (!value) return []
      if (Array.isArray(value)) {
        return value.filter(item => typeof item === 'number' && !Number.isNaN(item))
      }
      return value
        .split(',')
        .map(item => Number(item.trim()))
        .filter(item => !Number.isNaN(item))
    }

    watch(
      preferences,
      value => {
        if (!value) return
        form.value = {
          email_digests: !!value.email_digests,
          email_level: value.email_level ?? undefined,
          email_messages_level: value.email_messages_level ?? undefined,
          email_previous_replies: value.email_previous_replies ?? undefined,
          email_in_reply_to: !!value.email_in_reply_to,
          mailing_list_mode: !!value.mailing_list_mode,
          mailing_list_mode_frequency: value.mailing_list_mode_frequency ?? undefined,
          digest_after_minutes: value.digest_after_minutes ?? undefined,
          include_tl0_in_digests: !!value.include_tl0_in_digests,
          like_notification_frequency: value.like_notification_frequency ?? undefined,
          notify_on_linked_posts: !!value.notify_on_linked_posts,
          auto_track_topics_after_msecs: value.auto_track_topics_after_msecs ?? undefined,
          new_topic_duration_minutes: value.new_topic_duration_minutes ?? undefined,
          notification_level_when_replying: value.notification_level_when_replying ?? undefined,
          topics_unread_when_closed: !!value.topics_unread_when_closed,
          watched_precedence_over_muted: !!value.watched_precedence_over_muted,
          enable_quoting: !!value.enable_quoting,
          enable_smart_lists: !!value.enable_smart_lists,
          enable_defer: !!value.enable_defer,
          enable_markdown_monospace_font: !!value.enable_markdown_monospace_font,
          external_links_in_new_tab: !!value.external_links_in_new_tab,
          automatically_unpin_topics: !!value.automatically_unpin_topics,
          dynamic_favicon: !!value.dynamic_favicon,
          title_count_mode: value.title_count_mode ?? undefined,
          text_size: value.text_size ?? undefined,
          homepage_id: value.homepage_id ?? undefined,
          allow_private_messages: !!value.allow_private_messages,
          enable_allowed_pm_users: !!value.enable_allowed_pm_users,
          hide_profile: !!value.hide_profile,
          hide_presence: !!value.hide_presence,
          watched_category_ids: normalizeNumberArray(value.watched_category_ids),
          tracked_category_ids: normalizeNumberArray(value.tracked_category_ids),
          watched_first_post_category_ids: normalizeNumberArray(value.watched_first_post_category_ids),
          muted_category_ids: normalizeNumberArray(value.muted_category_ids),
          watched_tags: normalizeStringArray(value.watched_tags),
          tracked_tags: normalizeStringArray(value.tracked_tags),
          watching_first_post_tags: normalizeStringArray(value.watching_first_post_tags),
          muted_tags: normalizeStringArray(value.muted_tags)
        }
      },
      { immediate: true }
    )

    const handleSave = async () => {
      if (!preferences.value || saving.value) return
      saving.value = true
      try {
        if (!form.value.allow_private_messages) {
          form.value.enable_allowed_pm_users = false
        }

        const encodeCategoryIds = (ids?: number[]) => {
          const sanitized = (ids || []).filter(
            id => typeof id === 'number' && !Number.isNaN(id)
          )
          return sanitized.length === 0 ? [-1] : sanitized
        }

        const encodeTags = (tags?: string[]) =>
          (tags || [])
            .map(tag => tag.trim())
            .filter(Boolean)
            .join(',')

        const payload: Record<string, any> = {
          ...form.value,
          watched_category_ids: encodeCategoryIds(form.value.watched_category_ids),
          tracked_category_ids: encodeCategoryIds(form.value.tracked_category_ids),
          watched_first_post_category_ids: encodeCategoryIds(
            form.value.watched_first_post_category_ids
          ),
          muted_category_ids: encodeCategoryIds(form.value.muted_category_ids),
          watched_tags: encodeTags(form.value.watched_tags),
          tracked_tags: encodeTags(form.value.tracked_tags),
          watching_first_post_tags: encodeTags(form.value.watching_first_post_tags),
          muted_tags: encodeTags(form.value.muted_tags)
        }

        Object.keys(payload).forEach(key => {
          if (payload[key] === undefined) delete payload[key]
        })

        const result = await pageFetch<any>(`${props.baseUrl}/u/${props.user.username}.json`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify(payload)
        })
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
                <div class="text-xs font-semibold text-gray-400 mb-2">邮件</div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs items-center">
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
                    placeholder="选择策略"
                    options={emailPreviousRepliesOptions}
                    value={form.value.email_previous_replies}
                    onUpdate:value={(value: number | undefined) =>
                      (form.value.email_previous_replies = value)
                    }
                  />
                  <div class="text-gray-500">邮件中包含回复指向链接</div>
                  <Switch
                    size="small"
                    checked={form.value.email_in_reply_to}
                    onChange={(val: boolean) => (form.value.email_in_reply_to = val)}
                  />
                  <div class="text-gray-500">邮件摘要</div>
                  <Switch
                    size="small"
                    checked={form.value.email_digests}
                    onChange={(val: boolean) => (form.value.email_digests = val)}
                  />
                  <div class="text-gray-500">摘要频率</div>
                  <Select
                    allowClear
                    size="small"
                    class="w-full"
                    disabled={!form.value.email_digests}
                    placeholder="选择频率"
                    options={digestFrequencyOptions}
                    value={form.value.digest_after_minutes}
                    onUpdate:value={(value: number | undefined) =>
                      (form.value.digest_after_minutes = value)
                    }
                  />
                  <div class="text-gray-500">摘要包含 TL0</div>
                  <Switch
                    size="small"
                    checked={form.value.include_tl0_in_digests}
                    disabled={!form.value.email_digests}
                    onChange={(val: boolean) => (form.value.include_tl0_in_digests = val)}
                  />
                  <div class="text-gray-500">邮件列表模式</div>
                  <Switch
                    size="small"
                    checked={form.value.mailing_list_mode}
                    onChange={(val: boolean) => (form.value.mailing_list_mode = val)}
                  />
                  <div class="text-gray-500">邮件列表模式频率</div>
                  <Select
                    allowClear
                    size="small"
                    class="w-full"
                    disabled={!form.value.mailing_list_mode}
                    placeholder="选择方式"
                    options={mailingListModeOptions}
                    value={form.value.mailing_list_mode_frequency}
                    onUpdate:value={(value: number | undefined) =>
                      (form.value.mailing_list_mode_frequency = value)
                    }
                  />
                </div>
              </div>

              <div class="border-t border-gray-200/70 dark:border-gray-700 pt-3">
                <div class="text-xs font-semibold text-gray-400 mb-2">通知</div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs items-center">
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
                  <div class="text-gray-500">引用回复提醒</div>
                  <Switch
                    size="small"
                    checked={form.value.notify_on_linked_posts}
                    onChange={(val: boolean) => (form.value.notify_on_linked_posts = val)}
                  />
                </div>
              </div>

              <div class="border-t border-gray-200/70 dark:border-gray-700 pt-3">
                <div class="text-xs font-semibold text-gray-400 mb-2">追踪</div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs items-center">
                  <div class="text-gray-500">新话题判定为新</div>
                  <Select
                    allowClear
                    size="small"
                    class="w-full"
                    placeholder="选择范围"
                    options={newTopicDurationOptions}
                    value={form.value.new_topic_duration_minutes}
                    onUpdate:value={(value: number | undefined) =>
                      (form.value.new_topic_duration_minutes = value)
                    }
                  />
                  <div class="text-gray-500">自动追踪话题</div>
                  <Select
                    allowClear
                    size="small"
                    class="w-full"
                    placeholder="选择延迟"
                    options={autoTrackOptions}
                    value={form.value.auto_track_topics_after_msecs}
                    onUpdate:value={(value: number | undefined) =>
                      (form.value.auto_track_topics_after_msecs = value)
                    }
                  />
                  <div class="text-gray-500">回复时通知级别</div>
                  <Select
                    allowClear
                    size="small"
                    class="w-full"
                    placeholder="选择级别"
                    options={notificationLevelOptions}
                    value={form.value.notification_level_when_replying}
                    onUpdate:value={(value: number | undefined) =>
                      (form.value.notification_level_when_replying = value)
                    }
                  />
                  <div class="text-gray-500">关闭话题仍显示未读</div>
                  <Switch
                    size="small"
                    checked={form.value.topics_unread_when_closed}
                    onChange={(val: boolean) => (form.value.topics_unread_when_closed = val)}
                  />
                  <div class="text-gray-500">关注优先于静音</div>
                  <Switch
                    size="small"
                    checked={form.value.watched_precedence_over_muted}
                    onChange={(val: boolean) => (form.value.watched_precedence_over_muted = val)}
                  />
                </div>
              </div>

              <div class="border-t border-gray-200/70 dark:border-gray-700 pt-3">
                <div class="text-xs font-semibold text-gray-400 mb-2">分类偏好</div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs items-center">
                  <div class="text-gray-500">关注</div>
                  <Select
                    mode="multiple"
                    size="small"
                    class="w-full"
                    placeholder="选择分类"
                    options={categoryOptions.value}
                    value={form.value.watched_category_ids}
                    filterOption={filterCategoryOption}
                    onUpdate:value={(value: number[]) => (form.value.watched_category_ids = value || [])}
                  />
                  <div class="text-gray-500">追踪</div>
                  <Select
                    mode="multiple"
                    size="small"
                    class="w-full"
                    placeholder="选择分类"
                    options={categoryOptions.value}
                    value={form.value.tracked_category_ids}
                    filterOption={filterCategoryOption}
                    onUpdate:value={(value: number[]) => (form.value.tracked_category_ids = value || [])}
                  />
                  <div class="text-gray-500">关注首帖</div>
                  <Select
                    mode="multiple"
                    size="small"
                    class="w-full"
                    placeholder="选择分类"
                    options={categoryOptions.value}
                    value={form.value.watched_first_post_category_ids}
                    filterOption={filterCategoryOption}
                    onUpdate:value={(value: number[]) =>
                      (form.value.watched_first_post_category_ids = value || [])
                    }
                  />
                  <div class="text-gray-500">静音</div>
                  <Select
                    mode="multiple"
                    size="small"
                    class="w-full"
                    placeholder="选择分类"
                    options={categoryOptions.value}
                    value={form.value.muted_category_ids}
                    filterOption={filterCategoryOption}
                    onUpdate:value={(value: number[]) => (form.value.muted_category_ids = value || [])}
                  />
                </div>
              </div>

              <div class="border-t border-gray-200/70 dark:border-gray-700 pt-3">
                <div class="text-xs font-semibold text-gray-400 mb-2">标签偏好</div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs items-center">
                  <div class="text-gray-500">关注</div>
                  <Select
                    mode="tags"
                    size="small"
                    class="w-full"
                    placeholder="搜索或输入标签"
                    value={form.value.watched_tags}
                    filterOption={false}
                    notFoundContent={tagsLoading.value ? '加载中...' : '无结果'}
                    onSearch={handleTagSearch}
                    onDropdownVisibleChange={handleTagDropdown}
                    onUpdate:value={(value: string[]) => (form.value.watched_tags = value || [])}
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
                    value={form.value.tracked_tags}
                    filterOption={false}
                    notFoundContent={tagsLoading.value ? '加载中...' : '无结果'}
                    onSearch={handleTagSearch}
                    onDropdownVisibleChange={handleTagDropdown}
                    onUpdate:value={(value: string[]) => (form.value.tracked_tags = value || [])}
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
                  <div class="text-gray-500">关注首帖</div>
                  <Select
                    mode="tags"
                    size="small"
                    class="w-full"
                    placeholder="搜索或输入标签"
                    value={form.value.watching_first_post_tags}
                    filterOption={false}
                    notFoundContent={tagsLoading.value ? '加载中...' : '无结果'}
                    onSearch={handleTagSearch}
                    onDropdownVisibleChange={handleTagDropdown}
                    onUpdate:value={(value: string[]) =>
                      (form.value.watching_first_post_tags = value || [])
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
                    value={form.value.muted_tags}
                    filterOption={false}
                    notFoundContent={tagsLoading.value ? '加载中...' : '无结果'}
                    onSearch={handleTagSearch}
                    onDropdownVisibleChange={handleTagDropdown}
                    onUpdate:value={(value: string[]) => (form.value.muted_tags = value || [])}
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

              <div class="border-t border-gray-200/70 dark:border-gray-700 pt-3">
                <div class="text-xs font-semibold text-gray-400 mb-2">界面与其他</div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs items-center">
                  <div class="text-gray-500">新标签页打开外链</div>
                  <Switch
                    size="small"
                    checked={form.value.external_links_in_new_tab}
                    onChange={(val: boolean) => (form.value.external_links_in_new_tab = val)}
                  />
                  <div class="text-gray-500">引用回复</div>
                  <Switch
                    size="small"
                    checked={form.value.enable_quoting}
                    onChange={(val: boolean) => (form.value.enable_quoting = val)}
                  />
                  <div class="text-gray-500">智能列表</div>
                  <Switch
                    size="small"
                    checked={form.value.enable_smart_lists}
                    onChange={(val: boolean) => (form.value.enable_smart_lists = val)}
                  />
                  <div class="text-gray-500">延迟加载</div>
                  <Switch
                    size="small"
                    checked={form.value.enable_defer}
                    onChange={(val: boolean) => (form.value.enable_defer = val)}
                  />
                  <div class="text-gray-500">等宽字体显示 Markdown</div>
                  <Switch
                    size="small"
                    checked={form.value.enable_markdown_monospace_font}
                    onChange={(val: boolean) => (form.value.enable_markdown_monospace_font = val)}
                  />
                  <div class="text-gray-500">自动取消置顶</div>
                  <Switch
                    size="small"
                    checked={form.value.automatically_unpin_topics}
                    onChange={(val: boolean) => (form.value.automatically_unpin_topics = val)}
                  />
                  <div class="text-gray-500">动态图标</div>
                  <Switch
                    size="small"
                    checked={form.value.dynamic_favicon}
                    onChange={(val: boolean) => (form.value.dynamic_favicon = val)}
                  />
                  <div class="text-gray-500">标题计数模式</div>
                  <Select
                    allowClear
                    size="small"
                    class="w-full"
                    placeholder="选择模式"
                    options={titleCountModeOptions}
                    value={form.value.title_count_mode}
                    onUpdate:value={(value: string | undefined) => (form.value.title_count_mode = value)}
                  />
                  <div class="text-gray-500">文字大小</div>
                  <Select
                    allowClear
                    size="small"
                    class="w-full"
                    placeholder="选择大小"
                    options={textSizeOptions}
                    value={form.value.text_size}
                    onUpdate:value={(value: string | undefined) => (form.value.text_size = value)}
                  />
                  <div class="text-gray-500">主页</div>
                  <Select
                    allowClear
                    size="small"
                    class="w-full"
                    placeholder="选择主页"
                    options={homepageOptions}
                    value={form.value.homepage_id}
                    onUpdate:value={(value: number | undefined) => (form.value.homepage_id = value)}
                  />
                </div>
              </div>

              <div class="border-t border-gray-200/70 dark:border-gray-700 pt-3">
                <div class="text-xs font-semibold text-gray-400 mb-2">隐私与私信</div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs items-center">
                  <div class="text-gray-500">允许私信</div>
                  <Switch
                    size="small"
                    checked={form.value.allow_private_messages}
                    onChange={(val: boolean) => (form.value.allow_private_messages = val)}
                  />
                  <div class="text-gray-500">仅允许指定用户私信</div>
                  <Switch
                    size="small"
                    checked={form.value.enable_allowed_pm_users}
                    disabled={!form.value.allow_private_messages}
                    onChange={(val: boolean) => (form.value.enable_allowed_pm_users = val)}
                  />
                  <div class="text-gray-500">隐藏个人资料</div>
                  <Switch
                    size="small"
                    checked={form.value.hide_profile}
                    onChange={(val: boolean) => (form.value.hide_profile = val)}
                  />
                  <div class="text-gray-500">隐藏在线状态</div>
                  <Switch
                    size="small"
                    checked={form.value.hide_presence}
                    onChange={(val: boolean) => (form.value.hide_presence = val)}
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
