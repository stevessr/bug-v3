import { defineComponent, resolveComponent } from 'vue'

import type { DiscoursePost, ParsedContent } from '../types'

import PostReplyItem from './PostReplyItem'

const PostRepliesTree = defineComponent({
  name: 'PostRepliesTree',
  props: {
    posts: { type: Array as () => DiscoursePost[], required: true },
    baseUrl: { type: String, required: true },
    getParsed: {
      type: Function as unknown as () => (post: DiscoursePost) => ParsedContent,
      required: true
    },
    getReplies: {
      type: Function as unknown as () => (postNumber: number) => DiscoursePost[],
      required: true
    },
    isExpanded: {
      type: Function as unknown as () => (postNumber: number) => boolean,
      required: true
    }
  },
  emits: ['openUser', 'toggleReplies', 'navigate'],
  setup(props, { emit }) {
    const handleOpenUser = (username: string) => {
      emit('openUser', username)
    }

    const handleToggleReplies = (post: DiscoursePost) => {
      emit('toggleReplies', post)
    }

    const handleContentNavigation = (url: string) => {
      emit('navigate', url)
    }

    return () => (
      <>
        {props.posts.map(post => (
          <div key={post.id}>
            <PostReplyItem
              post={post}
              baseUrl={props.baseUrl}
              parsed={props.getParsed(post)}
              onOpenUser={handleOpenUser}
              onToggleReplies={handleToggleReplies}
              onNavigate={handleContentNavigation}
            />
            {props.isExpanded(post.post_number) && (
              <div class="pl-6 mt-3 space-y-3">
                <PostRepliesTree
                  posts={props.getReplies(post.post_number)}
                  baseUrl={props.baseUrl}
                  getParsed={props.getParsed}
                  getReplies={props.getReplies}
                  isExpanded={props.isExpanded}
                  onOpenUser={handleOpenUser}
                  onToggleReplies={handleToggleReplies}
                  onNavigate={handleContentNavigation}
                />
              </div>
            )}
          </div>
        ))}
      </>
    )
  }
})

export default PostRepliesTree
