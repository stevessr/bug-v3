// Discourse Browser Types

export type TopicListType =
  'latest' | 'new' | 'unread' | 'unseen' | 'top' | 'hot' | 'posted' | 'bookmarks'
export type TopicListPeriod = 'all' | 'yearly' | 'quarterly' | 'monthly' | 'weekly' | 'daily'

export interface BrowserTab {
  id: string
  title: string
  url: string
  loading: boolean
  history: string[]
  historyScrollPositions: number[]
  historyIndex: number
  scrollTop: number
  // Per-tab state
  viewType: ViewType
  categories: DiscourseCategory[]
  topics: DiscourseTopic[]
  currentTopic: DiscourseTopicDetail | null
  currentUser: DiscourseUserProfile | null
  activeUsers: DiscourseUser[]
  tags: DiscourseTag[]
  tagGroups: DiscourseTagGroup[]
  errorMessage: string
  groupName?: string
  userExtrasLoading?: boolean
  /** True while a profile sub-tab refreshes without replacing the entire browser view. */
  userSectionLoading?: boolean
  notifications: DiscourseNotification[]
  notificationsFilter: DiscourseNotificationFilter
  unreadNotificationsCount: number
  // Pagination state for posts
  loadedPostIds: Set<number>
  hasMorePosts: boolean
  // Pagination state for topics (home/category)
  topicsPage: number
  hasMoreTopics: boolean
  // Category info for pagination
  currentCategorySlug: string
  currentCategoryId: number | null
  currentCategoryName: string
  currentTagName: string
  // Topic list type for home view
  topicListType: TopicListType
  topicListPeriod: TopicListPeriod | null
  // Activity state
  activityState: UserActivityState | null
  // Messages state
  messagesState: MessagesState | null
  // Follow feed pagination
  followFeedPage: number
  followFeedHasMore: boolean
  // Topic jump
  targetPostNumber: number | null
  // Topic summary mode
  topicSummaryMode: boolean
  // Cache topic extras from initial topic JSON
  topicExtras: {
    suggested_topics?: SuggestedTopic[]
    related_topics?: SuggestedTopic[]
  } | null
  lastTimingSentAt?: number
  lastTimingTopicId?: number
  chatState: ChatState | null
  pendingTopics?: DiscourseTopic[] | null
  pendingTopicsCount?: number
  searchState: SearchState | null
  reviewState: ReviewState | null
  invitesState: InvitesState | null
}

export type ViewType =
  | 'home'
  | 'categories'
  | 'tags'
  | 'tag'
  | 'category'
  | 'topic'
  | 'chat'
  | 'ai-bot'
  | 'user'
  | 'activity'
  | 'messages'
  | 'notifications'
  | 'badges'
  | 'followFeed'
  | 'following'
  | 'followers'
  | 'groups'
  | 'group'
  | 'preferences'
  | 'search'
  | 'review'
  | 'invites'
  | 'error'

export interface DiscourseTopic {
  id: number
  title: string
  fancy_title: string
  slug: string
  posts_count: number
  reply_count: number
  views: number
  like_count: number
  created_at: string
  last_posted_at: string
  bumped_at: string
  posters: Array<{
    user_id: number
    extras?: string
    description: string
  }>
  participants?: Array<{
    user_id: number
    extras?: string
    description?: string
    primary_group_id?: number | null
    flair_group_id?: number | null
  }>
  unread?: number
  new_posts?: number
  unread_posts?: number
  last_read_post_number?: number
  allowed_user_count?: number
  category_id?: number
  tags?: Array<string | DiscourseTopicTag>
  last_poster_username?: string
}

export interface DiscourseTopicTag {
  id?: number
  name?: string
  text?: string
  slug?: string
  description?: string | null
}

export interface DiscourseCategory {
  id: number
  name: string
  slug: string
  color: string
  text_color: string
  topic_count: number
  description?: string
  description_excerpt?: string
  parent_category_id?: number | null
  subcategory_ids?: number[] | null
  style_type?: string | null
  icon?: string | null
  emoji?: string | null
  uploaded_logo?: { url: string } | null
  uploaded_logo_dark?: { url: string } | null
  topics?: Array<{
    id: number
    title: string
    fancy_title?: string
    slug?: string
    posts_count?: number
    reply_count?: number
    created_at?: string
    last_posted_at?: string
    bumped_at?: string
    image_url?: string | null
    last_poster?: {
      id?: number
      username?: string
      name?: string | null
      avatar_template?: string
    }
  }>
}

export interface DiscourseUser {
  id: number
  username: string
  name?: string
  avatar_template: string
  /** ChatableUserSerializer fields used to avoid contacting opted-out users. */
  can_chat?: boolean
  has_chat_enabled?: boolean
  can_chat_user?: boolean
}

export interface DiscourseTag {
  id: number
  text: string
  name: string
  description?: string | null
  count: number
  pm_only?: boolean
  target_tag?: string | null
}

export interface DiscourseTagGroup {
  id: number
  name: string
  tags: DiscourseTag[]
}

export type DiscourseNotificationFilter =
  | 'all'
  | 'unread'
  | 'replies'
  | 'mentions'
  | 'likes'
  | 'messages'
  | 'badges'
  | 'other'
  | `category:${number}`
  | `category:${string}`

export interface DiscourseNotification {
  id: number
  notification_type: number
  read: boolean
  created_at: string
  slug?: string
  topic_id?: number
  post_number?: number
  data?: Record<string, any>
  fancy_title?: string
  acting_user_avatar_template?: string
  acting_user_name?: string
}

export interface Boost {
  id: number
  cooked: string
  can_delete?: boolean
  can_flag?: boolean
  user_flag_status?: number | null
  available_flags?: string[]
  user: {
    id: number
    username: string
    name?: string
    avatar_template: string
  }
}

export interface DiscoursePost {
  id: number
  username: string
  avatar_template: string
  created_at: string
  cooked: string
  raw?: string
  post_number: number
  reply_count: number
  like_count: number
  topic_id?: number
  name?: string
  read?: boolean
  reply_to_post_number?: number | null
  reply_to_user?: {
    id?: number
    username?: string
    name?: string
    avatar_template?: string
  }
  user_id?: number
  can_edit?: boolean
  can_delete?: boolean
  can_bookmark?: boolean
  can_flag?: boolean
  can_wiki?: boolean
  can_recover?: boolean
  can_unbookmark?: boolean
  bookmarked?: boolean
  bookmark_id?: number | null
  wiki?: boolean
  hidden?: boolean
  user_title?: string
  trust_level?: number
  staff?: boolean
  admin?: boolean
  moderator?: boolean
  polls?: DiscoursePoll[]
  boosts?: Boost[]
  can_boost?: boolean
  can_assign?: boolean
  reactions?: DiscoursePostReactionSummary[] | Record<string, DiscoursePostReactionSummary>
  current_user_reaction?:
    | string
    | {
        id: string
        type?: string
        can_undo?: boolean
      }
    | null
  current_user_used_main_reaction?: boolean
  reaction_users_count?: number
  actions_summary?: Array<{ id: number; count?: number; acted?: boolean }>
}

export interface DiscoursePostReactionSummary {
  id: string
  type?: string
  count: number
  reacted?: boolean
}

export interface DiscourseReactionUser {
  id: number
  username: string
  name?: string
  avatar_template: string
  reaction?: string
  created_at?: string
}

export interface DiscoursePollOption {
  id: string
  html?: string
  votes?: number
  chosen?: boolean
  rank?: number[] | number
}

export interface DiscoursePoll {
  id: number
  name: string
  type: 'regular' | 'multiple' | 'ranked_choice' | string
  status?: string
  results?: string
  min?: number
  max?: number
  dynamic?: boolean
  options?: DiscoursePollOption[]
  voters?: number
  ranked_choice_outcome?: Record<string, any> | null
}

export interface SuggestedTopic {
  id: number
  title: string
  fancy_title: string
  slug: string
  posts_count: number
  reply_count: number
  views: number
  like_count: number
  created_at: string
  last_posted_at: string
  category_id: number
  unread?: number
  new_posts?: number
  unread_posts?: number
  last_read_post_number?: number
}

export interface DiscourseTopicDetail {
  id: number
  slug?: string
  archetype?: 'regular' | 'private_message' | string
  title: string
  fancy_title: string
  posts_count: number
  category_id?: number | null
  category?: {
    id: number
    name?: string
    slug?: string
    color?: string | null
    text_color?: string | null
  } | null
  tags?: string[]
  highest_post_number?: number
  views: number
  like_count: number
  created_at: string
  last_posted_at?: string
  last_read_post_number?: number
  notification_level?: number
  can_assign?: boolean
  valid_reactions?: string[]
  post_stream: {
    posts: DiscoursePost[]
    stream: number[]
  }
  details: {
    created_by: DiscourseUser
    participants: Array<DiscourseUser | { user: DiscourseUser; post_count?: number }>
    notification_level?: number
    allowed_users?: DiscourseUser[]
    allowed_groups?: Array<{ id: number; name: string; full_name?: string }>
    can_invite_to?: boolean
    can_remove_allowed_users?: boolean
    can_remove_self_id?: number | null
    can_edit?: boolean
    can_assign?: boolean
  }
  suggested_topics?: SuggestedTopic[]
  related_topics?: SuggestedTopic[]
}

export interface DiscourseSearchPost {
  id: number
  topic_id: number
  topic_slug?: string
  post_number: number
  created_at: string
  blurb?: string
  username?: string
  name?: string
}

export interface DiscourseSearchTopic {
  id: number
  title: string
  fancy_title?: string
  slug: string
  posts_count?: number
  reply_count?: number
  views?: number
  like_count?: number
  created_at?: string
  last_posted_at?: string
  category_id?: number
}

export interface DiscourseSearchFilters {
  inTitle: boolean
  inFirst: boolean
  inPinned: boolean
  inWiki: boolean
  inBookmarks: boolean
  inLikes: boolean
  inPosted: boolean
  inSeen: boolean
  inUnseen: boolean
  inWatching: boolean
  inTracking: boolean
  inMessages: boolean
  status: 'open' | 'closed' | 'archived' | 'listed' | 'unlisted' | 'noreplies' | 'single_user' | ''
  order: 'latest' | 'likes' | 'views' | 'latest_topic' | 'activity' | 'created' | 'hot' | ''
  category: string
  tags: string
  postedBy: string
  assignedTo: string
  group: string
  before: string
  after: string
  minPosts: string
  maxPosts: string
  minViews: string
  maxViews: string
}

export interface SearchState {
  query: string
  filters: DiscourseSearchFilters
  posts: DiscourseSearchPost[]
  topics: DiscourseSearchTopic[]
  users: DiscourseUser[]
  page: number
  hasMore: boolean
  loading: boolean
  errorMessage: string
}

export interface ChatChannelMembership {
  id?: number
  chat_channel_id?: number
  last_read_message_id?: number
  unread_count?: number
  mention_count?: number
  watched_threads_unread_count?: number
  starred?: boolean
  muted?: boolean
  following?: boolean
  notification_level?: 'never' | 'mention' | 'always' | number | string
  last_viewed_at?: string
  last_viewed_pins_at?: string | null
  has_unseen_pins?: boolean
}

export interface ChatChannel {
  id: number
  title?: string
  unicode_title?: string
  channelType?: 'public' | 'direct'
  slug?: string
  description?: string
  emoji?: string | null
  chatable_url?: string
  chatable_type?: string
  chatable_id?: number
  chatable?: {
    id?: number
    name?: string
    users?: DiscourseUser[]
    group?: boolean
    emoji?: string | null
    icon?: string | null
    slug?: string | null
    uploaded_logo?: { url: string } | null
    uploaded_logo_dark?: { url: string } | null
  }
  meta?: {
    can_moderate?: boolean
    can_flag?: boolean
    can_join_chat_channel?: boolean
    can_remove_members?: boolean
    can_delete_self?: boolean
    can_delete_others?: boolean
    can_manage_pins?: boolean
    can_manage?: boolean
    user_silenced?: boolean
    [key: string]: any
  }
  status?: string
  auto_join_users?: boolean
  allow_channel_wide_mentions?: boolean
  threading_enabled?: boolean
  memberships_count?: number
  pinned_messages_count?: number
  archive_failed?: boolean
  archive_completed?: boolean
  archived_messages?: number
  total_messages?: number
  archive_topic_id?: number | null
  last_message_sent_at?: string
  last_message_id?: number
  last_message?: {
    id?: number
    cooked?: string
    message?: string
    created_at?: string
  }
  direct_message_users?: DiscourseUser[]
  current_user_membership?: ChatChannelMembership
}

export interface ChatMessageReaction {
  emoji: string
  count: number
  reacted?: boolean
  users?: DiscourseUser[]
}

export interface ChatThreadPreview {
  last_reply_created_at?: string
  last_reply_excerpt?: string
  last_reply_id?: number
  last_reply_user?: DiscourseUser
  participant_count?: number
  participant_users?: DiscourseUser[]
  reply_count?: number
}

export interface ChatThreadTracking {
  channel_id?: number
  unread_count?: number
  mention_count?: number
  watched_threads_unread_count?: number
  last_reply_created_at?: string | null
}

export interface ChatThread {
  id: number
  title?: string | null
  status?: 'open' | 'read_only' | 'closed' | 'archived' | string
  channel_id?: number
  reply_count?: number
  last_message_id?: number
  force?: boolean
  channel?: ChatChannel
  original_message?: ChatMessage
  preview?: ChatThreadPreview
  tracking?: ChatThreadTracking
  current_user_membership?: {
    id?: number
    notification_level?: number | string
    last_read_message_id?: number | null
    unread_count?: number
    thread_title_prompt_seen?: boolean
  }
}

export interface ChatMessageBlockText {
  type?: string
  text?: string
}

export interface ChatMessageBlockElement {
  type?: string
  action_id?: string
  style?: string
  text?: ChatMessageBlockText
}

export interface ChatMessageBlock {
  type?: string
  elements?: ChatMessageBlockElement[]
}

export interface ChatMessage {
  id: number
  message?: string
  cooked?: string
  created_at: string
  chat_channel_id?: number
  thread_id?: number | null
  thread_title?: string | null
  thread?: ChatThread
  channel?: ChatChannel
  in_reply_to?: ChatMessage | null
  user_id?: number
  username?: string
  name?: string
  avatar_template?: string
  user?: DiscourseUser
  reactions?: ChatMessageReaction[]
  blocks?: ChatMessageBlock[]
  edited?: boolean
  deleted?: boolean
}

export type ChatSearchSort = 'relevance' | 'latest'

export interface ChatSearchState {
  query: string
  channelId: number | null
  sort: ChatSearchSort
  results: ChatMessage[]
  offset: number
  hasMore: boolean
  loading: boolean
  loadingMore: boolean
  errorMessage: string
}

export interface ChatTypingUser {
  userId: number
  username: string
  name?: string
  avatar_template?: string
}

export interface ChatChannelUpdatePayload {
  name?: string
  description?: string
  slug?: string
  emoji?: string
  threading_enabled?: boolean
  auto_join_users?: boolean
  allow_channel_wide_mentions?: boolean
}

export type ChatChannelEditableStatus = 'open' | 'closed'

export interface MessageBusTopicPayload {
  topic_id?: number
  id?: number
  post_number?: number
  highest_post_number?: number
  [key: string]: any
}

export interface MessageBusTopicListPayload {
  topic_id?: number
  topic_ids?: number[]
  new_topic_ids?: number[]
  category_id?: number
  tag?: string
  [key: string]: any
}

export interface MessageBusNotificationPayload {
  unread_notifications?: number
  unread_high_priority_notifications?: number
  unread_private_messages?: number
  notification_id?: number
  id?: number
  dismissed?: boolean
  deleted?: boolean
  mark_read?: boolean
  read?: boolean
  [key: string]: any
}

export interface MessageBusChatPayload {
  chat_channel_id?: number
  channel_id?: number
  message_id?: number
  id?: number
  [key: string]: any
}

export interface ChatState {
  channels: ChatChannel[]
  activeChannelId: number | null
  /** 聊天子 tab（我的消息串/收藏/频道/直接消息），用于 /chat/threads 等 URL 恢复 */
  chatSidebarTab?: 'threads' | 'starred' | 'public' | 'direct'
  messagesByChannel: Record<number, ChatMessage[]>
  hasMoreByChannel: Record<number, boolean>
  beforeMessageIdByChannel: Record<number, number | null>
  activeTargetMessageId: number | null
  activeThread: ChatThread | null
  threadMessagesById: Record<number, ChatMessage[]>
  threadHasMoreById: Record<number, boolean>
  beforeMessageIdByThread: Record<number, number | null>
  myThreads: ChatThread[]
  myThreadsLoadMoreUrl: string | null
  myThreadsLoaded: boolean
  loadingMyThreads: boolean
  loadingMoreMyThreads: boolean
  myThreadsErrorMessage: string
  threadNotificationSavingById: Record<number, boolean>
  threadTitleSavingById: Record<number, boolean>
  searchState: ChatSearchState
  channelThreadsByChannel: Record<number, ChatThread[]>
  channelThreadsLoadMoreUrlByChannel: Record<number, string | null>
  channelThreadsLoadedByChannel: Record<number, boolean>
  channelThreadsLoadingByChannel: Record<number, boolean>
  channelThreadsLoadingMoreByChannel: Record<number, boolean>
  channelThreadsErrorByChannel: Record<number, string>
  loadingChannels: boolean
  loadingMessages: boolean
  loadingThread: boolean
  sendingMessage: boolean
  sendingThreadMessage: boolean
  errorMessage: string
  threadErrorMessage: string
  // Reply state
  replyToMessage: ChatMessage | null
  threadReplyToMessage: ChatMessage | null
  // Edit state
  editingMessage: ChatMessage | null
  threadEditingMessage: ChatMessage | null
  // Typing indicator
  typingUsers: Record<number, ChatTypingUser[]>
  // Member management
  membersByChannel: Record<number, ChatMember[]>
  membersTotalByChannel: Record<number, number>
  membersLoadingByChannel: Record<number, boolean>
  // Channel discovery (browse public channels not yet joined)
  discoverableChannels: ChatChannel[]
  discoverLoading: boolean
  discoverErrorMessage: string
  joiningChannelIds: Record<number, boolean>
  capabilities: ChatCapabilities
}

export interface ChatCapabilities {
  loaded: boolean
  chatEnabled: boolean
  currentUserChatEnabled: boolean
  canDirectMessage: boolean
  publicChannelsEnabled: boolean
  canCreatePublicChannel: boolean
  maxAutoJoinedUsers: number
  source: 'site' | 'unavailable'
}

export interface ChatMember {
  id: number
  user: DiscourseUser
  membership?: ChatChannelMembership
  last_read_message_id?: number | null
  muted?: boolean
  notification_level?: number | string | null
}

export interface ChatMembershipUpdatePayload {
  muted?: boolean
  notification_level?: number | string
  starred?: boolean
}

export interface ChatCreateDirectMessagePayload {
  targetUsernames: string[]
  name?: string
  upsert?: boolean
}

export interface ChatCreateChannelPayload {
  name: string
  chatableId: number
  slug?: string
  description?: string
  emoji?: string
  autoJoinUsers?: boolean
  threadingEnabled?: boolean
}

export interface ParsedContent {
  html: string
  images: string[]
  segments: Array<
    | { type: 'html'; html: string }
    | { type: 'lightbox'; image: LightboxImage }
    | { type: 'carousel'; images: LightboxImage[] }
    | { type: 'image-grid'; columns: LightboxImage[][]; columnsCount?: number }
  >
  footnotes?: Record<string, string>
}

export interface LightboxImage {
  href: string
  downloadHref?: string
  title?: string
  thumbSrc?: string
  alt?: string
  base62Sha1?: string
  width?: string
  height?: string
  srcset?: string
  dominantColor?: string
  loading?: string
  style?: string
  metaHtml?: string
}

// User profile types
export interface DiscourseUserProfile {
  id: number
  username: string
  name: string
  avatar_template: string
  title?: string
  trust_level: number
  moderator?: boolean
  admin?: boolean
  staff?: boolean
  bio_excerpt?: string
  bio_cooked?: string
  website?: string
  website_name?: string
  location?: string
  created_at: string
  last_seen_at?: string
  last_posted_at?: string
  profile_view_count?: number
  badge_count?: number
  time_read?: number
  days_visited?: number
  flair_name?: string
  flair_url?: string
  flair_bg_color?: string
  flair_color?: string
  card_background_upload_url?: string
  profile_background_upload_url?: string
  can_send_private_messages?: boolean
  can_send_private_message_to_user?: boolean
  can_chat_user?: boolean
  can_follow?: boolean
  is_followed?: boolean
  total_followers?: number
  total_following?: number
  user_option?: DiscourseUserPreferences
  featured_topic?: {
    id: number
    title: string
    fancy_title: string
    slug: string
    posts_count: number
  }
  status?: {
    description: string
    emoji: string
    ends_at: string | null
  }
}

export interface DiscourseGroup {
  id: number
  name: string
  full_name?: string
  title?: string
  description?: string
  visibility_level?: number
  user_count?: number
  primary_group?: boolean
}

export interface DiscourseUserPreferences {
  email?: string
  locale?: string
  timezone?: string
  enable_quoting?: boolean
  enable_defer?: boolean
  external_links_in_new_tab?: boolean
  enable_smart_lists?: boolean
  enable_markdown_monospace_font?: boolean
  automatically_unpin_topics?: boolean
  dynamic_favicon?: boolean
  email_digests?: boolean
  email_private_messages?: boolean
  email_direct?: boolean
  email_always?: boolean
  mailing_list_mode?: boolean
  mailing_list_mode_frequency?: number
  email_level?: number
  email_messages_level?: number
  email_previous_replies?: number
  email_in_reply_to?: boolean
  like_notification_frequency?: number
  notify_on_linked_posts?: boolean
  digest_after_minutes?: number
  include_tl0_in_digests?: boolean
  auto_track_topics_after_msecs?: number
  notification_level_when_replying?: number
  new_topic_duration_minutes?: number
  topics_unread_when_closed?: boolean
  watched_precedence_over_muted?: boolean
  theme_ids?: number[]
  text_size?: string
  title_count_mode?: string
  homepage_id?: number
  allow_private_messages?: boolean
  enable_allowed_pm_users?: boolean
  hide_profile?: boolean
  hide_presence?: boolean
  bookmark_auto_delete_preference?: number
  default_calendar?: number
  interface_color_mode?: number | string
  composition_mode?: number
  default_categories_watching?: number[]
  default_categories_tracking?: number[]
  default_categories_muted?: number[]
  default_categories_watching_first_post?: number[]
  watched_category_ids?: number[]
  tracked_category_ids?: number[]
  watched_first_post_category_ids?: number[]
  muted_category_ids?: number[]
  regular_category_ids?: number[]
  default_tags_watching?: string[]
  default_tags_tracking?: string[]
  default_tags_muted?: string[]
  watched_tags?: string[]
  watching_first_post_tags?: string[]
  tracked_tags?: string[]
  muted_tags?: string[]
  allowed_pm_usernames?: string | string[]
  muted_usernames?: string | string[]
  chat_quick_reaction_type?: string
  chat_quick_reactions_custom?: string | string[]
}

export interface DiscourseUserSummary {
  likes_given: number
  likes_received: number
  topics_entered: number
  posts_read_count: number
  days_visited: number
  topic_count: number
  post_count: number
  time_read: number
  bookmark_count: number
  solved_count?: number
  topic_ids: number[]
  top_categories: Array<{
    id: number
    name: string
    color: string
    slug: string
    topic_count: number
    post_count: number
  }>
  most_liked_by_users: DiscourseUser[]
  most_liked_users: DiscourseUser[]
  most_replied_to_users: DiscourseUser[]
}

export interface DiscourseUserProfileData {
  user: DiscourseUserProfile
  user_summary?: DiscourseUserSummary
  topics?: DiscourseTopic[]
  badges?: DiscourseBadge[]
  follow_feed?: DiscourseFollowPost[]
  following?: DiscourseUser[]
  followers?: DiscourseUser[]
  groups?: DiscourseGroup[]
  preferences?: DiscourseUserPreferences
}

export interface DiscourseBadge {
  id: number
  name: string
  description?: string
  image_url?: string
  icon?: string
  badge_type_id?: number
  allow_title?: boolean
}

export interface DiscourseFollowPost {
  id: number
  excerpt: string
  cooked?: string
  created_at: string
  post_number: number
  topic_id: number
  url: string
  user: DiscourseUser
  topic: {
    id: number
    title: string
    fancy_title: string
    slug: string
    posts_count: number
  }
}

// User activity types
export type ActivityTabType =
  | 'all'
  | 'topics'
  | 'replies'
  | 'likes'
  | 'reactions'
  | 'solved'
  | 'assigned'
  | 'votes'
  | 'portfolio'
  | 'read'

export interface DiscourseUserAction {
  excerpt: string
  action_type: number
  created_at: string
  avatar_template: string
  acting_avatar_template: string
  slug: string
  topic_id: number
  target_user_id: number
  target_name: string
  target_username: string
  post_number: number
  post_id: number
  reply_to_post_number: number | null
  username: string
  name: string
  user_id: number
  acting_username: string
  acting_name: string
  acting_user_id: number
  title: string
  deleted: boolean
  hidden: boolean
  post_type: number
  action_code: string | null
  category_id: number
  closed: boolean
  archived: boolean
}

export interface DiscourseReaction {
  id: number
  user_id: number
  post_id: number
  created_at: string
  user: {
    id: number
    username: string
    name: string
    avatar_template: string
    title?: string
  }
  post: {
    excerpt: string
    id: number
    created_at: string
    topic_id: number
    topic_title: string
    topic_slug: string
    url: string
    category_id: number
    post_number: number
    posts_count: number
    username: string
    name: string
    avatar_template: string
  }
  reaction: {
    id: number
    post_id: number
    reaction_type: string
    reaction_value: string
    reaction_users_count: number
    created_at: string
  }
}

export interface DiscourseSolvedPost {
  created_at: string
  archived: boolean
  avatar_template: string
  category_id: number
  closed: boolean
  cooked: string
  excerpt: string
  name: string
  post_id: number
  post_number: number
  post_type: number
  raw: string
  slug: string
  topic_id: number
  topic_title: string
  truncated: boolean
  url: string
  user_id: number
  username: string
}

export interface UserActivityState {
  activeTab: ActivityTabType
  actions: DiscourseUserAction[]
  topics: DiscourseTopic[]
  reactions: DiscourseReaction[]
  solvedPosts: DiscourseSolvedPost[]
  offset: number
  hasMore: boolean
  loading: boolean
}

// Messages types
export type MessagesTabType = 'all' | 'sent' | 'new' | 'unread' | 'archive'

export interface MessagesState {
  activeTab: MessagesTabType
  topics: DiscourseTopic[]
  page: number
  hasMore: boolean
  /** Initial/sub-tab list request state, rendered inside the messages panel. */
  loading?: boolean
  searchQuery?: string
  searchResults?: DiscourseTopic[]
  searching?: boolean
}

// Flag types from Discourse /site.json
export interface DiscourseFlagType {
  id: number
  name_key: string
  name: string
  description: string
  short_description?: string
  is_flag: boolean
  is_custom_flag?: boolean
  require_message: boolean
  enabled: boolean
  applies_to?: string[]
  icon?: string | null
}

// Review queue types (matches Discourse /review API)
export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'ignored' | 'deleted'

export interface ReviewableAction {
  id: number
  icon?: string
  button_class?: string
  label: string
  confirm_message?: string
  description?: string
  server_action: string
  client_action?: string
  require_reject_reason?: boolean
  completed_message?: string
}

export interface ReviewableBundledAction {
  id: number
  icon?: string
  label?: string
  actions: ReviewableAction[]
}

export interface ReviewableScoreType {
  id: number
  title: string
  type?: string
}

export interface ReviewableScore {
  id: number
  score?: number
  agree_stats?: { agreed: number; disagreed: number; ignored: number }
  reason?: string
  reason_type?: string
  reason_data?: Record<string, any>
  created_at?: string
  reviewed_at?: string
  status?: number
  user?: DiscourseUser
  score_type?: ReviewableScoreType
  reviewed_by?: DiscourseUser
  reviewable_conversation?: {
    id: number
    permalink?: string
    has_more?: boolean
    conversation_posts?: Array<{
      id: number
      excerpt?: string
      user?: DiscourseUser
      created_at?: string
    }>
  } | null
}

export interface ReviewableEditableField {
  id: string
  type: string
}

export interface ReviewableNote {
  id: number
  user?: DiscourseUser
  created_at?: string
  note?: string
  can_delete?: boolean
}

export interface Reviewable {
  id: number
  type: string
  type_source?: string
  topic_id?: number | null
  topic_url?: string
  topic?: DiscourseTopic | null
  target_type?: string
  target_id?: number
  target_url?: string
  target_created_at?: string
  target_deleted_at?: string | null
  target_deleted_by?: DiscourseUser | null
  topic_tags?: string[]
  category_id?: number
  category?: DiscourseCategory | null
  created_at: string
  can_edit?: boolean
  score?: number
  version: number
  status: number
  created_by?: DiscourseUser | null
  target_created_by?: DiscourseUser | null
  created_from_flag?: boolean
  editable_fields?: ReviewableEditableField[]
  reviewable_scores?: ReviewableScore[]
  bundled_actions?: ReviewableBundledAction[]
  reviewable_notes?: ReviewableNote[]
  reviewable_histories?: Array<Record<string, any>>
  claimed_by?: { user?: DiscourseUser } | null
  payload?: Record<string, any>
  // ReviewableQueuedPost extras
  reply_to_post_number?: number | null
  fancy_title?: string
  cooked?: string
  raw?: string
  title?: string
  hidden?: boolean
  // ReviewableUser extras
  target?: {
    id: number
    username?: string
    name?: string
    avatar_template?: string
    created_at?: string
    last_seen_at?: string
    trust_level?: number
    stats?: Array<{ action_type: number; count: number }>
  } | null
}

export interface ReviewState {
  status: ReviewStatus
  typeFilter: string
  reviewables: Reviewable[]
  offset: number
  hasMore: boolean
  loading: boolean
  performingId: number | null
  errorMessage: string
  totalRows: number
  reviewableCount: number
  unseenReviewableCount: number
  types: Array<{ id: string; name: string }>
}

export interface ReviewPerformResult {
  success: boolean
  created_post_id?: number
  created_post_topic_id?: number
  remove_reviewable_ids?: number[]
  reviewable_updates?: Record<number, { status: string }>
  version?: number
  reviewable_count?: number
  unseen_reviewable_count?: number
}

// Invite types (matches Discourse /invites API)
export interface Invite {
  id: number
  invite_key?: string
  link?: string
  description?: string | null
  email?: string | null
  domain?: string | null
  emailed?: boolean
  can_delete_invite?: boolean
  max_redemptions_allowed?: number | null
  redemption_count?: number
  custom_message?: string | null
  created_at?: string
  updated_at?: string
  expires_at?: string | null
  expired?: boolean
  grants_admin?: boolean
  grants_moderator?: boolean
  topics?: Array<{ id: number; title: string; slug: string }>
  groups?: Array<{ id: number; name: string }>
  // Redeemed user fields (InvitedUserSerializer)
  user?: {
    id: number
    username: string
    name?: string
    avatar_template?: string
    created_at?: string
  } | null
  redeemed_at?: string
}

export interface InviteCounts {
  pending?: number
  expired?: number
  redeemed?: number
  total?: number
}

export interface InvitesState {
  filter: 'pending' | 'redeemed' | 'expired'
  invites: Invite[]
  offset: number
  hasMore: boolean
  loading: boolean
  creating: boolean
  errorMessage: string
  counts: InviteCounts
  canSeeInviteDetails: boolean
}
