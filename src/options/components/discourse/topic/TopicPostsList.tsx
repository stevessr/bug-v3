import { defineComponent, type PropType } from 'vue'

import type { DiscoursePost, ParsedContent, DiscourseUserProfile } from '../types'

import PostItem from './PostItem'
import PostParentPreview from './PostParentPreview'
import PostRepliesTree from './PostRepliesTree'

export default defineComponent({
  name: 'TopicPostsList',
  props: {
    posts: { type: Array as () => DiscoursePost[], required: true },
    baseUrl: { type: String, required: true },
    topicId: { type: Number, required: true },
    currentUser: { type: Object as () => DiscourseUserProfile | null, default: null },
    currentUsername: { type: String, default: undefined },
    highlightedPostNumber: { type: Number as () => number | null, default: null },
    getParsedPost: {
      type: Function as PropType<(postId: number) => ParsedContent>,
      required: true
    },
    getParsedPostByItem: {
      type: Function as PropType<(post: DiscoursePost) => ParsedContent>,
      required: true
    },
    isParentExpanded: {
      type: Function as PropType<(postNumber: number) => boolean>,
      required: true
    },
    isParentLoading: {
      type: Function as PropType<(postNumber: number) => boolean>,
      required: true
    },
    getParentPost: {
      type: Function as PropType<(post: DiscoursePost) => DiscoursePost | null>,
      required: true
    },
    getParsedParent: {
      type: Function as PropType<(post: DiscoursePost) => ParsedContent | null>,
      required: true
    },
    isRepliesExpanded: {
      type: Function as PropType<(postNumber: number) => boolean>,
      required: true
    },
    getRepliesForPost: {
      type: Function as PropType<(postNumber: number) => DiscoursePost[]>,
      required: true
    },
    getParsedReply: {
      type: Function as PropType<(post: DiscoursePost) => ParsedContent>,
      required: true
    },
    isPostLiked: {
      type: Function as PropType<(post: DiscoursePost, reactionId: string) => boolean>,
      required: true
    },
    getReactionCount: {
      type: Function as PropType<(post: DiscoursePost, reactionId: string) => number>,
      required: true
    },
    isLiking: { type: Function as PropType<(postId: number) => boolean>, required: true },
    onOpenUser: { type: Function as PropType<(username: string) => void>, required: true },
    onReplyTo: {
      type: Function as PropType<(payload: { postNumber: number; username: string }) => void>,
      required: true
    },
    onToggleLike: { type: Function as PropType<(post: DiscoursePost) => void>, required: true },
    onToggleReplies: { type: Function as PropType<(post: DiscoursePost) => void>, required: true },
    onToggleParent: { type: Function as PropType<(post: DiscoursePost) => void>, required: true },
    onNavigate: { type: Function as PropType<(url: string) => void>, required: true },
    onJumpToPost: { type: Function as PropType<(postNumber: number) => void>, required: true },
    onBookmark: { type: Function as PropType<(post: DiscoursePost) => void>, required: true },
    onFlag: { type: Function as PropType<(post: DiscoursePost) => void>, required: true },
    onAssign: { type: Function as PropType<(post: DiscoursePost) => void>, required: true },
    onEdit: { type: Function as PropType<(post: DiscoursePost) => void>, required: true },
    onDelete: { type: Function as PropType<(post: DiscoursePost) => void>, required: true },
    onWiki: { type: Function as PropType<(post: DiscoursePost) => void>, required: true },
    onArchiveTopic: { type: Function as PropType<() => void>, required: true },
    isArchiving: { type: Boolean, required: true }
  },
  setup(props) {
    const handlePostLike = (post: DiscoursePost, reactionId: string) => {
      return props.isPostLiked(post, reactionId)
    }

    return () => (
      <div class="posts-list space-y-4">
        {props.posts.map(post => (
          <div key={post.id}>
            {post.reply_to_post_number && props.isParentExpanded(post.post_number) && (
              <div class="post-parent-outer">
                {props.isParentLoading(post.post_number) ? (
                  <div class="text-xs text-gray-500">上文加载中...</div>
                ) : props.getParentPost(post) && props.getParsedParent(post) ? (
                  <PostParentPreview
                    post={props.getParentPost(post)!}
                    parsed={props.getParsedPostByItem(props.getParentPost(post)!)}
                    baseUrl={props.baseUrl}
                    getParentPost={props.getParentPost}
                    getParentParsed={props.getParsedParent}
                    isParentExpanded={(postItem: DiscoursePost) =>
                      props.isParentExpanded(postItem.post_number)
                    }
                    isParentLoading={(postItem: DiscoursePost) =>
                      props.isParentLoading(postItem.post_number)
                    }
                    onOpenUser={props.onOpenUser}
                    onJumpToPost={props.onJumpToPost}
                    onNavigate={props.onNavigate}
                    onToggleParent={props.onToggleParent}
                  />
                ) : (
                  <div class="text-xs text-gray-500">上文不可用</div>
                )}
              </div>
            )}
            <PostItem
              post={post}
              baseUrl={props.baseUrl}
              topicId={props.topicId}
              parsed={props.getParsedPost(post.id)}
              isParentExpanded={props.isParentExpanded(post.post_number)}
              isHighlighted={props.highlightedPostNumber === post.post_number}
              isPostLiked={handlePostLike}
              getReactionCount={props.getReactionCount}
              isLiking={props.isLiking(post.id)}
              currentUser={props.currentUser}
              currentUsername={props.currentUsername}
              onOpenUser={props.onOpenUser}
              onReplyTo={props.onReplyTo}
              onToggleLike={props.onToggleLike}
              onToggleReplies={props.onToggleReplies}
              onToggleParent={props.onToggleParent}
              onNavigate={props.onNavigate}
              onBookmark={props.onBookmark}
              onFlag={props.onFlag}
              onAssign={props.onAssign}
              onEdit={props.onEdit}
              onDelete={props.onDelete}
              onWiki={props.onWiki}
              onArchiveTopic={props.onArchiveTopic}
              isArchiving={props.isArchiving}
            />
            {props.isRepliesExpanded(post.post_number) && (
              <div class="pl-6 mt-3 space-y-3">
                <PostRepliesTree
                  posts={props.getRepliesForPost(post.post_number)}
                  baseUrl={props.baseUrl}
                  getParsed={props.getParsedReply}
                  getReplies={props.getRepliesForPost}
                  isExpanded={props.isRepliesExpanded}
                  onOpenUser={props.onOpenUser}
                  onToggleReplies={props.onToggleReplies}
                  onNavigate={props.onNavigate}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }
})
