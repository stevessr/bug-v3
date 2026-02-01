<script setup lang="ts">
import type { DiscourseFollowPost, DiscourseUserProfile } from './types'
import { formatTime, getAvatarUrl } from './utils'
import UserTabs from './UserTabs.vue'

const props = defineProps<{
  user: DiscourseUserProfile & {
    _summary?: {
      likes_given: number
      likes_received: number
      topics_entered: number
      posts_read_count: number
      days_visited: number
      topic_count: number
      post_count: number
      time_read: number
      solved_count?: number
      top_categories?: Array<{
        id: number
        name: string
        color: string
        slug: string
        topic_count: number
        post_count: number
      }>
    }
    _topics?: Array<{
      id: number
      title: string
      fancy_title: string
      slug: string
      posts_count: number
      like_count: number
    }>
    _badges?: Array<{
      id: number
      name: string
      description?: string
      image_url?: string
      icon?: string
    }>
    _follow_feed?: DiscourseFollowPost[]
    _following?: Array<{
      id: number
      username: string
      name?: string
      avatar_template: string
    }>
    _followers?: Array<{
      id: number
      username: string
      name?: string
      avatar_template: string
    }>
  }
  baseUrl: string
}>()

const emit = defineEmits<{
  (e: 'openTopic', topic: { id: number; slug: string }): void
  (e: 'openActivity', username: string): void
  (e: 'openMessages', username: string): void
  (e: 'openUser', username: string): void
  (e: 'openBadges', username: string): void
  (e: 'openFollowFeed', username: string): void
  (e: 'openFollowing', username: string): void
  (e: 'openFollowers', username: string): void
  (e: 'switchMainTab', tab: 'summary' | 'activity' | 'messages' | 'badges' | 'follow'): void
}>()

// Format time read
const formatTimeRead = (seconds: number): string => {
  if (!seconds) return '0 小时'
  const hours = Math.floor(seconds / 3600)
  if (hours < 24) return `${hours} 小时`
  const days = Math.floor(hours / 24)
  return `${days} 天 ${hours % 24} 小时`
}

// Get trust level name
const getTrustLevelName = (level: number): string => {
  const names: Record<number, string> = {
    0: '新用户',
    1: '基本用户',
    2: '成员',
    3: '活跃用户',
    4: '领导者'
  }
  return names[level] || `等级 ${level}`
}
</script>

<template>
  <div class="user-profile space-y-6">
    <!-- User header -->
    <div
      class="user-header relative rounded-lg overflow-hidden"
      :style="{
        backgroundImage: user.card_background_upload_url
          ? `url(${baseUrl}${user.card_background_upload_url})`
          : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }"
    >
      <div class="bg-black/40 p-6">
        <div class="flex items-start gap-4">
          <!-- Avatar -->
          <img
            :src="getAvatarUrl(user.avatar_template, baseUrl, 120)"
            :alt="user.username"
            class="w-24 h-24 rounded-full border-4 border-white shadow-lg"
          />

          <div class="flex-1 text-white">
            <!-- Username and status -->
            <div class="flex items-center gap-2">
              <h1 class="text-2xl font-bold">{{ user.username }}</h1>
              <span v-if="user.admin" class="px-2 py-0.5 text-xs bg-red-500 rounded">管理员</span>
              <span v-else-if="user.moderator" class="px-2 py-0.5 text-xs bg-blue-500 rounded">
                版主
              </span>
            </div>

            <!-- Name -->
            <div v-if="user.name" class="text-sm opacity-80">{{ user.name }}</div>

            <!-- Title -->
            <div v-if="user.title" class="text-sm mt-1 text-yellow-300">{{ user.title }}</div>

            <!-- Status -->
            <div v-if="user.status" class="flex items-center gap-1 mt-2 text-sm">
              <span>{{ user.status.emoji }}</span>
              <span>{{ user.status.description }}</span>
            </div>

            <!-- Trust level and location -->
            <div class="flex items-center gap-4 mt-2 text-sm opacity-80">
              <span>{{ getTrustLevelName(user.trust_level) }}</span>
              <span v-if="user.location">📍 {{ user.location }}</span>
              <span v-if="user.website">
                <a :href="user.website" target="_blank" rel="noopener" class="hover:underline">
                  🔗 {{ user.website_name || user.website }}
                </a>
              </span>
            </div>

            <!-- Actions -->
            <div class="mt-3 text-sm opacity-80">用户概览</div>
          </div>
        </div>
      </div>
    </div>

    <UserTabs active="summary" @switchTab="emit('switchMainTab', $event)" />

    <!-- Bio -->
    <div
      v-if="user.bio_cooked"
      class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700"
    >
      <h3 class="text-sm font-semibold mb-2 dark:text-white">个人简介</h3>
      <div class="prose dark:prose-invert max-w-none text-sm" v-html="user.bio_cooked" />
    </div>

    <!-- Stats -->
    <div v-if="user._summary" class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div
        class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700 text-center"
      >
        <div class="text-2xl font-bold text-blue-500">{{ user._summary.topic_count }}</div>
        <div class="text-xs text-gray-500">发布话题</div>
      </div>
      <div
        class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700 text-center"
      >
        <div class="text-2xl font-bold text-green-500">{{ user._summary.post_count }}</div>
        <div class="text-xs text-gray-500">发布帖子</div>
      </div>
      <div
        class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700 text-center"
      >
        <div class="text-2xl font-bold text-red-500">{{ user._summary.likes_received }}</div>
        <div class="text-xs text-gray-500">收到赞</div>
      </div>
      <div
        class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700 text-center"
      >
        <div class="text-2xl font-bold text-purple-500">{{ user._summary.likes_given }}</div>
        <div class="text-xs text-gray-500">送出赞</div>
      </div>
      <div
        class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700 text-center"
      >
        <div class="text-2xl font-bold text-orange-500">{{ user._summary.days_visited }}</div>
        <div class="text-xs text-gray-500">访问天数</div>
      </div>
      <div
        class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700 text-center"
      >
        <div class="text-2xl font-bold text-cyan-500">
          {{ formatTimeRead(user._summary.time_read) }}
        </div>
        <div class="text-xs text-gray-500">阅读时间</div>
      </div>
      <div
        class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700 text-center"
      >
        <div class="text-2xl font-bold text-pink-500">{{ user._summary.topics_entered }}</div>
        <div class="text-xs text-gray-500">浏览话题</div>
      </div>
      <div
        v-if="user._summary.solved_count"
        class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700 text-center"
      >
        <div class="text-2xl font-bold text-emerald-500">{{ user._summary.solved_count }}</div>
        <div class="text-xs text-gray-500">解决问题</div>
      </div>
    </div>

    <!-- Featured topic -->
    <div
      v-if="user.featured_topic"
      class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700"
    >
      <h3 class="text-sm font-semibold mb-2 dark:text-white">置顶话题</h3>
      <div
        class="cursor-pointer hover:text-blue-500 dark:text-gray-300"
        @click="emit('openTopic', user.featured_topic!)"
      >
        <span v-html="user.featured_topic.fancy_title || user.featured_topic.title" />
        <span class="text-xs text-gray-500 ml-2">({{ user.featured_topic.posts_count }} 帖子)</span>
      </div>
    </div>

    <!-- Top categories -->
    <div
      v-if="user._summary?.top_categories && user._summary.top_categories.length > 0"
      class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700"
    >
      <h3 class="text-sm font-semibold mb-3 dark:text-white">活跃分类</h3>
      <div class="space-y-2">
        <div
          v-for="cat in user._summary.top_categories.slice(0, 5)"
          :key="cat.id"
          class="flex items-center justify-between"
        >
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded" :style="{ backgroundColor: `#${cat.color}` }" />
            <span class="text-sm dark:text-gray-300">{{ cat.name }}</span>
          </div>
          <div class="text-xs text-gray-500">
            {{ cat.topic_count }} 话题 · {{ cat.post_count }} 帖子
          </div>
        </div>
      </div>
    </div>

    <!-- Recent topics -->
    <div
      v-if="user._topics && user._topics.length > 0"
      class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700"
    >
      <h3 class="text-sm font-semibold mb-3 dark:text-white">热门话题</h3>
      <div class="space-y-2">
        <div
          v-for="topic in user._topics.slice(0, 6)"
          :key="topic.id"
          class="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
          @click="emit('openTopic', topic)"
        >
          <div
            class="text-sm dark:text-gray-300 truncate"
            v-html="topic.fancy_title || topic.title"
          />
          <div class="text-xs text-gray-500 mt-1">
            {{ topic.posts_count }} 帖子 · {{ topic.like_count }} 赞
          </div>
        </div>
      </div>
    </div>

    <!-- Account info -->
    <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700">
      <h3 class="text-sm font-semibold mb-2 dark:text-white">账户信息</h3>
      <div class="grid grid-cols-2 gap-2 text-sm">
        <div class="text-gray-500">注册时间</div>
        <div class="dark:text-gray-300">{{ formatTime(user.created_at) }}</div>
        <template v-if="user.last_seen_at">
          <div class="text-gray-500">最后在线</div>
          <div class="dark:text-gray-300">{{ formatTime(user.last_seen_at) }}</div>
        </template>
        <template v-if="user.last_posted_at">
          <div class="text-gray-500">最后发帖</div>
          <div class="dark:text-gray-300">{{ formatTime(user.last_posted_at) }}</div>
        </template>
        <template v-if="user.profile_view_count">
          <div class="text-gray-500">主页浏览</div>
          <div class="dark:text-gray-300">{{ user.profile_view_count }} 次</div>
        </template>
        <template v-if="user.badge_count">
          <div class="text-gray-500">徽章数量</div>
          <div class="dark:text-gray-300">{{ user.badge_count }} 个</div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped src="./UserView.css"></style>
