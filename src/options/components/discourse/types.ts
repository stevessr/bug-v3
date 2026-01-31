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
