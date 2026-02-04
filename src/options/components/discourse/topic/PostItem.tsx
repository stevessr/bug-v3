import { defineComponent, ref, computed } from 'vue'
import { Dropdown, Menu, MenuItem, message } from 'ant-design-vue'

import { REACTIONS } from '../../../utils/linuxDoReaction'
import type { DiscoursePost, ParsedContent, DiscourseUserProfile } from '../types'
import { formatTime, getAvatarUrl } from '../utils'

import PostContent from './PostContent'
import '../css/PostItem.css'

export default defineComponent({
  name: 'PostItem',
  props: {
    post: { type: Object as () => DiscoursePost, required: true },
    baseUrl: { type: String, required: true },
    topicId: { type: Number, required: true },
    parsed: { type: Object as () => ParsedContent, required: true },
    isParentExpanded: { type: Boolean, required: true },
    currentUsername: { type: String, default: null },
    isArchiving: { type: Boolean, default: false },
    isPostLiked: {
      type: Function as unknown as () => (post: DiscoursePost, reactionId: string) => boolean,
      required: true
    },
    getReactionCount: {
      type: Function as unknown as () => (post: DiscoursePost, reactionId: string) => number,
      required: true
    },
    isLiking: { type: Boolean, required: true },
    currentUser: { type: Object as () => DiscourseUserProfile | null, default: null }
  },
  emits: [
    'openUser',
    'replyTo',
    'toggleReplies',
    'toggleParent',
    'toggleLike',
    'navigate',
    'bookmark',
    'flag',
    'assign',
    'edit',
    'delete',
    'wiki',
    'archiveTopic'
  ],
  setup(props, { emit }) {
    const isCopyLinkClicked = ref(false)

    const isOwnPost = computed(() => {
      if (props.currentUser && props.post.user_id === props.currentUser.id) return true
      if (props.currentUsername && props.post.username) {
        return props.currentUsername.toLowerCase() === props.post.username.toLowerCase()
      }
      return false
    })

    const wikiTitle = computed(() => {
      if (props.post.wiki) return '移除 Wiki'
      return isOwnPost.value ? '设置为 Wiki' : 'Wiki'
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

    const handleArchiveTopic = () => {
      emit('archiveTopic', props.post)
    }

    return () => (
      <div
        data-post-number={props.post.post_number}
        class="post-item p-4 rounded-lg border dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
      >
        <div class="post-header mb-3">
          <img
            src={getAvatarUrl(props.post.avatar_template, props.baseUrl)}
            alt={props.post.username}
            class="w-10 h-10 rounded-full cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
            title={`查看 ${props.post.username} 的主页`}
            onClick={() => handleUserClick(props.post.username)}
          />
          <div class="post-header-main">
            <div
              class="font-medium dark:text-white cursor-pointer hover:text-blue-500"
              onClick={() => handleUserClick(props.post.username)}
            >
              {props.post.name || props.post.username}
            </div>
            <div class="text-xs text-gray-500">
              <span
                class="cursor-pointer hover:text-blue-500"
                onClick={() => handleUserClick(props.post.username)}
              >
                @{props.post.username}
              </span>
              <span>
                {' '}
                · #{props.post.post_number} · {formatTime(props.post.created_at)}
              </span>
            </div>
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
          {props.post.reply_to_post_number && (
            <div class="post-parent-inline-actions">
              <button class="post-parent-toggle" onClick={handleToggleParent}>
                {props.isParentExpanded ? '收起上文' : '展开上文'}
              </button>
            </div>
          )}
        </div>

        <PostContent
          segments={props.parsed.segments}
          baseUrl={props.baseUrl}
          postId={props.post.id}
          polls={props.post.polls}
          footnotes={props.parsed.footnotes}
          onNavigate={handleContentNavigation}
        />

        <div class="post-actions mt-3 text-xs text-gray-500">
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              {!isOwnPost.value && (
                <div class="reactions-list">
                  {REACTIONS.map(item => (
                    <button
                      key={item.id}
                      class={[
                        'reaction-item',
                        props.isPostLiked(props.post, item.id) ? 'active' : ''
                      ]}
                      disabled={props.isLiking}
                      onClick={() => handleToggleLike(item.id)}
                      title={item.name}
                    >
                      {item.emoji.startsWith('http') ? (
                        <span class="emoji emoji-image">
                          <img src={item.emoji} alt={item.name} loading="lazy" />
                        </span>
                      ) : (
                        <span class="emoji">{item.emoji}</span>
                      )}
                      <span class="count">{props.getReactionCount(props.post, item.id)}</span>
                    </button>
                  ))}
                </div>
              )}
              <div class="post-action-right actions flex items-center gap-2">
                <button
                  class={[
                    'btn no-text btn-icon post-action-menu__copy-link btn-flat',
                    isCopyLinkClicked.value ? 'copy-link-clicked' : ''
                  ]}
                  title="将此帖子的链接复制到剪贴板"
                  type="button"
                  onClick={handleCopyLink}
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
                  class="btn no-text btn-icon post-action-menu__archive btn-flat"
                  title="生成主题存档"
                  type="button"
                  disabled={props.isArchiving}
                  onClick={handleArchiveTopic}
                >
                  <svg
                    class="fa d-icon d-icon-box-archive svg-icon fa-width-auto svg-string"
                    width="1em"
                    height="1em"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <use href="#box-archive"></use>
                  </svg>
                </button>
                <div class="double-button">
                  <button
                    class="btn no-text btn-icon post-action-menu__flag create-flag btn-flat"
                    title="以私密方式举报此帖子以引起注意，或发送一个关于它的个人消息"
                    type="button"
                    onClick={handleFlag}
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
                </div>
                {isOwnPost.value && props.post.can_edit && (
                  <button
                    class="btn no-text btn-icon post-action-menu__edit edit btn-flat"
                    title="编辑此帖子"
                    type="button"
                    onClick={handleEdit}
                  >
                    <svg
                      class="fa d-icon d-icon-pencil svg-icon fa-width-auto svg-string"
                      width="1em"
                      height="1em"
                      aria-hidden="true"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <use href="#pencil"></use>
                    </svg>
                  </button>
                )}
                <Dropdown
                  trigger={['click']}
                  placement="bottomRight"
                  overlayClassName="post-admin-dropdown"
                  v-slots={{
                    overlay: () => (
                      <Menu>
                        <MenuItem onClick={handleBookmark}>
                          {props.post.bookmarked ? '移除书签' : '加入书签'}
                        </MenuItem>
                        {isOwnPost.value && props.post.can_delete && (
                          <MenuItem onClick={handleDelete}>删除</MenuItem>
                        )}
                        {canAssign.value && <MenuItem onClick={handleAssign}>指定</MenuItem>}
                        {props.post.can_wiki && (
                          <MenuItem onClick={handleWiki}>{wikiTitle.value}</MenuItem>
                        )}
                      </Menu>
                    )
                  }}
                >
                  <button
                    class={[
                      'btn no-text btn-icon post-action-menu__admin show-post-admin-menu btn-flat',
                      props.post.wiki ? 'wiki' : ''
                    ]}
                    title="帖子管理员操作"
                    type="button"
                  >
                    <svg
                      class="fa d-icon d-icon-wrench svg-icon fa-width-auto svg-string"
                      width="1em"
                      height="1em"
                      aria-hidden="true"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <use href="#wrench"></use>
                    </svg>
                  </button>
                </Dropdown>
                <button
                  class="btn btn-icon-text post-action-menu__reply reply create fade-out btn-flat"
                  title="开始撰写对此帖子的回复"
                  aria-label={`回复 @${props.post.username} 发布的帖子 #${props.post.post_number}`}
                  type="button"
                  onClick={handleReplyClick}
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
              {props.post.reply_count > 0 && (
                <button class="post-action-btn post-replies-toggle" onClick={handleToggleReplies}>
                  {props.post.reply_count} 回复
                </button>
              )}
              {props.post.like_count > 0 && <span>{props.post.like_count} 赞</span>}
            </div>
          </div>
        </div>
      </div>
    )
  }
})
