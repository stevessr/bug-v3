<script setup lang="ts">
import type { DiscourseUserProfile, MessagesState, MessagesTabType, DiscourseUser } from './types'
import { formatTime, getAvatarUrl } from './utils'
import DiscourseUserTabs from './DiscourseUserTabs.vue'

const props = defineProps<{
  user: DiscourseUserProfile
  messagesState: MessagesState
  baseUrl: string
  isLoadingMore: boolean
  users: Map<number, DiscourseUser>
}>()

const emit = defineEmits<{
  (e: 'switchTab', tab: MessagesTabType): void
  (e: 'openTopic', topic: { id: number; slug: string }): void
  (e: 'openUser', username: string): void
  (e: 'goToProfile'): void
  (e: 'switchMainTab', tab: 'summary' | 'activity' | 'messages' | 'badges' | 'follow'): void
}>()

const tabs: { key: MessagesTabType; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'sent', label: '已发送' },
  { key: 'new', label: '新消息' },
  { key: 'unread', label: '未读' },
  { key: 'archive', label: '归档' }
]
</script>

<template>
  <div class="messages-view space-y-4">
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
          <span class="px-2 py-0.5 text-xs bg-purple-500 text-white rounded">私信</span>
        </div>
        <div v-if="user.name" class="text-sm text-gray-500">{{ user.name }}</div>
      </div>
    </div>

    <DiscourseUserTabs active="messages" @switchTab="emit('switchMainTab', $event)" />

    <!-- Tab navigation -->
    <div class="flex gap-1 overflow-x-auto border-b dark:border-gray-700 pb-1">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="px-4 py-2 text-sm rounded-t whitespace-nowrap transition-colors"
        :class="
          messagesState.activeTab === tab.key
            ? 'bg-purple-500 text-white'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
        "
        @click="emit('switchTab', tab.key)"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Messages list -->
    <div class="messages-content space-y-2">
      <div
        v-for="topic in messagesState.topics"
        :key="topic.id"
        class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 cursor-pointer transition-colors"
        @click="emit('openTopic', topic)"
      >
        <div class="flex items-start gap-3">
          <!-- Participants avatars -->
          <div class="flex -space-x-2 flex-shrink-0">
            <template v-if="topic.participants && topic.participants.length > 0">
              <div
                v-for="(participant, index) in topic.participants.slice(0, 3)"
                :key="participant.user_id"
                class="relative"
                :style="{ zIndex: 3 - index }"
              >
                <img
                  v-if="users.get(participant.user_id)"
                  :src="getAvatarUrl(users.get(participant.user_id)!.avatar_template, baseUrl, 40)"
                  :alt="users.get(participant.user_id)!.username"
                  class="w-10 h-10 rounded-full border-2 border-white dark:border-gray-800 object-cover"
                />
                <div
                  v-else
                  class="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 border-2 border-white dark:border-gray-800 flex items-center justify-center text-xs text-gray-600 dark:text-gray-300"
                >
                  {{ index + 1 }}
                </div>
              </div>
            </template>
            <div
              v-else
              class="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center"
            >
              <span class="text-purple-500 text-lg">@</span>
            </div>
          </div>

          <div class="flex-1 min-w-0">
            <!-- Title -->
            <div
              class="font-medium dark:text-white truncate"
              v-html="topic.fancy_title || topic.title"
            />

            <!-- Meta info -->
            <div class="flex items-center flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
              <span>{{ topic.posts_count }} 条消息</span>
              <span v-if="topic.allowed_user_count">{{ topic.allowed_user_count }} 位参与者</span>
              <span>{{ topic.like_count }} 赞</span>
              <span>{{ formatTime(topic.last_posted_at || topic.created_at) }}</span>
            </div>

            <!-- Unread indicator -->
            <div v-if="(topic.unread || 0) > 0 || (topic.new_posts || 0) > 0" class="mt-2">
              <span
                v-if="(topic.unread || 0) > 0"
                class="inline-block px-2 py-0.5 text-xs bg-red-500 text-white rounded mr-2"
              >
                {{ topic.unread }} 未读
              </span>
              <span
                v-if="(topic.new_posts || 0) > 0"
                class="inline-block px-2 py-0.5 text-xs bg-blue-500 text-white rounded"
              >
                {{ topic.new_posts }} 新消息
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-if="messagesState.topics.length === 0 && !isLoadingMore"
        class="text-center text-gray-400 py-8"
      >
        {{
          messagesState.activeTab === 'all'
            ? '暂无私信'
            : messagesState.activeTab === 'sent'
              ? '暂无已发送私信'
              : messagesState.activeTab === 'new'
                ? '暂无新消息'
                : messagesState.activeTab === 'unread'
                  ? '暂无未读消息'
                  : '暂无归档消息'
        }}
      </div>

      <!-- Loading more indicator -->
      <div v-if="isLoadingMore" class="flex items-center justify-center py-4">
        <a-spin />
        <span class="ml-2 text-gray-500">加载更多...</span>
      </div>

      <!-- End indicator -->
      <div
        v-if="!messagesState.hasMore && !isLoadingMore && messagesState.topics.length > 0"
        class="text-center text-gray-400 py-4 text-sm"
      >
        已加载全部
      </div>
    </div>
  </div>
</template>

<style scoped>
.messages-view :deep(a) {
  color: #3b82f6;
  text-decoration: none;
}

.messages-view :deep(a:hover) {
  text-decoration: underline;
}
</style>
