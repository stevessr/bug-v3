<script setup lang="ts">
import { ref, computed } from 'vue'
import { message } from 'ant-design-vue'

import { REACTIONS } from '../../../utils/linuxDoReaction'
import type { DiscoursePost, ParsedContent, DiscourseUserProfile } from '../types'
import { formatTime, getAvatarUrl } from '../utils'
import ImageProxy from '../ImageProxy.vue'

import PostContent from './PostContent.vue'

const props = defineProps<{
  post: DiscoursePost
  baseUrl: string
  topicId: number
  parsed: ParsedContent
  isParentExpanded: boolean
  isPostLiked: (post: DiscoursePost, reactionId: string) => boolean
  getReactionCount: (post: DiscoursePost, reactionId: string) => number
  isLiking: boolean
  currentUser?: DiscourseUserProfile | null
}>()

const emit = defineEmits<{
  (e: 'openUser', username: string): void
  (e: 'replyTo', payload: { postNumber: number; username: string }): void
  (e: 'toggleReplies', post: DiscoursePost): void
  (e: 'toggleParent', post: DiscoursePost): void
  (e: 'toggleLike', post: DiscoursePost, reactionId: string): void
  (e: 'navigate', url: string): void
  (e: 'bookmark', post: DiscoursePost): void
  (e: 'flag', post: DiscoursePost): void
  (e: 'assign', post: DiscoursePost): void
  (e: 'edit', post: DiscoursePost): void
  (e: 'delete', post: DiscoursePost): void
  (e: 'wiki', post: DiscoursePost): void
}>()

const isCopyLinkClicked = ref(false)

const isOwnPost = computed(() => {
  return props.currentUser && props.post.user_id === props.currentUser.id
})

const canAssign = computed(() => {
  return props.currentUser && (props.currentUser.admin || props.currentUser.moderator)
})

const handleUserClick = (username: string) => {
  emit('openUser', username)
}

const handleReplyClick = () => {
  emit('replyTo', { postNumber: props.post.post_number, username: props.post.username })
}

const handleCopyLink = async () => {
  const url = `${props.baseUrl}/t/${props.topicId}/${props.post.post_number}`
  try {
    await navigator.clipboard.writeText(url)
    message.success('链接已复制到剪贴板')
  } catch {
    const input = document.createElement('input')
    input.value = url
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    message.success('链接已复制到剪贴板')
  }
  isCopyLinkClicked.value = true
  setTimeout(() => {
    isCopyLinkClicked.value = false
  }, 500)
}

const handleToggleLike = (reactionId: string) => {
  emit('toggleLike', props.post, reactionId)
}

const handleToggleReplies = () => {
  emit('toggleReplies', props.post)
}

const handleToggleParent = () => {
  emit('toggleParent', props.post)
}

const handleContentNavigation = (url: string) => {
  emit('navigate', url)
}

const handleBookmark = () => {
  emit('bookmark', props.post)
}

const handleFlag = () => {
  emit('flag', props.post)
}

const handleAssign = () => {
  emit('assign', props.post)
}

const handleEdit = () => {
  emit('edit', props.post)
}

const handleDelete = () => {
  emit('delete', props.post)
}

const handleWiki = () => {
  emit('wiki', props.post)
}
</script>

<template>
  <div
    :data-post-number="props.post.post_number"
    class="post-item p-4 rounded-lg border dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
  >
    <!-- Post header -->
    <div class="post-header mb-3">
      <ImageProxy
        :original-src="getAvatarUrl(props.post.avatar_template, props.baseUrl)"
        :alt="props.post.username"
        class="w-10 h-10 rounded-full cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
        :title="`查看 ${props.post.username} 的主页`"
        @click="handleUserClick(props.post.username)"
      />
      <div class="post-header-main">
        <div
          class="font-medium dark:text-white cursor-pointer hover:text-blue-500"
          @click="handleUserClick(props.post.username)"
        >
          {{ props.post.name || props.post.username }}
        </div>
        <div class="text-xs text-gray-500">
          <span
            class="cursor-pointer hover:text-blue-500"
            @click="handleUserClick(props.post.username)"
          >
            @{{ props.post.username }}
          </span>
          · #{{ props.post.post_number }} · {{ formatTime(props.post.created_at) }}
        </div>
        <div v-if="props.post.reply_to_post_number" class="post-parent-row post-parent-inline">
          <span v-if="props.post.reply_to_user?.username">
            回复 @{{ props.post.reply_to_user.username }}
          </span>
          <span v-else>回复 #{{ props.post.reply_to_post_number }}</span>
        </div>
      </div>
      <div v-if="props.post.reply_to_post_number" class="post-parent-inline-actions">
        <button class="post-parent-toggle" @click="handleToggleParent">
          {{ props.isParentExpanded ? '收起上文' : '展开上文' }}
        </button>
      </div>
    </div>

    <!-- Post content -->
    <PostContent
      :segments="props.parsed.segments"
      :baseUrl="props.baseUrl"
      :footnotes="props.parsed.footnotes"
      @navigate="handleContentNavigation"
    />

    <!-- Post footer -->
    <div class="post-actions mt-3 text-xs text-gray-500">
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <div class="reactions-list">
            <button
              v-for="item in REACTIONS"
              :key="item.id"
              class="reaction-item"
              :class="{ active: props.isPostLiked(props.post, item.id) }"
              :disabled="props.isLiking"
              @click="handleToggleLike(item.id)"
              :title="item.name"
            >
              <span v-if="item.emoji.startsWith('http')" class="emoji emoji-image">
                <ImageProxy
                  :original-src="item.emoji"
                  :alt="item.name"
                  loading="lazy"
                  :fallback-src="item.emoji"
                />
              </span>
              <span v-else class="emoji">{{ item.emoji }}</span>
              <span class="count">{{ props.getReactionCount(props.post, item.id) }}</span>
            </button>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="btn no-text btn-icon post-action-menu__bookmark btn-flat"
              :class="{ bookmarked: props.post.bookmarked }"
              title="书签"
              type="button"
              @click="handleBookmark"
            >
              <svg
                class="fa d-icon d-icon-bookmark svg-icon fa-width-auto svg-string"
                width="1em"
                height="1em"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
              >
                <use href="#bookmark"></use>
              </svg>
            </button>
            <button
              class="btn no-text btn-icon post-action-menu__flag btn-flat"
              title="举报"
              type="button"
              @click="handleFlag"
            >
              <svg
                class="fa d-icon d-icon-flag svg-icon fa-width-auto svg-string"
                width="1em"
                height="1em"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
              >
                <use href="#flag"></use>
              </svg>
            </button>
            <button
              v-if="canAssign"
              class="btn no-text btn-icon post-action-menu__assign btn-flat"
              title="指定"
              type="button"
              @click="handleAssign"
            >
              <svg
                class="fa d-icon d-icon-user-plus svg-icon fa-width-auto svg-string"
                width="1em"
                height="1em"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
              >
                <use href="#user-plus"></use>
              </svg>
            </button>
            <button
              v-if="isOwnPost && props.post.can_edit"
              class="btn no-text btn-icon post-action-menu__edit btn-flat"
              title="编辑"
              type="button"
              @click="handleEdit"
            >
              <svg
                class="fa d-icon d-icon-pencil-alt svg-icon fa-width-auto svg-string"
                width="1em"
                height="1em"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
              >
                <use href="#pencil-alt"></use>
              </svg>
            </button>
            <button
              v-if="isOwnPost && props.post.can_delete"
              class="btn no-text btn-icon post-action-menu__delete btn-flat"
              title="删除"
              type="button"
              @click="handleDelete"
            >
              <svg
                class="fa d-icon d-icon-trash-alt svg-icon fa-width-auto svg-string"
                width="1em"
                height="1em"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
              >
                <use href="#trash-alt"></use>
              </svg>
            </button>
            <button
              v-if="isOwnPost || canAssign"
              class="btn no-text btn-icon post-action-menu__wiki btn-flat"
              :class="{ wiki: props.post.wiki }"
              title="Wiki"
              type="button"
              @click="handleWiki"
            >
              <svg
                class="fa d-icon d-icon-fab-wikipedia-w svg-icon fa-width-auto svg-string"
                width="1em"
                height="1em"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
              >
                <use href="#fab-wikipedia-w"></use>
              </svg>
            </button>
            <button
              class="btn no-text btn-icon post-action-menu__copy-link btn-flat"
              :class="{ 'copy-link-clicked': isCopyLinkClicked }"
              title="将此帖子的链接复制到剪贴板"
              type="button"
              @click="handleCopyLink"
            >
              <svg
                class="fa d-icon d-icon-d-post-share svg-icon fa-width-auto svg-string"
                width="1em"
                height="1em"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
              >
                <use href="#link"></use>
              </svg>
            </button>
            <button
              class="btn btn-icon-text post-action-menu__reply reply create fade-out btn-flat"
              title="开始撰写对此帖子的回复"
              :aria-label="`回复 @${props.post.username} 发布的帖子 #${props.post.post_number}`"
              type="button"
              @click="handleReplyClick"
            >
              <svg
                class="fa d-icon d-icon-reply svg-icon fa-width-auto svg-string"
                width="1em"
                height="1em"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
              >
                <use href="#reply"></use>
              </svg>
              <span class="d-button-label">回复</span>
            </button>
          </div>
        </div>
        <div class="flex items-center justify-between">
          <button
            v-if="props.post.reply_count > 0"
            class="post-action-btn post-replies-toggle"
            @click="handleToggleReplies"
          >
            {{ props.post.reply_count }} 回复
          </button>
          <span v-if="props.post.like_count > 0">{{ props.post.like_count }} 赞</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="../css/PostItem.css"></style>
