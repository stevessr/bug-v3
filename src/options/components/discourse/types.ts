// Discourse Browser Types

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
}

export type ViewType = 'home' | 'category' | 'topic' | 'user' | 'error'

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
}

export interface DiscourseCategory {
  id: number
  name: string
  slug: string
  color: string
  text_color: string
  topic_count: number
  description?: string
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

export interface ParsedContent {
  html: string
  images: string[]
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
}
