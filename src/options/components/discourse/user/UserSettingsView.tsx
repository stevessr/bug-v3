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
import { ensureEmojiShortcodesLoaded } from '../linux.do/emojis'
import { findEmojiByName, searchEmojis, type EmojiShortcode } from '../bbcode'

import UserTabs from './UserTabs'
import SettingsBasicInfo from './settings/SettingsBasicInfo'
import SettingsEmailSection from './settings/SettingsEmailSection'
import SettingsNotificationSection from './settings/SettingsNotificationSection'
import SettingsTrackingSection from './settings/SettingsTrackingSection'
import SettingsCategorySection from './settings/SettingsCategorySection'
import SettingsTagSection from './settings/SettingsTagSection'
import SettingsInterfaceSection from './settings/SettingsInterfaceSection'
import SettingsEmojiSection from './settings/SettingsEmojiSection'
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
  homepageOptions,
  chatQuickReactionTypeOptions
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
    const emojiOptions = ref<EmojiShortcode[]>([])
    const emojiLoading = ref(false)
    let emojiSearchTimer: number | null = null
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
      muted_tags: [],
      chat_quick_reaction_type: undefined,
      chat_quick_reactions_custom: []
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

    const normalizeDelimitedArray = (value?: string[] | string | null, delimiter: string = ',') => {
      if (!value) return []
      if (Array.isArray(value)) return value.filter(Boolean)
      return value
        .split(delimiter)
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

    const runEmojiSearch = async (query: string) => {
      const normalizedQuery = query.trim().replace(/^:+|:+$/g, '')
      emojiLoading.value = true
      try {
        await ensureEmojiShortcodesLoaded(props.baseUrl)
        emojiOptions.value = searchEmojis(normalizedQuery).slice(0, 200)
      } catch {
        emojiOptions.value = []
      } finally {
        emojiLoading.value = false
      }
    }

    const handleEmojiSearch = (query: string) => {
      if (emojiSearchTimer) window.clearTimeout(emojiSearchTimer)
      emojiSearchTimer = window.setTimeout(() => runEmojiSearch(query), 250)
    }

    const handleEmojiDropdown = (open: boolean) => {
      if (open && emojiOptions.value.length === 0) {
        runEmojiSearch('')
      }
    }

    const getEmojiOption = (value: string) => findEmojiByName(value) || null

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
          watched_first_post_category_ids: normalizeNumberArray(
            value.watched_first_post_category_ids
          ),
          muted_category_ids: normalizeNumberArray(value.muted_category_ids),
          watched_tags: normalizeStringArray(value.watched_tags),
          tracked_tags: normalizeStringArray(value.tracked_tags),
          watching_first_post_tags: normalizeStringArray(value.watching_first_post_tags),
          muted_tags: normalizeStringArray(value.muted_tags),
          chat_quick_reaction_type: value.chat_quick_reaction_type ?? undefined,
          chat_quick_reactions_custom: normalizeDelimitedArray(
            value.chat_quick_reactions_custom,
            '|'
          )
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
          const sanitized = (ids || []).filter(id => typeof id === 'number' && !Number.isNaN(id))
          return sanitized.length === 0 ? [-1] : sanitized
        }

        const encodeDelimited = (values?: string[], delimiter: string = ',') =>
          (values || [])
            .map(value => value.trim())
            .filter(Boolean)
            .join(delimiter)

        const payload: Record<string, any> = {
          ...form.value,
          watched_category_ids: encodeCategoryIds(form.value.watched_category_ids),
          tracked_category_ids: encodeCategoryIds(form.value.tracked_category_ids),
          watched_first_post_category_ids: encodeCategoryIds(
            form.value.watched_first_post_category_ids
          ),
          muted_category_ids: encodeCategoryIds(form.value.muted_category_ids),
          watched_tags: encodeDelimited(form.value.watched_tags),
          tracked_tags: encodeDelimited(form.value.tracked_tags),
          watching_first_post_tags: encodeDelimited(form.value.watching_first_post_tags),
          muted_tags: encodeDelimited(form.value.muted_tags),
          chat_quick_reactions_custom: encodeDelimited(form.value.chat_quick_reactions_custom, '|')
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
              <SettingsBasicInfo preferences={preferences.value!} />
              <SettingsEmailSection
                form={form}
                emailLevelOptions={emailLevelOptions}
                emailPreviousRepliesOptions={emailPreviousRepliesOptions}
                digestFrequencyOptions={digestFrequencyOptions}
                mailingListModeOptions={mailingListModeOptions}
              />
              <SettingsNotificationSection
                form={form}
                likeNotificationOptions={likeNotificationOptions}
              />
              <SettingsTrackingSection
                form={form}
                newTopicDurationOptions={newTopicDurationOptions}
                autoTrackOptions={autoTrackOptions}
                notificationLevelOptions={notificationLevelOptions}
              />
              <SettingsCategorySection
                form={form}
                categoryOptions={categoryOptions.value}
                filterCategoryOption={filterCategoryOption}
              />
              <SettingsTagSection
                form={form}
                tagOptions={tagOptions}
                tagsLoading={tagsLoading}
                getTagOption={getTagOption}
                onTagSearch={handleTagSearch}
                onTagDropdown={handleTagDropdown}
              />
              <SettingsInterfaceSection
                form={form}
                titleCountModeOptions={titleCountModeOptions}
                textSizeOptions={textSizeOptions}
                homepageOptions={homepageOptions}
              />
              <SettingsEmojiSection
                form={form}
                reactionTypeOptions={chatQuickReactionTypeOptions}
                emojiOptions={emojiOptions}
                emojiLoading={emojiLoading}
                getEmojiOption={getEmojiOption}
                onEmojiSearch={handleEmojiSearch}
                onEmojiDropdown={handleEmojiDropdown}
              />
              <SettingsPrivacySection form={form} />
              <SettingsSaveActions saving={saving.value} onSave={handleSave} />
            </>
          )}
        </div>
      </div>
    )
  }
})
