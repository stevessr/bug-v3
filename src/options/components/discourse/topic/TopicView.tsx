import {
  defineComponent,
  computed,
  ref,
  onMounted,
  onUnmounted,
  watch,
  shallowRef,
  nextTick
} from 'vue'
import { message, Spin, Modal } from 'ant-design-vue'
import hljs from 'highlight.js'
import '../css/highlight.css'

import type {
  DiscourseTopicDetail,
  DiscoursePost,
  ParsedContent,
  SuggestedTopic,
  DiscourseUserProfile
} from '../types'
import { parsePostContent, pageFetch, extractData } from '../utils'
import {
  togglePostLike,
  toggleBookmark,
  flagPost,
  assignPost,
  deletePost,
  toggleWiki,
  setTopicNotificationLevel,
  fetchAiTopicSummary,
  requestAiTopicSummaryRegenerate
} from '../actions'

import TopicHeader from './TopicHeader'
import PostItem from './PostItem'
import PostParentPreview from './PostParentPreview'
import PostRepliesTree from './PostRepliesTree'
import TopicExtras from './TopicExtras'
import TopicFooter from './TopicFooter'
import TopicTimeline from './TopicTimeline'
import '../css/TopicView.css'

export default defineComponent({
  name: 'TopicView',
  props: {
    topic: { type: Object as () => DiscourseTopicDetail, required: true },
    baseUrl: { type: String, required: true },
    isLoadingMore: { type: Boolean, required: true },
    hasMorePosts: { type: Boolean, required: true },
    targetPostNumber: { type: Number as () => number | null, default: null },
    currentUser: { type: Object as () => DiscourseUserProfile | null, default: null },
    currentUsername: { type: String, default: null }
  },
  emits: [
    'openSuggestedTopic',
    'openUser',
    'refresh',
    'replyTo',
    'openQuote',
    'navigate',
    'editPost'
  ],
  setup(props, { emit }) {
    const postsListRef = ref<HTMLElement | null>(null)
    const likedPostIds = ref<Set<number>>(new Set())
    const likingPostIds = ref<Set<number>>(new Set())
    const expandedReplies = shallowRef<Set<number>>(new Set())
    const replyMap = shallowRef<Map<number, DiscoursePost[]>>(new Map())
    const replyParsedCache = new Map<number, ParsedContent>()
    const expandedParents = shallowRef<Set<number>>(new Set())
    const parentPostCache = shallowRef<Map<number, DiscoursePost>>(new Map())
    const parentParsedCache = new Map<number, ParsedContent>()
    const parentLoading = shallowRef<Set<number>>(new Set())
    const timelinePostNumber = ref(1)
    const timelineTicking = ref(false)
    const aiSummary = ref<string | null>(null)
    const aiMeta = ref<{
      algorithm?: string
      updatedAt?: string
      outdated?: boolean
      canRegenerate?: boolean
      newPosts?: number
    } | null>(null)
    const aiLoading = ref(false)
    const aiAvailable = ref(true)
    const aiErrorMessage = ref('')
    const showAiSummaryModal = ref(false)
    const isArchiving = ref(false)

    // Parse posts and cache results
    const parsedPosts = computed(() => {
      if (!props.topic?.post_stream?.posts) return new Map<number, ParsedContent>()

      const map = new Map<number, ParsedContent>()
      for (const post of props.topic.post_stream.posts) {
        map.set(post.id, parsePostContent(post.cooked, props.baseUrl))
      }
      return map
    })

    const getParsedPost = (postId: number): ParsedContent => {
      return parsedPosts.value.get(postId) || { html: '', images: [], segments: [] }
    }

    const getParsedReply = (post: DiscoursePost): ParsedContent => {
      const cached = replyParsedCache.get(post.id)
      if (cached) return cached
      const parsed = parsePostContent(post.cooked, props.baseUrl)
      replyParsedCache.set(post.id, parsed)
      return parsed
    }

    const getParentPostByNumber = (postNumber: number): DiscoursePost | null => {
      const local = props.topic.post_stream?.posts?.find(post => post.post_number === postNumber)
      if (local) return local
      return parentPostCache.value.get(postNumber) || null
    }

    const getParentPost = (post: DiscoursePost): DiscoursePost | null => {
      if (!post.reply_to_post_number) return null
      return getParentPostByNumber(post.reply_to_post_number)
    }

    const getParsedParent = (post: DiscoursePost): ParsedContent | null => {
      const parent = getParentPost(post)
      if (!parent) return null
      const parsedFromMain = parsedPosts.value.get(parent.id)
      if (parsedFromMain) return parsedFromMain
      const cached = parentParsedCache.get(parent.id)
      if (cached) return cached
      const parsed = parsePostContent(parent.cooked, props.baseUrl)
      parentParsedCache.set(parent.id, parsed)
      return parsed
    }

    const getRepliesForPost = (postNumber: number): DiscoursePost[] => {
      return replyMap.value.get(postNumber) || []
    }

    const isRepliesExpanded = (postNumber: number) => {
      return expandedReplies.value.has(postNumber)
    }

    const isParentExpanded = (postNumber: number) => {
      return expandedParents.value.has(postNumber)
    }

    const isParentLoading = (postNumber: number) => {
      return parentLoading.value.has(postNumber)
    }

    const fetchParentForPost = async (post: DiscoursePost) => {
      if (!props.topic?.id) return
      if (!post.reply_to_post_number) return

      const parentNumber = post.reply_to_post_number
      if (getParentPostByNumber(parentNumber)) return

      parentLoading.value = new Set(parentLoading.value)
      parentLoading.value.add(post.post_number)

      try {
        const result = await pageFetch<any>(
          `${props.baseUrl}/posts/by_number/${props.topic.id}/${parentNumber}.json`
        )
        if (result.status === 404) return
        const data = extractData(result)
        if (data?.id) {
          parentPostCache.value = new Map(parentPostCache.value)
          parentPostCache.value.set(parentNumber, data as DiscoursePost)
        }
      } catch (error) {
        console.warn('[DiscourseBrowser] fetch parent failed:', error)
      } finally {
        parentLoading.value = new Set(parentLoading.value)
        parentLoading.value.delete(post.post_number)
      }
    }

    const fetchRepliesForPost = async (post: DiscoursePost) => {
      if (!props.topic?.id) return
      const postNumber = post.post_number
      const localReplies =
        props.topic.post_stream?.posts?.filter(p => p.reply_to_post_number === postNumber) || []

      const replies = [...localReplies]

      if (post.reply_count && replies.length < post.reply_count) {
        try {
          const result = await pageFetch<any>(
            `${props.baseUrl}/t/${props.topic.id}/${postNumber}.json`
          )
          const data = extractData(result)
          const fetched = (data?.post_stream?.posts || []).filter(
            (p: DiscoursePost) => p.reply_to_post_number === postNumber
          )
          const seen = new Set(replies.map(p => p.id))
          fetched.forEach((p: DiscoursePost) => {
            if (!seen.has(p.id)) {
              replies.push(p)
              seen.add(p.id)
            }
          })
        } catch (error) {
          console.warn('[DiscourseBrowser] fetch replies failed:', error)
        }
      }

      replyMap.value = new Map(replyMap.value)
      replyMap.value.set(postNumber, replies)
    }

    const handleToggleReplies = async (post: DiscoursePost) => {
      const postNumber = post.post_number
      const next = new Set(expandedReplies.value)
      if (next.has(postNumber)) {
        next.delete(postNumber)
        expandedReplies.value = next
        return
      }
      next.add(postNumber)
      expandedReplies.value = next
      if (!replyMap.value.has(postNumber)) {
        await fetchRepliesForPost(post)
      }
    }

    const handleToggleParent = async (post: DiscoursePost) => {
      const postNumber = post.post_number
      const next = new Set(expandedParents.value)
      if (next.has(postNumber)) {
        next.delete(postNumber)
        expandedParents.value = next
        return
      }
      next.add(postNumber)
      expandedParents.value = next
      if (!getParentPost(post)) {
        await fetchParentForPost(post)
      }
    }

    const handleSuggestedClick = (topic: SuggestedTopic) => {
      emit('openSuggestedTopic', topic)
    }

    const handleUserClick = (username: string) => {
      emit('openUser', username)
    }

    const handleReplyClick = (payload: { postNumber: number; username: string }) => {
      emit('replyTo', payload)
    }

    const handleContentNavigation = (url: string) => {
      emit('navigate', url)
    }

    const isPostLiked = (post: DiscoursePost, reactionId: string) => {
      if (likedPostIds.value.has(post.id)) return true
      const postAny = post as any
      const currentUserReaction = postAny?.current_user_reaction
      if (currentUserReaction) {
        if (typeof currentUserReaction === 'string') {
          return currentUserReaction === reactionId
        } else if (typeof currentUserReaction === 'object' && currentUserReaction.id) {
          return currentUserReaction.id === reactionId
        }
      }
      const summary = postAny?.actions_summary || []
      if (Array.isArray(summary)) {
        if (reactionId === 'heart' && summary.some((item: any) => item?.id === 2 && item?.acted))
          return true
      }
      const reactions = postAny?.reactions
      if (Array.isArray(reactions)) {
        const item = reactions.find((r: any) => r?.id === reactionId)
        if (item?.reacted) return true
      } else if (reactions && typeof reactions === 'object') {
        const items = Object.values(reactions) as any[]
        if (items.some(item => item?.id === reactionId && item?.reacted)) return true
      }
      return false
    }

    const getReactionCount = (post: DiscoursePost, reactionId: string): number => {
      const postAny = post as any
      const reactions = postAny?.reactions
      if (Array.isArray(reactions)) {
        const item = reactions.find((r: any) => r?.id === reactionId)
        if (item && typeof item.count === 'number') {
          return item.count
        }
      } else if (reactions && typeof reactions === 'object') {
        const item = reactions[reactionId]
        if (item && typeof item === 'object' && typeof item.count === 'number') {
          return item.count
        }
      }
      return 0
    }

    const toggleLike = async (post: DiscoursePost, reactionId: string) => {
      if (likingPostIds.value.has(post.id)) return
      likingPostIds.value.add(post.id)
      try {
        const data = await togglePostLike(props.baseUrl, post.id, reactionId)
        const postAny = post as any
        if (data) {
          postAny.reactions = data.reactions || []
          postAny.current_user_reaction = data.current_user_reaction
          postAny.reaction_users_count = data.reaction_users_count || 0
        }
        if (data?.current_user_reaction) {
          likedPostIds.value.add(post.id)
        } else {
          likedPostIds.value.delete(post.id)
        }
      } catch (error) {
        console.warn('[DiscourseBrowser] toggle like failed:', error)
      } finally {
        likingPostIds.value.delete(post.id)
      }
    }

    const handleBookmark = async (post: DiscoursePost) => {
      try {
        const postAny = post as any
        const currentBookmarked = postAny.bookmarked || false
        const bookmarkId = postAny.bookmark_id || postAny.bookmarkId || null
        await toggleBookmark(props.baseUrl, {
          postId: post.id,
          bookmarked: !currentBookmarked,
          bookmark_id: bookmarkId
        })
        postAny.bookmarked = !currentBookmarked
        message.success(postAny.bookmarked ? '已添加书签' : '已删除书签')
      } catch (error) {
        console.warn('[DiscourseBrowser] bookmark failed:', error)
        message.error('书签操作失败')
      }
    }

    const handleFlag = async (post: DiscoursePost) => {
      try {
        await flagPost(props.baseUrl, {
          postId: post.id,
          flagType: '6', // Post action type ID 6: inappropriate content
          message: ''
        })
        message.success('举报成功')
      } catch (error) {
        console.warn('[DiscourseBrowser] flag failed:', error)
        message.error('举报失败')
      }
    }

    const handleAssign = async (_post: DiscoursePost) => {
      void _post
      message.info('指定功能需要选择用户，请在 Web 界面中使用')
    }

    const handleEdit = (post: DiscoursePost) => {
      emit('editPost', post)
    }

    const handleDelete = async (post: DiscoursePost) => {
      try {
        await deletePost(props.baseUrl, post.id)
        const postAny = post as any
        postAny.hidden = true
        message.success('删除成功')
        emit('refresh')
      } catch (error) {
        console.warn('[DiscourseBrowser] delete failed:', error)
        message.error('删除失败')
      }
    }

    const handleWiki = async (post: DiscoursePost) => {
      try {
        const postAny = post as any
        const currentWiki = postAny.wiki || false
        await toggleWiki(props.baseUrl, post.id, !currentWiki)
        const postResult = await pageFetch<any>(`${props.baseUrl}/posts/${post.id}.json`)
        const postData = extractData(postResult)
        if (postData && typeof postData === 'object') {
          Object.assign(postAny, postData)
        } else {
          postAny.wiki = !currentWiki
        }
        message.success(postAny.wiki ? '已启用 Wiki' : '已禁用 Wiki')
      } catch (error) {
        console.warn('[DiscourseBrowser] wiki failed:', error)
        message.error('Wiki 操作失败')
      }
    }

    const extractTextFromHtml = (html: string): string => {
      if (!html) return ''
      const wrapper = document.createElement('div')
      wrapper.innerHTML = html
      const text = wrapper.innerText || wrapper.textContent || ''
      return text.replace(/\n{3,}/g, '\n\n').trim()
    }

    const loadImageFromUrl = async (url: string): Promise<HTMLImageElement | null> => {
      try {
        const result = await pageFetch<Blob>(
          url,
          { headers: { 'X-Requested-With': 'XMLHttpRequest' } },
          'blob'
        )
        if (!result.ok || !result.data) return null
        const objectUrl = URL.createObjectURL(result.data)
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve(image)
          image.onerror = () => reject(new Error('图片加载失败'))
          image.src = objectUrl
        })
        URL.revokeObjectURL(objectUrl)
        return img
      } catch {
        return null
      }
    }

    const archiveTopicAsWebp = async () => {
      if (isArchiving.value) return
      const posts = props.topic?.post_stream?.posts || []
      if (!posts.length) {
        message.error('暂无帖子可导出')
        return
      }

      const hide = message.loading('正在生成主题存档...', 0)
      isArchiving.value = true

      try {
        const canvasWidth = 1200
        const padding = 40
        const contentWidth = canvasWidth - padding * 2
        const blocks: Array<
          | { type: 'text'; lines: string[]; font: string; lineHeight: number; color: string }
          | { type: 'image'; img: HTMLImageElement; width: number; height: number }
        > = []

        const pushTextBlock = (text: string, font: string, lineHeight: number, color: string) => {
          if (!text) return
          const lines: string[] = []
          const ctx = document.createElement('canvas').getContext('2d')
          if (!ctx) return
          ctx.font = font
          const paragraphs = text.split('\n')
          for (const paragraph of paragraphs) {
            const words = paragraph.split(/\s+/)
            let line = ''
            for (const word of words) {
              const testLine = line ? `${line} ${word}` : word
              const { width } = ctx.measureText(testLine)
              if (width > contentWidth && line) {
                lines.push(line)
                line = word
              } else {
                line = testLine
              }
            }
            if (line) lines.push(line)
            lines.push('')
          }
          while (lines.length && lines[lines.length - 1] === '') lines.pop()
          if (lines.length) {
            blocks.push({ type: 'text', lines, font, lineHeight, color })
          }
        }

        pushTextBlock(props.topic.title || '未命名主题', 'bold 28px sans-serif', 36, '#111')

        for (const post of posts) {
          const header = `${post.username} · #${post.post_number} · ${new Date(
            post.created_at
          ).toLocaleString('zh-CN')}`
          pushTextBlock(header, 'bold 16px sans-serif', 24, '#333')

          const parsed = getParsedPost(post.id)
          for (const segment of parsed.segments) {
            if (segment.type === 'html') {
              pushTextBlock(
                extractTextFromHtml(segment.html),
                '14px sans-serif',
                22,
                '#222'
              )
            } else if (segment.type === 'lightbox') {
              const imageUrl =
                segment.image.downloadHref ||
                segment.image.href ||
                segment.image.thumbSrc ||
                ''
              if (!imageUrl) continue
              const img = await loadImageFromUrl(imageUrl)
              if (!img) continue
              const scale = Math.min(1, contentWidth / img.width)
              blocks.push({
                type: 'image',
                img,
                width: img.width * scale,
                height: img.height * scale
              })
            } else if (segment.type === 'carousel') {
              for (const image of segment.images) {
                const imageUrl = image.downloadHref || image.href || image.thumbSrc || ''
                if (!imageUrl) continue
                const img = await loadImageFromUrl(imageUrl)
                if (!img) continue
                const scale = Math.min(1, contentWidth / img.width)
                blocks.push({
                  type: 'image',
                  img,
                  width: img.width * scale,
                  height: img.height * scale
                })
              }
            } else if (segment.type === 'image-grid') {
              for (const column of segment.columns) {
                for (const image of column) {
                  const imageUrl = image.downloadHref || image.href || image.thumbSrc || ''
                  if (!imageUrl) continue
                  const img = await loadImageFromUrl(imageUrl)
                  if (!img) continue
                  const scale = Math.min(1, contentWidth / img.width)
                  blocks.push({
                    type: 'image',
                    img,
                    width: img.width * scale,
                    height: img.height * scale
                  })
                }
              }
            }
          }
        }

        const spacing = 16
        let totalHeight = padding
        for (const block of blocks) {
          if (block.type === 'text') {
            totalHeight += block.lines.length * block.lineHeight + spacing
          } else {
            totalHeight += block.height + spacing
          }
        }
        totalHeight += padding

        const MAX_HEIGHT = 60000
        if (totalHeight > MAX_HEIGHT) {
          throw new Error('主题过长，导出失败（超出高度限制）')
        }

        const canvas = document.createElement('canvas')
        canvas.width = canvasWidth
        canvas.height = Math.max(1, Math.round(totalHeight))
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          throw new Error('无法创建画布')
        }

        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        let cursorY = padding
        for (const block of blocks) {
          if (block.type === 'text') {
            ctx.font = block.font
            ctx.fillStyle = block.color
            for (const line of block.lines) {
              if (line) {
                ctx.fillText(line, padding, cursorY)
              }
              cursorY += block.lineHeight
            }
            cursorY += spacing
          } else {
            ctx.drawImage(block.img, padding, cursorY, block.width, block.height)
            cursorY += block.height + spacing
          }
        }

        const blob = await new Promise<Blob | null>(resolve =>
          canvas.toBlob(resolve, 'image/webp', 0.92)
        )
        if (!blob) {
          throw new Error('生成图片失败')
        }

        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `topic-${props.topic.id}.webp`
        a.click()
        URL.revokeObjectURL(url)
        message.success('主题存档已下载')
      } catch (error: any) {
        console.warn('[DiscourseBrowser] archive failed:', error)
        message.error(error?.message || '生成存档失败')
      } finally {
        isArchiving.value = false
        hide()
      }
    }

    const firstPost = computed(() => {
      if (!props.topic?.post_stream?.posts) return null
      return (
        props.topic.post_stream.posts.find((item: DiscoursePost) => item.post_number === 1) ||
        props.topic.post_stream.posts[0] ||
        null
      )
    })

    const maxPostNumber = computed(() => {
      return (
        props.topic?.highest_post_number ||
        props.topic?.posts_count ||
        props.topic?.post_stream?.stream?.length ||
        props.topic?.post_stream?.posts?.length ||
        1
      )
    })

    const handleTopicReply = () => {
      if (!firstPost.value) return
      handleReplyClick({
        postNumber: firstPost.value.post_number,
        username: firstPost.value.username
      })
    }

    const handleTopicBookmark = async () => {
      if (!firstPost.value) return
      await handleBookmark(firstPost.value)
    }

    const handleTopicFlag = async () => {
      if (!firstPost.value) return
      await handleFlag(firstPost.value)
    }

    const handleTopicAssign = async () => {
      if (!firstPost.value) return
      const input = window.prompt('请输入要指定的用户名')
      if (!input) return
      const username = input.trim()
      if (!username) return
      try {
        const userResult = await pageFetch<any>(
          `${props.baseUrl}/u/${encodeURIComponent(username)}.json`
        )
        const userData = extractData(userResult)
        const assigneeId = userData?.user?.id
        if (!assigneeId) {
          message.error('未找到该用户')
          return
        }
        await assignPost(props.baseUrl, { postId: firstPost.value.id, assigneeId })
        message.success('指定成功')
      } catch (error) {
        console.warn('[DiscourseBrowser] assign failed:', error)
        message.error('指定失败')
      }
    }

    const handleChangeNotificationLevel = async (level: number) => {
      try {
        await setTopicNotificationLevel(props.baseUrl, props.topic.id, level)
        props.topic.notification_level = level
        message.success('通知等级已更新')
      } catch (error) {
        console.warn('[DiscourseBrowser] update notification level failed:', error)
        message.error('通知等级更新失败')
      }
    }

    const fetchAiSummaryData = async () => {
      const fetchOnce = async () => {
        return await fetchAiTopicSummary(props.baseUrl, props.topic.id)
      }
      let result = await fetchOnce()
      let summary = result.summary
      if (!summary?.summarized_text) {
        await new Promise(resolve => setTimeout(resolve, 1500))
        result = await fetchOnce()
        summary = result.summary
      }

      if (result.status === 404) {
        aiAvailable.value = false
        message.info('当前站点未启用 AI 总结')
        return
      }

      if (!summary?.summarized_text) {
        aiErrorMessage.value = 'AI 总结暂不可用，请稍后再试'
        message.warning(aiErrorMessage.value)
        return
      }

      aiSummary.value = summary.summarized_text
      aiMeta.value = {
        algorithm: summary.algorithm,
        updatedAt: summary.updated_at,
        outdated: summary.outdated,
        canRegenerate: summary.can_regenerate,
        newPosts: summary.new_posts_since_summary
      }
    }

    const handleAiSummary = async () => {
      if (aiLoading.value) return
      aiErrorMessage.value = ''
      showAiSummaryModal.value = true
      aiLoading.value = true
      try {
        await fetchAiSummaryData()
      } catch (error) {
        console.warn('[DiscourseBrowser] ai summary failed:', error)
        aiErrorMessage.value = 'AI 总结获取失败'
        message.error(aiErrorMessage.value)
      } finally {
        aiLoading.value = false
      }
    }

    const handleAiRegenerate = async () => {
      if (aiLoading.value) return
      aiErrorMessage.value = ''
      aiLoading.value = true
      try {
        const result = await requestAiTopicSummaryRegenerate(props.baseUrl, props.topic.id)
        if (result.status === 404) {
          aiAvailable.value = false
          message.info('当前站点未启用 AI 总结')
          return
        }
        await new Promise(resolve => setTimeout(resolve, 1500))
        await fetchAiSummaryData()
      } catch (error) {
        console.warn('[DiscourseBrowser] ai summary regenerate failed:', error)
        aiErrorMessage.value = 'AI 总结重新生成失败'
        message.error(aiErrorMessage.value)
      } finally {
        aiLoading.value = false
      }
    }

    const lastAutoScrollKey = ref<string | null>(null)

    const scrollElementIntoView = (
      el: HTMLElement,
      container: HTMLElement | null,
      behavior: ScrollBehavior = 'smooth'
    ) => {
      if (container) {
        const elRect = el.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()
        const targetTop =
          elRect.top - containerRect.top + container.scrollTop - containerRect.height / 2
        const nextTop = Math.max(0, targetTop)
        container.scrollTo({ top: nextTop, behavior })
        if (behavior !== 'auto') {
          container.scrollTop = nextTop
        }
      } else {
        el.scrollIntoView({ behavior, block: 'center' })
      }
    }

    const findNearestPostElement = (targetPost: number): HTMLElement | null => {
      const list = postsListRef.value
      if (!list) return null
      const nodes = Array.from(list.querySelectorAll<HTMLElement>('[data-post-number]'))
      if (!nodes.length) return null
      let above: { num: number; el: HTMLElement } | null = null
      let below: { num: number; el: HTMLElement } | null = null
      for (const node of nodes) {
        const raw = node.getAttribute('data-post-number')
        if (!raw) continue
        const num = Number.parseInt(raw, 10)
        if (!Number.isFinite(num)) continue
        if (num >= targetPost) {
          if (!above || num < above.num) {
            above = { num, el: node }
          }
        } else if (!below || num > below.num) {
          below = { num, el: node }
        }
      }
      return above?.el || below?.el || null
    }

    const scrollToPost = (postNumber: number, attempt = 0) => {
      if (!postNumber) return
      const topicId = props.topic?.id
      const key = topicId ? `${topicId}:${postNumber}` : null
      requestAnimationFrame(() => {
        const list = postsListRef.value
        if (!list) {
          if (attempt < 40) {
            setTimeout(() => scrollToPost(postNumber, attempt + 1), 200)
          }
          return
        }
        const container = list?.closest('.content-area') as HTMLElement | null
        if (container && container.clientHeight === 0) {
          if (attempt < 40) {
            setTimeout(() => scrollToPost(postNumber, attempt + 1), 200)
          }
          return
        }
        const el = list?.querySelector(`[data-post-number="${postNumber}"]`) as HTMLElement | null
        const behavior: ScrollBehavior = attempt === 0 ? 'auto' : 'smooth'
        if (el) {
          scrollElementIntoView(el, container, behavior)
          if (key) lastAutoScrollKey.value = key
          return
        }

        const fallback = attempt >= 6 ? findNearestPostElement(postNumber) : null
        if (fallback) {
          scrollElementIntoView(fallback, container, behavior)
          if (key) lastAutoScrollKey.value = key
          return
        }

        if (attempt < 40) {
          setTimeout(() => scrollToPost(postNumber, attempt + 1), 200)
        }
      })
    }

    const updateTimelineFromScroll = () => {
      const list = postsListRef.value
      if (!list || timelineTicking.value) return
      const container = list.closest('.content-area') as HTMLElement | null
      if (!container) return
      timelineTicking.value = true
      requestAnimationFrame(() => {
        const nodes = Array.from(list.querySelectorAll<HTMLElement>('[data-post-number]'))
        if (!nodes.length) {
          timelineTicking.value = false
          return
        }
        const containerTop = container.getBoundingClientRect().top
        let bestNum = timelinePostNumber.value
        let bestDelta = Number.POSITIVE_INFINITY
        nodes.forEach(node => {
          const raw = node.getAttribute('data-post-number')
          if (!raw) return
          const num = Number.parseInt(raw, 10)
          if (!Number.isFinite(num)) return
          const delta = Math.abs(node.getBoundingClientRect().top - containerTop - 24)
          if (delta < bestDelta) {
            bestDelta = delta
            bestNum = num
          }
        })
        timelinePostNumber.value = bestNum
        timelineTicking.value = false
      })
    }

    watch(
      () =>
        [props.targetPostNumber, props.topic?.id, props.topic?.post_stream?.posts?.length] as const,
      async ([value, topicId]) => {
        if (!value || !topicId) return
        const key = `${topicId}:${value}`
        if (lastAutoScrollKey.value === key) return
        await nextTick()
        scrollToPost(value)
        timelinePostNumber.value = value
      },
      { immediate: true }
    )

    watch(
      () => props.topic?.id,
      () => {
        likedPostIds.value = new Set()
        likingPostIds.value = new Set()
        expandedReplies.value = new Set()
        replyMap.value = new Map()
        replyParsedCache.clear()
        expandedParents.value = new Set()
        parentPostCache.value = new Map()
        parentLoading.value = new Set()
        parentParsedCache.clear()
        timelinePostNumber.value = 1
      }
    )

    const handleQuoteToggle = async (event: Event) => {
      const target = event.target as HTMLElement | null

      const spoiler = target?.closest('.spoiled') as HTMLElement | null
      if (spoiler) {
        const isBlurred =
          spoiler.classList.contains('spoiler-blurred') ||
          spoiler.getAttribute('data-spoiler-state') === 'blurred'
        if (isBlurred) {
          spoiler.classList.remove('spoiler-blurred')
          spoiler.setAttribute('data-spoiler-state', 'revealed')
          spoiler.setAttribute('aria-expanded', 'true')
          spoiler.querySelectorAll('[aria-hidden="true"]').forEach(el => {
            el.setAttribute('aria-hidden', 'false')
          })
        } else {
          spoiler.classList.add('spoiler-blurred')
          spoiler.setAttribute('data-spoiler-state', 'blurred')
          spoiler.setAttribute('aria-expanded', 'false')
          spoiler.querySelectorAll('[aria-hidden="false"]').forEach(el => {
            el.setAttribute('aria-hidden', 'true')
          })
        }
        event.preventDefault()
        event.stopPropagation()
        return
      }

      // Check if clicked on quote title (to navigate)
      const titleLink = target?.closest('.quote-title__text-content, .quote-controls')
      if (titleLink) {
        const aside = target?.closest('aside.quote') as HTMLElement | null
        if (!aside) return

        const topicId = aside.getAttribute('data-topic')
        const postNumber = aside.getAttribute('data-post')
        if (!topicId || !postNumber) return

        event.preventDefault()
        event.stopPropagation()
        emit('openQuote', { topicId: parseInt(topicId), postNumber: parseInt(postNumber) })
        return
      }

      // Original expand/collapse logic
      const button = target?.closest('button.quote-toggle') as HTMLButtonElement | null
      if (!button) return

      const aside = button.closest('aside.quote') as HTMLElement | null
      if (!aside) return

      event.preventDefault()
      event.stopPropagation()

      const blockquote = aside.querySelector('blockquote') as HTMLElement | null
      if (!blockquote) return

      const expanded = aside.getAttribute('data-expanded') === 'true'
      const original = blockquote.getAttribute('data-original-html')

      if (expanded) {
        if (original !== null) {
          blockquote.innerHTML = original
        }
        aside.setAttribute('data-expanded', 'false')
        button.setAttribute('aria-expanded', 'false')
        return
      }

      if (original === null) {
        blockquote.setAttribute('data-original-html', blockquote.innerHTML)
      }

      const topicId = aside.getAttribute('data-topic')
      const postNumber = aside.getAttribute('data-post')
      if (!topicId || !postNumber) return

      button.classList.add('is-loading')
      button.setAttribute('aria-expanded', 'true')
      aside.setAttribute('data-expanded', 'true')

      try {
        const result = await pageFetch<any>(
          `${props.baseUrl}/posts/by_number/${topicId}/${postNumber}.json`
        )

        if (result.status === 404) {
          blockquote.innerHTML = '<div class="quote-error">引用内容不存在 (404)</div>'
          return
        }

        const data = extractData(result)
        if (data?.cooked) {
          const parsed = parsePostContent(data.cooked, props.baseUrl)
          blockquote.innerHTML = parsed.html

          // Apply highlighting to code blocks in the expanded quote
          const codeBlocks = blockquote.querySelectorAll('pre code')
          codeBlocks.forEach(block => {
            const el = block as HTMLElement
            const langMatch = Array.from(el.classList).find(cls => cls.startsWith('lang-'))
            if (langMatch) {
              const lang = langMatch.replace('lang-', '')
              if (hljs.getLanguage(lang)) {
                el.innerHTML = hljs.highlight(el.textContent || '', { language: lang }).value
                el.classList.add('hljs')
                return
              }
            }
            hljs.highlightElement(el)
          })
        } else if (result.ok === false) {
          const statusText = result.status ? ` (${result.status})` : ''
          blockquote.innerHTML = `<div class="quote-error">引用内容加载失败${statusText}</div>`
        }
      } catch (error) {
        console.warn('[DiscourseBrowser] expand quote failed:', error)
        aside.setAttribute('data-expanded', 'false')
        button.setAttribute('aria-expanded', 'false')
      } finally {
        button.classList.remove('is-loading')
      }
    }

    onMounted(() => {
      postsListRef.value?.addEventListener('click', handleQuoteToggle)
      const container = postsListRef.value?.closest('.content-area') as HTMLElement | null
      container?.addEventListener('scroll', updateTimelineFromScroll)
      updateTimelineFromScroll()
    })

    onUnmounted(() => {
      postsListRef.value?.removeEventListener('click', handleQuoteToggle)
      const container = postsListRef.value?.closest('.content-area') as HTMLElement | null
      container?.removeEventListener('scroll', updateTimelineFromScroll)
    })

    return () => (
      <div class="topic-view flex gap-4">
        <div class="topic-main flex-1 min-w-0 space-y-4">
          <TopicHeader topic={props.topic} />

          {/* Posts list */}
          {props.topic.post_stream?.posts ? (
            <div ref={postsListRef} class="posts-list space-y-4">
              {props.topic.post_stream.posts.map(post => (
                <div key={post.id}>
                  {post.reply_to_post_number && isParentExpanded(post.post_number) && (
                    <div class="post-parent-outer">
                      {isParentLoading(post.post_number) ? (
                        <div class="text-xs text-gray-500">上文加载中...</div>
                      ) : getParentPost(post) && getParsedParent(post) ? (
                        <PostParentPreview
                          post={getParentPost(post)!}
                          parsed={getParsedParent(post)!}
                          baseUrl={props.baseUrl}
                          getParentPost={getParentPost}
                          getParentParsed={getParsedParent}
                          isParentExpanded={(postItem: DiscoursePost) =>
                            isParentExpanded(postItem.post_number)
                          }
                          isParentLoading={(postItem: DiscoursePost) =>
                            isParentLoading(postItem.post_number)
                          }
                          onOpenUser={handleUserClick}
                          onJumpToPost={scrollToPost}
                          onNavigate={handleContentNavigation}
                          onToggleParent={handleToggleParent}
                        />
                      ) : (
                        <div class="text-xs text-gray-500">上文不可用</div>
                      )}
                    </div>
                  )}
                  <PostItem
                    post={post}
                    baseUrl={props.baseUrl}
                    topicId={props.topic.id}
                    parsed={getParsedPost(post.id)}
                    isParentExpanded={isParentExpanded(post.post_number)}
                    isPostLiked={isPostLiked}
                    getReactionCount={getReactionCount}
                    isLiking={likingPostIds.value.has(post.id)}
                    currentUser={props.currentUser}
                    currentUsername={props.currentUsername}
                    onOpenUser={handleUserClick}
                    onReplyTo={handleReplyClick}
                    onToggleLike={toggleLike}
                    onToggleReplies={handleToggleReplies}
                    onToggleParent={handleToggleParent}
                    onNavigate={handleContentNavigation}
                    onBookmark={handleBookmark}
                    onFlag={handleFlag}
                    onAssign={handleAssign}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onWiki={handleWiki}
                    onArchiveTopic={archiveTopicAsWebp}
                    isArchiving={isArchiving.value}
                  />
                  {isRepliesExpanded(post.post_number) && (
                    <div class="pl-6 mt-3 space-y-3">
                      <PostRepliesTree
                        posts={getRepliesForPost(post.post_number)}
                        baseUrl={props.baseUrl}
                        getParsed={getParsedReply}
                        getReplies={getRepliesForPost}
                        isExpanded={isRepliesExpanded}
                        onOpenUser={handleUserClick}
                        onToggleReplies={handleToggleReplies}
                        onNavigate={handleContentNavigation}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div class="text-center text-gray-500 py-8">加载帖子中...</div>
          )}

          {/* Loading more indicator */}
          {props.isLoadingMore && (
            <div class="flex items-center justify-center py-4">
              <Spin />
              <span class="ml-2 text-gray-500">加载更多帖子...</span>
            </div>
          )}

          {/* End of posts indicator */}
          {!props.hasMorePosts && props.topic.post_stream?.posts?.length && (
            <div class="text-center text-gray-400 py-4 text-sm">
              已加载全部 {props.topic.post_stream.posts.length} 条帖子
            </div>
          )}

          <TopicFooter
            notificationLevel={
              props.topic.notification_level ?? props.topic.details?.notification_level ?? null
            }
            bookmarked={!!firstPost.value?.bookmarked}
            canAssign={
              !!props.currentUser && (props.currentUser.admin || props.currentUser.moderator)
            }
            aiAvailable={aiAvailable.value}
            aiLoading={aiLoading.value}
            onChangeLevel={handleChangeNotificationLevel}
            onBookmark={handleTopicBookmark}
            onFlag={handleTopicFlag}
            onAssign={handleTopicAssign}
            onReply={handleTopicReply}
            onAiSummary={handleAiSummary}
          />

          <TopicExtras
            suggested={props.topic.suggested_topics || []}
            related={props.topic.related_topics || []}
            baseUrl={props.baseUrl}
            onOpen={handleSuggestedClick}
          />
        </div>

        <div class="topic-aside hidden lg:block w-56">
          <div class="topic-aside__inner">
            <TopicTimeline
              posts={props.topic.post_stream?.posts || []}
              maxPostNumber={maxPostNumber.value}
              currentPostNumber={timelinePostNumber.value}
              onJump={scrollToPost}
            />
          </div>
        </div>

        <Modal
          open={showAiSummaryModal.value}
          title="AI 总结"
          footer={null}
          width="720px"
          onCancel={() => {
            showAiSummaryModal.value = false
          }}
        >
          <div class="space-y-3">
            {aiLoading.value && <div class="text-sm text-gray-500">生成中...</div>}
            {aiSummary.value && (
              <div class="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
                {aiSummary.value}
              </div>
            )}
            {aiErrorMessage.value && (
              <div class="text-sm text-red-500">{aiErrorMessage.value}</div>
            )}
            {aiMeta.value && (
              <div class="text-xs text-gray-500">
                {aiMeta.value.outdated ? '内容已过期' : '已更新'}
                {aiMeta.value.algorithm && ` · ${aiMeta.value.algorithm}`}
                {aiMeta.value.updatedAt && ` · ${aiMeta.value.updatedAt}`}
                {typeof aiMeta.value.newPosts === 'number' &&
                  ` · 新增 ${aiMeta.value.newPosts} 条`}
              </div>
            )}
            {(aiMeta.value?.outdated || aiMeta.value?.canRegenerate) && (
              <div>
                <button
                  type="button"
                  class="px-3 py-1 text-sm bg-blue-600 text-white rounded"
                  disabled={aiLoading.value}
                  onClick={handleAiRegenerate}
                >
                  重新生成
                </button>
              </div>
            )}
          </div>
        </Modal>
      </div>
    )
  }
})
