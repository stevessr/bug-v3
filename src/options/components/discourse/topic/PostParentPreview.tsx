import { defineComponent, computed } from 'vue'

import type { DiscoursePost, ParsedContent } from '../types'
import { formatTime, getAvatarUrl } from '../utils'

import PostContent from './PostContent'
import '../css/PostParentPreview.css'

const PostParentPreview = defineComponent({
  name: 'PostParentPreview',
  props: {
    post: { type: Object as () => DiscoursePost, required: true },
    parsed: { type: Object as () => ParsedContent, required: true },
    baseUrl: { type: String, required: true },
    getParentPost: {
      type: Function as unknown as () => (post: DiscoursePost) => DiscoursePost | null,
      required: true
    },
    getParentParsed: {
      type: Function as unknown as () => (post: DiscoursePost) => ParsedContent | null,
      required: true
    },
    isParentExpanded: {
      type: Function as unknown as () => (post: DiscoursePost) => boolean,
      required: true
    },
    isParentLoading: {
      type: Function as unknown as () => (post: DiscoursePost) => boolean,
      required: true
    }
  },
  emits: ['openUser', 'jumpToPost', 'navigate', 'toggleParent'],
  setup(props, { emit }) {
    const hasParent = computed(() => !!props.post.reply_to_post_number)
    const parentPost = computed(() => props.getParentPost(props.post))
    const parentParsed = computed(() => props.getParentParsed(props.post))
    const isExpanded = computed(() => props.isParentExpanded(props.post))
    const isLoading = computed(() => props.isParentLoading(props.post))

    const handleUserClick = (username: string) => {
      emit('openUser', username)
    }

    const handleJumpToPost = () => {
      emit('jumpToPost', props.post.post_number)
    }

    const handleToggleParent = () => {
      emit('toggleParent', props.post)
    }

    const handleContentNavigation = (url: string) => {
      emit('navigate', url)
    }

    return () => (
      <div class="post-parent-preview">
        {hasParent.value && isExpanded.value && (
          <div class="post-parent-preview-nested">
            {isLoading.value ? (
              <div class="text-xs text-gray-500">上文加载中...</div>
            ) : parentPost.value && parentParsed.value ? (
              <PostParentPreview
                post={parentPost.value}
                parsed={parentParsed.value}
                baseUrl={props.baseUrl}
                getParentPost={props.getParentPost}
                getParentParsed={props.getParentParsed}
                isParentExpanded={props.isParentExpanded}
                isParentLoading={props.isParentLoading}
                onOpenUser={handleUserClick}
                onJumpToPost={(pn: number) => emit('jumpToPost', pn)}
                onNavigate={handleContentNavigation}
                onToggleParent={(p: DiscoursePost) => emit('toggleParent', p)}
              />
            ) : (
              <div class="text-xs text-gray-500">上文不可用</div>
            )}
          </div>
        )}

        <div class="post-parent-header">
          <img
            src={getAvatarUrl(props.post.avatar_template, props.baseUrl, 32)}
            alt={props.post.username}
            class="post-parent-avatar"
            onClick={() => handleUserClick(props.post.username)}
          />
          <div class="post-parent-title">
            <span class="post-parent-name" onClick={() => handleUserClick(props.post.username)}>
              {props.post.name || props.post.username}
            </span>
            <span class="post-parent-time">{formatTime(props.post.created_at)}</span>
          </div>
          <div class="post-parent-actions">
            {hasParent.value && (
              <button class="post-parent-toggle" onClick={handleToggleParent}>
                {isExpanded.value ? '收起上文' : '展开上文'}
              </button>
            )}
            <button class="post-parent-jump" onClick={handleJumpToPost}>
              跳到帖子
            </button>
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
      </div>
    )
  }
})

export default PostParentPreview
