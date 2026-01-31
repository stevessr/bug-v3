<script setup lang="ts">
import type {
  DiscourseUserProfile,
  UserActivityState,
  DiscourseUserAction,
  DiscourseTopic,
  DiscourseReaction,
  DiscourseSolvedPost,
  ActivityTabType
} from './types'
import { formatTime, getAvatarUrl } from './utils'
import DiscourseUserTabs from './DiscourseUserTabs.vue'

const props = defineProps<{
  user: DiscourseUserProfile
  activityState: UserActivityState
  baseUrl: string
  isLoadingMore: boolean
}>()

const emit = defineEmits<{
  (e: 'switchTab', tab: ActivityTabType): void
  (e: 'openTopic', topic: { id: number; slug: string }): void
  (e: 'openUser', username: string): void
  (e: 'goToProfile'): void
  (e: 'switchMainTab', tab: 'summary' | 'activity' | 'messages' | 'badges' | 'follow'): void
}>()

const tabs: { key: ActivityTabType; label: string }[] = [
  { key: 'all', label: '所有' },
  { key: 'topics', label: '话题' },
  { key: 'replies', label: '回复' },
  { key: 'likes', label: '赞' },
  { key: 'reactions', label: '反应' },
  { key: 'solved', label: '已解决' },
  { key: 'assigned', label: '已指定' },
  { key: 'votes', label: '投票' },
  { key: 'portfolio', label: '作品集' }
]

// Get action type label
const getActionTypeLabel = (actionType: number): string => {
  const types: Record<number, string> = {
    1: '赞了',
    2: '收藏了',
    3: '回复了',
    4: '创建了话题',
    5: '回复了',
    6: '被提及',
    7: '引用了',
    9: '收到回复',
    11: '编辑了',
    12: '发送了消息',
    13: '收到消息'
  }
  return types[actionType] || '活动'
}
</script>

<template>
  <div class="activity-view space-y-4">
    <!-- User header (compact) -->
    <div
      class="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700"
    >
      <img
        :src="getAvatarUrl(user.avatar_template, baseUrl, 64)"
        :alt="user.username"
        class="w-16 h-16 rounded-full cursor-pointer hover:ring-2 hover:ring-blue-500"
        @click="emit('goToProfile')"
      />
      <div class="flex-1">
        <div class="flex items-center gap-2">
          <h2
            class="text-xl font-bold dark:text-white cursor-pointer hover:text-blue-500"
            @click="emit('goToProfile')"
          >
            {{ user.username }}
          </h2>
          <span v-if="user.admin" class="px-2 py-0.5 text-xs bg-red-500 text-white rounded">
            管理员
          </span>
          <span
            v-else-if="user.moderator"
            class="px-2 py-0.5 text-xs bg-blue-500 text-white rounded"
          >
            版主
          </span>
        </div>
        <div v-if="user.name" class="text-sm text-gray-500">{{ user.name }}</div>
        <div v-if="user.title" class="text-sm text-yellow-600 dark:text-yellow-400">
          {{ user.title }}
        </div>
      </div>
    </div>

    <DiscourseUserTabs active="activity" @switchTab="emit('switchMainTab', $event)" />

    <!-- Tab navigation -->
    <div class="flex gap-1 overflow-x-auto border-b dark:border-gray-700 pb-1">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="px-4 py-2 text-sm rounded-t whitespace-nowrap transition-colors"
        :class="
          activityState.activeTab === tab.key
            ? 'bg-blue-500 text-white'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
        "
        @click="emit('switchTab', tab.key)"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Content based on active tab -->
    <div class="activity-content">
      <!-- All / Replies / Likes (user_actions) -->
      <div v-if="['all', 'replies', 'likes'].includes(activityState.activeTab)" class="space-y-2">
        <div
          v-for="action in activityState.actions"
          :key="`${action.action_type}-${action.post_id}`"
          class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer transition-colors"
          @click="emit('openTopic', { id: action.topic_id, slug: action.slug })"
        >
          <div class="flex items-start gap-3">
            <img
              :src="getAvatarUrl(action.avatar_template, baseUrl, 40)"
              :alt="action.username"
              class="w-10 h-10 rounded-full flex-shrink-0"
              @click.stop="emit('openUser', action.username)"
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <span
                  class="font-medium text-gray-700 dark:text-gray-300 hover:text-blue-500 cursor-pointer"
                  @click.stop="emit('openUser', action.username)"
                >
                  {{ action.name || action.username }}
                </span>
                <span>{{ getActionTypeLabel(action.action_type) }}</span>
                <span class="text-gray-400">{{ formatTime(action.created_at) }}</span>
              </div>
              <div class="font-medium dark:text-white truncate" v-html="action.title" />
              <div
                v-if="action.excerpt"
                class="text-sm text-gray-500 mt-1 line-clamp-2"
                v-html="action.excerpt"
              />
            </div>
          </div>
        </div>

        <div
          v-if="activityState.actions.length === 0 && !isLoadingMore"
          class="text-center text-gray-400 py-8"
        >
          暂无数据
        </div>
      </div>

      <!-- Topics / Assigned / Votes / Portfolio -->
      <div
        v-else-if="['topics', 'assigned', 'votes', 'portfolio'].includes(activityState.activeTab)"
        class="space-y-2"
      >
        <div
          v-for="topic in activityState.topics"
          :key="topic.id"
          class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer transition-colors"
          @click="emit('openTopic', topic)"
        >
          <div class="font-medium dark:text-white" v-html="topic.fancy_title || topic.title" />
          <div class="flex items-center flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
            <span>{{ topic.posts_count }} 帖子</span>
            <span>{{ topic.views }} 浏览</span>
            <span>{{ topic.like_count }} 赞</span>
            <span v-if="(topic as any).vote_count">{{ (topic as any).vote_count }} 票</span>
            <span v-if="(topic as any).assigned_to_user" class="text-blue-500">
              指定给：{{ (topic as any).assigned_to_user.username }}
            </span>
            <span>{{ formatTime(topic.created_at) }}</span>
          </div>
        </div>

        <div
          v-if="activityState.topics.length === 0 && !isLoadingMore"
          class="text-center text-gray-400 py-8"
        >
          {{
            activityState.activeTab === 'topics'
              ? '暂无话题'
              : activityState.activeTab === 'assigned'
                ? '暂无已指定'
                : activityState.activeTab === 'votes'
                  ? '暂无投票'
                  : '暂无作品集'
          }}
        </div>
      </div>

      <!-- Reactions -->
      <div v-else-if="activityState.activeTab === 'reactions'" class="space-y-2">
        <div
          v-for="reaction in activityState.reactions"
          :key="reaction.id"
          class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer transition-colors"
          @click="emit('openTopic', { id: reaction.post.topic_id, slug: reaction.post.topic_slug })"
        >
          <div class="flex items-start gap-3">
            <img
              :src="getAvatarUrl(reaction.post.avatar_template, baseUrl, 40)"
              :alt="reaction.post.username"
              class="w-10 h-10 rounded-full flex-shrink-0"
              @click.stop="emit('openUser', reaction.post.username)"
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <span class="text-lg">
                  {{
                    reaction.reaction.reaction_value === '+1'
                      ? '👍'
                      : reaction.reaction.reaction_value
                  }}
                </span>
                <span>反应于</span>
                <span
                  class="font-medium text-gray-700 dark:text-gray-300 hover:text-blue-500 cursor-pointer"
                  @click.stop="emit('openUser', reaction.post.username)"
                >
                  {{ reaction.post.name || reaction.post.username }}
                </span>
                <span class="text-gray-400">{{ formatTime(reaction.created_at) }}</span>
              </div>
              <div
                class="font-medium dark:text-white truncate"
                v-html="reaction.post.topic_html_title || reaction.post.topic_title"
              />
              <div
                v-if="reaction.post.excerpt"
                class="text-sm text-gray-500 mt-1 line-clamp-2"
                v-html="reaction.post.excerpt"
              />
            </div>
          </div>
        </div>

        <div
          v-if="activityState.reactions.length === 0 && !isLoadingMore"
          class="text-center text-gray-400 py-8"
        >
          暂无反应
        </div>
      </div>

      <!-- Solved -->
      <div v-else-if="activityState.activeTab === 'solved'" class="space-y-2">
        <div
          v-for="post in activityState.solvedPosts"
          :key="post.post_id"
          class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer transition-colors"
          @click="emit('openTopic', { id: post.topic_id, slug: post.slug })"
        >
          <div class="flex items-start gap-3">
            <img
              :src="getAvatarUrl(post.avatar_template, baseUrl, 40)"
              :alt="post.username"
              class="w-10 h-10 rounded-full flex-shrink-0"
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <span class="text-green-500">✓ 已解决</span>
                <span class="text-gray-400">{{ formatTime(post.created_at) }}</span>
              </div>
              <div class="font-medium dark:text-white truncate">{{ post.topic_title }}</div>
              <div
                v-if="post.excerpt"
                class="text-sm text-gray-500 mt-1 line-clamp-2"
                v-html="post.excerpt"
              />
            </div>
          </div>
        </div>

        <div
          v-if="activityState.solvedPosts.length === 0 && !isLoadingMore"
          class="text-center text-gray-400 py-8"
        >
          暂无已解决问题
        </div>
      </div>

      <!-- Loading more indicator -->
      <div v-if="isLoadingMore" class="flex items-center justify-center py-4">
        <a-spin />
        <span class="ml-2 text-gray-500">加载更多...</span>
      </div>

      <!-- End indicator -->
      <div
        v-if="!activityState.hasMore && !isLoadingMore"
        class="text-center text-gray-400 py-4 text-sm"
      >
        已加载全部
      </div>
    </div>
  </div>
</template>

<style scoped>
.activity-view :deep(a) {
  color: #3b82f6;
  text-decoration: none;
}

.activity-view :deep(a:hover) {
  text-decoration: underline;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
