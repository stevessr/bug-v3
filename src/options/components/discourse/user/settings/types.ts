import type { DiscourseUserPreferences } from '../../types'

export type PreferencesPayload = Pick<
  DiscourseUserPreferences,
  | 'email_digests'
  | 'email_level'
  | 'email_messages_level'
  | 'email_previous_replies'
  | 'email_in_reply_to'
  | 'mailing_list_mode'
  | 'mailing_list_mode_frequency'
  | 'digest_after_minutes'
  | 'include_tl0_in_digests'
  | 'like_notification_frequency'
  | 'notify_on_linked_posts'
  | 'auto_track_topics_after_msecs'
  | 'new_topic_duration_minutes'
  | 'notification_level_when_replying'
  | 'topics_unread_when_closed'
  | 'watched_precedence_over_muted'
  | 'enable_quoting'
  | 'enable_smart_lists'
  | 'enable_defer'
  | 'enable_markdown_monospace_font'
  | 'external_links_in_new_tab'
  | 'automatically_unpin_topics'
  | 'dynamic_favicon'
  | 'title_count_mode'
  | 'text_size'
  | 'homepage_id'
  | 'allow_private_messages'
  | 'enable_allowed_pm_users'
  | 'hide_profile'
  | 'hide_presence'
  | 'watched_category_ids'
  | 'tracked_category_ids'
  | 'watched_first_post_category_ids'
  | 'muted_category_ids'
  | 'watched_tags'
  | 'tracked_tags'
  | 'watching_first_post_tags'
  | 'muted_tags'
>

export type CategoryOption = {
  value: number
  label: string
  slug: string
}

export type TagOption = {
  value: string
  label: string
  description?: string | null
}
