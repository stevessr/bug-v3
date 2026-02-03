import { defineComponent } from 'vue'

import type { DiscoursePost, ParsedContent } from '../types'
import { formatTime, getAvatarUrl } from '../utils'

import PostContent from './PostContent'
import '../css/PostReplyItem.css'

export default defineComponent({
  name: 'PostReplyItem',
  props: {
    post: { type: Object as () => DiscoursePost, required: true },
    baseUrl: { type: String, required: true },
    parsed: { type: Object as () => ParsedContent, required: true }
  },
  emits: ['openUser', 'toggleReplies', 'navigate'],
  setup(props, { emit }) {
    const handleUserClick = (username: string) => {
      emit('openUser', username)
    }

    const handleToggleReplies = () => {
      emit('toggleReplies', props.post)
    }

    const handleContentNavigation = (url: string) => {
      emit('navigate', url)
    }

    return () => (
      <div class="post-reply-item border-l border-gray-200 dark:border-gray-700 pl-4">
        <div class="post-header mb-2">
          <img
            src={getAvatarUrl(props.post.avatar_template, props.baseUrl, 32)}
            alt={props.post.username}
            class="w-8 h-8 rounded-full cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
            title={`查看 ${props.post.username} 的主页`}
            onClick={() => handleUserClick(props.post.username)}
          />
          <div class="post-header-main text-sm">
            <span
              class="font-medium dark:text-white cursor-pointer hover:text-blue-500"
              onClick={() => handleUserClick(props.post.username)}
            >
              {props.post.name || props.post.username}
            </span>
            <span class="text-xs text-gray-500 ml-2">
              @{props.post.username} · #{props.post.post_number} ·
              {formatTime(props.post.created_at)}
            </span>
            {props.post.reply_to_post_number && (
              <div class="post-parent-row post-parent-inline">
                {props.post.reply_to_user?.username ? (
                  <span>回复 @{props.post.reply_to_user.username}</span>
                ) : (
                  <span>回复 #{props.post.reply_to_post_number}</span>
                )}
              </div>
            )}
          </div>
        </div>
        <PostContent
          segments={props.parsed.segments}
          baseUrl={props.baseUrl}
          postId={props.post.id}
          polls={props.post.polls}
          footnotes={props.parsed.footnotes}
          onNavigate={handleContentNavigation}
        />
        {props.post.reply_count > 0 && (
          <div class="mt-2 text-xs text-gray-500">
            <button class="post-replies-toggle" onClick={handleToggleReplies}>
              {props.post.reply_count} 回复
            </button>
          </div>
        )}
      </div>
    )
  }
})
