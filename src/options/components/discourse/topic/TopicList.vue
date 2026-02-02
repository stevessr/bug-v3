<script setup lang="ts">
import type {
  DiscourseTopic,
  SuggestedTopic,
  DiscourseCategory,
  DiscourseUser,
  DiscourseTopicTag
} from '../types'
import { formatTime, getAvatarUrl } from '../utils'

defineProps<{
  topics: DiscourseTopic[] | SuggestedTopic[]
  baseUrl: string
  categories?: DiscourseCategory[]
  users?: DiscourseUser[]
}>()

const emit = defineEmits<{
  (e: 'click', topic: DiscourseTopic | SuggestedTopic): void
  (e: 'middleClick', url: string): void
  (e: 'openUser', username: string): void
  (e: 'openTag', tagName: string): void
}>()

const handleClick = (topic: DiscourseTopic | SuggestedTopic) => {
  emit('click', topic)
}

const getUnreadCount = (topic: DiscourseTopic | SuggestedTopic) => {
  const unread =
    (topic as DiscourseTopic).unread_posts ??
    (topic as DiscourseTopic).new_posts ??
    (topic as DiscourseTopic).unread ??
    0
  return typeof unread === 'number' ? unread : 0
}

const getTargetPostNumber = (topic: DiscourseTopic | SuggestedTopic) => {
  const unread = getUnreadCount(topic)
  const lastRead = (topic as DiscourseTopic).last_read_post_number
  if (unread > 0 && typeof lastRead === 'number' && lastRead >= 0) {
    return lastRead + 1
  }
  return null
}

const getTopicUrl = (topic: DiscourseTopic | SuggestedTopic, baseUrl: string) => {
  const target = getTargetPostNumber(topic)
  return target
    ? `${baseUrl}/t/${topic.slug}/${topic.id}/${target}`
    : `${baseUrl}/t/${topic.slug}/${topic.id}`
}

const handleMiddleClick = (topic: DiscourseTopic | SuggestedTopic, baseUrl: string) => {
  emit('middleClick', getTopicUrl(topic, baseUrl))
}

const getCategory = (topic: DiscourseTopic | SuggestedTopic, categories?: DiscourseCategory[]) => {
  const categoryId = (topic as DiscourseTopic).category_id
  if (!categoryId || !categories) return null
  return categories.find(c => c.id === categoryId)
}

const getUserById = (userId: number, users?: DiscourseUser[]) => {
  if (!users) return null
  return users.find(u => u.id === userId)
}

const getPosters = (topic: DiscourseTopic | SuggestedTopic, users?: DiscourseUser[]) => {
  const posters = (topic as DiscourseTopic).posters || []
  // 返回所有发帖人，包括原始发帖人、频繁发帖人和最新发帖人
  return posters.map(poster => {
    const user = getUserById(poster.user_id, users)
    return {
      ...poster,
      user
    }
  })
}

const handleUserClick = (username: string) => {
  emit('openUser', username)
}

const getTagLabel = (tag: string | DiscourseTopicTag) => {
  if (typeof tag === 'string') return tag
  return tag.name || tag.text || tag.slug || String(tag.id || '')
}

const getTagKey = (tag: string | DiscourseTopicTag) => {
  if (typeof tag === 'string') return tag
  return String(tag.id || tag.slug || tag.name || tag.text || JSON.stringify(tag))
}

const handleTagClick = (tag: string | DiscourseTopicTag) => {
  const label = getTagLabel(tag).trim()
  if (!label) return
  emit('openTag', label)
}
</script>

<template>
  <div class="space-y-2">
    <div
      v-for="topic in topics"
      :key="topic.id"
      class="topic-item p-3 rounded-lg border dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      @click="handleClick(topic)"
      @click.middle="handleMiddleClick(topic, baseUrl)"
    >
      <div class="flex items-start gap-3">
        <div class="flex-1 min-w-0">
          <!-- 分区和标签 -->
          <div class="flex items-center gap-2 mb-1 flex-wrap">
            <span
              v-if="getCategory(topic, categories)"
              class="topic-category text-xs px-2 py-0.5 rounded-full"
              :style="{
                backgroundColor: getCategory(topic, categories)!.color + '20',
                color: getCategory(topic, categories)!.text_color
              }"
            >
              {{ getCategory(topic, categories)!.name }}
            </span>
            <span
              v-for="tag in (topic as DiscourseTopic).tags"
              :key="getTagKey(tag)"
              class="topic-tag text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 cursor-pointer"
              @click.stop="handleTagClick(tag)"
            >
              #{{ getTagLabel(tag) }}
            </span>
          </div>

          <!-- 标题 -->
          <div
            class="font-medium dark:text-white truncate"
            v-html="topic.fancy_title || topic.title"
          />

          <!-- 统计信息 -->
          <div class="flex items-center gap-4 mt-1 text-xs text-gray-500">
            <span>{{ topic.posts_count }} 回复</span>
            <span>{{ topic.views }} 浏览</span>
            <span>{{ topic.like_count }} 赞</span>
            <span>{{ formatTime(topic.last_posted_at || topic.created_at) }}</span>
            <span v-if="getUnreadCount(topic) > 0" class="topic-unread">
              未读 +{{ getUnreadCount(topic) }}
            </span>
          </div>

          <!-- 活跃发言人 -->
          <div v-if="getPosters(topic, users).length > 0" class="flex items-center gap-1 mt-2">
            <span class="text-xs text-gray-400 mr-1">活跃：</span>
            <div
              v-for="poster in getPosters(topic, users)"
              :key="poster.user_id"
              class="poster-avatar"
              :class="{ 'latest-poster': poster.extras === 'latest' }"
              :title="
                poster.user
                  ? `${poster.user.name || poster.user.username} - ${poster.description}`
                  : poster.description
              "
              @click="poster.user && handleUserClick(poster.user.username)"
            >
              <img
                v-if="poster.user"
                :src="getAvatarUrl(poster.user.avatar_template, baseUrl, 24)"
                :alt="poster.user.username"
                class="avatar"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="../css/TopicList.css"></style>
