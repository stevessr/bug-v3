import { defineComponent } from 'vue'

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
    currentUsername: { type: String, default: null },
    highlightedPostNumber: { type: Number as () => number | null, default: null },
    getParsedPost: { type: Function as () => (postId: number) => ParsedContent, required: true },
    isParentExpanded: { type: Function as () => (postNumber: number) => boolean, required: true },
    isParentLoading: { type: Function as () => (postNumber: number) => boolean, required: true },
    getParentPost: {
      type: Function as () => (post: DiscoursePost) => DiscoursePost | null,
      required: true
    },
    getParsedParent: {
      type: Function as () => (post: DiscoursePost) => ParsedContent | null,
      required: true
    },
    isRepliesExpanded: { type: Function as () => (postNumber: number) => boolean, required: true },
    getRepliesForPost: {
      type: Function as () => (postNumber: number) => DiscoursePost[],
      required: true
    },
    getParsedReply: {
      type: Function as () => (postId: number) => ParsedContent,
      required: true
    },
    isPostLiked: { type: Function as () => (post: DiscoursePost) => boolean, required: true },
    getReactionCount: {
      type: Function as () => (post: DiscoursePost, reactionId: string) => number,
      required: true
    },
    isLiking: { type: Function as () => (postId: number) => boolean, required: true },
    onOpenUser: { type: Function as () => (username: string) => void, required: true },
    onReplyTo: {
      type: Function as () => (payload: { postNumber: number; username: string }) => void,
      required: true
    },
    onToggleLike: { type: Function as () => (post: DiscoursePost) => void, required: true },
    onToggleReplies: { type: Function as () => (post: DiscoursePost) => void, required: true },
    onToggleParent: { type: Function as () => (post: DiscoursePost) => void, required: true },
    onNavigate: { type: Function as () => (url: string) => void, required: true },
    onJumpToPost: { type: Function as () => (postNumber: number) => void, required: true },
    onBookmark: { type: Function as () => (post: DiscoursePost) => void, required: true },
    onFlag: { type: Function as () => (post: DiscoursePost) => void, required: true },
    onAssign: { type: Function as () => (post: DiscoursePost) => void, required: true },
    onEdit: { type: Function as () => (post: DiscoursePost) => void, required: true },
    onDelete: { type: Function as () => (post: DiscoursePost) => void, required: true },
    onWiki: { type: Function as () => (post: DiscoursePost) => void, required: true },
    onArchiveTopic: { type: Function as () => () => void, required: true },
    isArchiving: { type: Boolean, required: true }
  },
  setup(props) {
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
                    parsed={props.getParsedParent(post)!}
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
              isPostLiked={props.isPostLiked}
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
