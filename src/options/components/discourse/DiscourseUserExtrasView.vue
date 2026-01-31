<script setup lang="ts">
import type { DiscourseFollowPost, DiscourseUserProfile } from './types'
import { formatTime, getAvatarUrl } from './utils'
import DiscourseUserTabs from './DiscourseUserTabs.vue'

type ExtrasTab = 'badges' | 'followFeed' | 'following' | 'followers'

const props = defineProps<{
  user: DiscourseUserProfile & {
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
  tab: ExtrasTab
  isLoadingMore?: boolean
  hasMore?: boolean
}>()

const emit = defineEmits<{
  (e: 'switchTab', tab: ExtrasTab): void
  (e: 'switchMainTab', tab: 'summary' | 'activity' | 'messages' | 'badges' | 'follow'): void
  (e: 'openUser', username: string): void
  (e: 'openTopic', topic: { id: number; slug: string }): void
  (e: 'goToProfile'): void
}>()
</script>

<template>
  <div class="user-extras space-y-4">
    <DiscourseUserTabs
      :active="tab === 'badges' ? 'badges' : 'follow'"
      @switchTab="emit('switchMainTab', $event)"
    />

    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <button
          class="px-3 py-1 text-sm rounded border dark:border-gray-700"
          :class="tab === 'badges' ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-800'"
          @click="emit('switchTab', 'badges')"
        >
          徽章
        </button>
        <button
          class="px-3 py-1 text-sm rounded border dark:border-gray-700"
          :class="tab === 'followFeed' ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-800'"
          @click="emit('switchTab', 'followFeed')"
        >
          关注动态
        </button>
        <button
          class="px-3 py-1 text-sm rounded border dark:border-gray-700"
          :class="tab === 'following' ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-800'"
          @click="emit('switchTab', 'following')"
        >
          正在关注
        </button>
        <button
          class="px-3 py-1 text-sm rounded border dark:border-gray-700"
          :class="tab === 'followers' ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-800'"
          @click="emit('switchTab', 'followers')"
        >
          关注者
        </button>
      </div>
      <button
        class="px-3 py-1 text-sm rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
        @click="emit('goToProfile')"
      >
        返回主页
      </button>
    </div>

    <div v-if="tab === 'badges'" class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border">
      <div v-if="!user._badges || user._badges.length === 0" class="text-sm text-gray-500">
        暂无徽章
      </div>
      <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <div
          v-for="badge in user._badges"
          :key="badge.id"
          class="flex items-center gap-2 p-2 rounded bg-white/70 dark:bg-gray-900/40 border border-gray-200/70 dark:border-gray-700"
          :title="badge.description || badge.name"
        >
          <img
            v-if="badge.image_url"
            :src="badge.image_url.startsWith('http') ? badge.image_url : `${baseUrl}${badge.image_url}`"
            :alt="badge.name"
            class="w-8 h-8 rounded"
          />
          <div v-else class="w-8 h-8 rounded bg-gray-200 dark:bg-gray-700" />
          <div class="text-xs dark:text-gray-300 truncate">{{ badge.name }}</div>
        </div>
      </div>
    </div>

    <div
      v-else-if="tab === 'followFeed'"
      class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border"
    >
      <div
        v-if="!user._follow_feed || user._follow_feed.length === 0"
        class="text-sm text-gray-500"
      >
        暂无关注动态
      </div>
      <div v-else class="space-y-3">
        <div
          v-for="post in user._follow_feed"
          :key="post.id"
          class="p-3 rounded bg-white/70 dark:bg-gray-900/40 border border-gray-200/70 dark:border-gray-700"
        >
          <div class="text-xs text-gray-500 mb-1">
            {{ formatTime(post.created_at) }} · @{{ post.user.username }}
          </div>
          <div
            class="text-sm dark:text-gray-300 cursor-pointer hover:text-blue-500"
            v-html="post.topic.fancy_title || post.topic.title"
            @click="emit('openTopic', post.topic)"
          />
          <div class="text-xs text-gray-500 mt-1 whitespace-pre-line">
            {{ post.excerpt }}
          </div>
        </div>
        <div v-if="isLoadingMore" class="text-sm text-gray-500 text-center py-2">
          加载更多动态...
        </div>
        <div
          v-else-if="hasMore === false"
          class="text-xs text-gray-400 text-center py-2"
        >
          已加载全部动态
        </div>
      </div>
    </div>

    <div
      v-else-if="tab === 'following'"
      class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border"
    >
      <div
        v-if="!user._following || user._following.length === 0"
        class="text-sm text-gray-500"
      >
        暂无关注
      </div>
      <div v-else class="flex flex-wrap gap-2">
        <div
          v-for="u in user._following"
          :key="u.id"
          class="flex items-center gap-2 px-2 py-1 rounded bg-white/70 dark:bg-gray-900/40 border border-gray-200/70 dark:border-gray-700 cursor-pointer"
          @click="emit('openUser', u.username)"
        >
          <img
            :src="getAvatarUrl(u.avatar_template, baseUrl, 32)"
            :alt="u.username"
            class="w-6 h-6 rounded-full"
          />
          <span class="text-xs dark:text-gray-300">{{ u.name || u.username }}</span>
        </div>
      </div>
    </div>

    <div
      v-else
      class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border"
    >
      <div
        v-if="!user._followers || user._followers.length === 0"
        class="text-sm text-gray-500"
      >
        暂无关注者
      </div>
      <div v-else class="flex flex-wrap gap-2">
        <div
          v-for="u in user._followers"
          :key="u.id"
          class="flex items-center gap-2 px-2 py-1 rounded bg-white/70 dark:bg-gray-900/40 border border-gray-200/70 dark:border-gray-700 cursor-pointer"
          @click="emit('openUser', u.username)"
        >
          <img
            :src="getAvatarUrl(u.avatar_template, baseUrl, 32)"
            :alt="u.username"
            class="w-6 h-6 rounded-full"
          />
          <span class="text-xs dark:text-gray-300">{{ u.name || u.username }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.user-extras :deep(a) {
  color: #3b82f6;
  text-decoration: none;
}

.user-extras :deep(a:hover) {
  text-decoration: underline;
}
</style>
