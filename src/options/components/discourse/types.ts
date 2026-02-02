// Discourse Browser Types

export type TopicListType =
  | 'latest'
  | 'new'
  | 'unread'
  | 'unseen'
  | 'top'
  | 'hot'
  | 'posted'
  | 'bookmarks'

export interface BrowserTab {
  id: string
  title: string
  url: string
  loading: boolean
  history: string[]
  historyIndex: number
  scrollTop: number
  // Per-tab state
  viewType: ViewType
  categories: DiscourseCategory[]
  topics: DiscourseTopic[]
  currentTopic: DiscourseTopicDetail | null
  currentUser: DiscourseUserProfile | null
  activeUsers: DiscourseUser[]
  errorMessage: string
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
  // Topic list type for home view
  topicListType: TopicListType
  // Activity state
  activityState: UserActivityState | null
  // Messages state
  messagesState: MessagesState | null
  // Follow feed pagination
  followFeedPage: number
  followFeedHasMore: boolean
  // Topic jump
  targetPostNumber: number | null
  // Cache topic extras from initial topic JSON
  topicExtras: {
    suggested_topics?: SuggestedTopic[]
    related_topics?: SuggestedTopic[]
  } | null
  lastTimingSentAt?: number
  lastTimingTopicId?: number
  chatState: ChatState | null
}

export type ViewType =
  | 'home'
  | 'categories'
  | 'category'
  | 'topic'
  | 'chat'
  | 'user'
  | 'activity'
  | 'messages'
  | 'badges'
  | 'followFeed'
  | 'following'
  | 'followers'
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
  tags?: string[]
  last_poster_username?: string
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
}

export interface DiscoursePost {
  id: number
  username: string
  avatar_template: string
  created_at: string
  cooked: string
  post_number: number
  reply_count: number
  like_count: number
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
  title: string
  fancy_title: string
  posts_count: number
  views: number
  like_count: number
  created_at: string
  post_stream: {
    posts: DiscoursePost[]
    stream: number[]
  }
  details: {
    created_by: DiscourseUser
    participants: DiscourseUser[]
  }
  suggested_topics?: SuggestedTopic[]
  related_topics?: SuggestedTopic[]
}

export interface ChatChannelMembership {
  id?: number
  chat_channel_id?: number
  last_read_message_id?: number
  unread_count?: number
  starred?: boolean
  muted?: boolean
  notification_level?: string
}

export interface ChatChannel {
  id: number
  title?: string
  unicode_title?: string
  channelType?: 'public' | 'direct'
  slug?: string
  description?: string
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
  status?: string
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

export interface ChatMessage {
  id: number
  message?: string
  cooked?: string
  created_at: string
  user_id?: number
  username?: string
  name?: string
  avatar_template?: string
  user?: DiscourseUser
}

export interface ChatState {
  channels: ChatChannel[]
  activeChannelId: number | null
  messagesByChannel: Record<number, ChatMessage[]>
  hasMoreByChannel: Record<number, boolean>
  beforeMessageIdByChannel: Record<number, number | null>
  loadingChannels: boolean
  loadingMessages: boolean
  sendingMessage: boolean
  errorMessage: string
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
}

// Messages types
export type MessagesTabType = 'all' | 'sent' | 'new' | 'unread' | 'archive'

export interface MessagesState {
  activeTab: MessagesTabType
  topics: DiscourseTopic[]
  page: number
  hasMore: boolean
}
