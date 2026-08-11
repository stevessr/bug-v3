import { computed, ref, watch, defineComponent, onBeforeUnmount, onMounted, nextTick } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import katex from 'katex'
import hljs from 'highlight.js'
import { Input, Button, Select, TreeSelect } from 'ant-design-vue'

import type { DiscourseCategory, DiscourseUser } from '../types'
import {
  ensurePreloadedCategoriesLoaded,
  getAllPreloadedCategories,
  isLinuxDoUrl
} from '../linux.do/preloadedCategories'
import { createTopic, replyToTopic, editPost, searchTags } from '../actions'
import { parseEmojiShortcodeToBBCode, renderBBCode } from '../bbcode'
import { renderDiscourseMarkdown } from '../bbcode/renderDiscourse'
import { ensureEmojiShortcodesLoaded } from '../linux.do/emojis'
import { resolveDiscourseHttpUrl } from '../navigation'
import TagPill from '../layout/TagPill'
import { getDiscourseIconHref } from '../layout/iconSprite'
import ProseMirrorEditor from '../ProseMirrorEditor'
import { extractData, getAvatarUrl, pageFetch } from '../utils'

import { WysiwygEditor } from '@/components/editor/wysiwyg'
import '../css/Composer.css'
import '../css/highlight.css'

marked.setOptions({ breaks: true, gfm: true })

type ComposerMode = 'topic' | 'reply' | 'edit' | 'privateMessage'

export default defineComponent({
  name: 'Composer',
  props: {
    mode: { type: String as () => ComposerMode, required: true },
    baseUrl: { type: String, required: true },
    topicId: { type: Number, default: undefined },
    postId: { type: Number, default: undefined },
    initialRaw: { type: String, default: undefined },
    originalRaw: { type: String, default: undefined },
    replyToPostNumber: { type: Number, default: undefined },
    replyToUsername: { type: String, default: undefined },
    /** A monotonic insertion token lets external quote actions append safely
     * without resetting an open reply draft. */
    insertText: { type: String, default: undefined },
    insertToken: { type: Number, default: undefined },
    categories: { type: Array as () => DiscourseCategory[], default: () => [] },
    currentCategory: { type: Object as () => DiscourseCategory | null, default: null },
    defaultCategoryId: { type: Number, default: undefined },
    initialTargetUsernames: { type: Array as () => string[], default: () => [] },
    showClose: { type: Boolean, default: false }
  },
  emits: ['posted', 'clearReply', 'close'],
  setup(props, { emit }) {
    const title = ref('')
    const raw = ref('')
    const selectedTags = ref<string[]>([])
    const tagOptions = ref<Array<{ value: string; label: string; description?: string | null }>>([])
    const tagsLoading = ref(false)
    const categoryId = ref<number | null>(props.defaultCategoryId ?? null)
    const editMode = ref<'edit' | 'preview' | 'split' | 'wysiwyg'>('edit')
    const editReason = ref('')
    const inputFormat = ref<'markdown' | 'bbcode'>('markdown')
    const isSubmitting = ref(false)
    const errorMessage = ref('')
    const successMessage = ref('')
    let tagSearchTimer: number | null = null
    let recipientSearchTimer: ReturnType<typeof setTimeout> | null = null
    const preloadedCategoriesReadyToken = ref(0)
    const emojiReadyToken = ref(0)
    const previewContentRef = ref<HTMLElement | null>(null)
    const targetUsernames = ref<string[]>([])
    const recipientQuery = ref('')
    const recipientResults = ref<DiscourseUser[]>([])
    const recipientSearching = ref(false)

    const normalizeUsername = (value: string) => value.trim().replace(/^@+/, '')

    const setInitialRecipients = (value: string[] | undefined) => {
      const seen = new Set<string>()
      targetUsernames.value = (value || []).reduce<string[]>((result, entry) => {
        const username = normalizeUsername(String(entry || ''))
        const key = username.toLowerCase()
        if (!username || seen.has(key)) return result
        seen.add(key)
        result.push(username)
        return result
      }, [])
    }

    watch(
      () => props.defaultCategoryId,
      value => {
        if (value) categoryId.value = value
      }
    )

    const applyHighlighting = () => {
      if (!previewContentRef.value) return
      const codeBlocks = previewContentRef.value.querySelectorAll('pre code')
      codeBlocks.forEach(block => {
        const el = block as HTMLElement
        if (el.dataset.highlighted) return

        const langMatch = Array.from(el.classList).find(cls => cls.startsWith('lang-'))
        if (langMatch) {
          const lang = langMatch.replace('lang-', '')
          if (hljs.getLanguage(lang)) {
            el.innerHTML = hljs.highlight(el.textContent || '', { language: lang }).value
            el.classList.add('hljs')
            el.dataset.highlighted = 'true'
            return
          }
        }
        hljs.highlightElement(el)
        el.dataset.highlighted = 'true'
      })
    }

    onMounted(() => {
      applyHighlighting()
    })

    onBeforeUnmount(() => {
      if (tagSearchTimer) window.clearTimeout(tagSearchTimer)
      if (recipientSearchTimer) clearTimeout(recipientSearchTimer)
    })

    watch(
      () =>
        [
          props.mode,
          props.postId,
          props.initialRaw,
          props.initialTargetUsernames.join(',')
        ] as const,
      ([mode, _postId, initialRaw]) => {
        if (mode === 'edit') {
          raw.value = initialRaw || ''
          editReason.value = ''
        } else if (mode === 'reply') {
          raw.value = ''
        } else if (mode === 'privateMessage') {
          raw.value = ''
          title.value = ''
          recipientQuery.value = ''
          recipientResults.value = []
          setInitialRecipients(props.initialTargetUsernames)
        }
      },
      { immediate: true }
    )

    watch(
      () => props.insertToken,
      token => {
        const text = String(props.insertText || '').trim()
        if (!token || !text) return
        const current = raw.value.trimEnd()
        raw.value = current ? `${current}\n\n${text}` : text
        errorMessage.value = ''
        successMessage.value = ''
        if (props.mode === 'reply') editMode.value = 'edit'
      },
      { immediate: true }
    )

    watch(
      () => props.baseUrl,
      async value => {
        if (!isLinuxDoUrl(value)) return
        await ensurePreloadedCategoriesLoaded()
        preloadedCategoriesReadyToken.value++
        await ensureEmojiShortcodesLoaded(value)
        emojiReadyToken.value++
      },
      { immediate: true }
    )

    const showEditor = computed(() => editMode.value === 'edit' || editMode.value === 'split')
    const showPreview = computed(() => editMode.value === 'preview' || editMode.value === 'split')
    const showWysiwyg = computed(() => editMode.value === 'wysiwyg')

    const previewFormat = computed(() => {
      const value = raw.value || ''
      if (detectHtmlAst(value)) return 'html'
      if (detectMarkdownAst(value)) return 'markdown'
      if (detectBbcodeAst(value)) return 'bbcode'
      return 'markdown'
    })

    const getImageUrl = (url?: string | null) => {
      if (!url) return ''
      return resolveDiscourseHttpUrl(url, props.baseUrl) || ''
    }

    const mergedCategories = computed(() => {
      const readyToken = preloadedCategoriesReadyToken.value
      const localMap = new Map<number, DiscourseCategory>()
      const usingLinuxDo = isLinuxDoUrl(props.baseUrl) && readyToken >= 0

      if (usingLinuxDo) {
        getAllPreloadedCategories().forEach(raw => {
          if (typeof raw.id !== 'number') return
          localMap.set(raw.id, {
            id: raw.id,
            name: raw.name || `category-${raw.id}`,
            slug: raw.slug || String(raw.id),
            color: raw.color || '0088CC',
            text_color: raw.text_color || 'FFFFFF',
            topic_count: 0,
            parent_category_id: raw.parent_category_id ?? null,
            style_type: raw.style_type ?? null,
            icon: raw.icon ?? null,
            emoji: raw.emoji ?? null,
            uploaded_logo: raw.uploaded_logo ?? null,
            uploaded_logo_dark: raw.uploaded_logo_dark ?? null
          })
        })
      }

      ;(props.categories || []).forEach(cat => {
        localMap.set(cat.id, { ...localMap.get(cat.id), ...cat })
      })

      if (props.currentCategory?.id) {
        localMap.set(props.currentCategory.id, {
          ...localMap.get(props.currentCategory.id),
          ...props.currentCategory
        })
      }

      return Array.from(localMap.values())
    })

    const categoryTreeData = computed(() => {
      const list = mergedCategories.value

      const nodeMap = new Map<
        number,
        {
          title: string
          value: number
          key: number
          children: any[]
          icon?: string | null
          emoji?: string | null
          color?: string | null
          logoUrl?: string
        }
      >()
      const childrenByParent = new Map<number, Set<number>>()

      const linkChild = (parentId: number, childId: number) => {
        const children = childrenByParent.get(parentId) || new Set<number>()
        children.add(childId)
        childrenByParent.set(parentId, children)
      }

      list.forEach(cat => {
        nodeMap.set(cat.id, {
          title: cat.name,
          value: cat.id,
          key: cat.id,
          icon: cat.icon,
          emoji: cat.emoji,
          color: cat.color,
          logoUrl: cat.uploaded_logo?.url || cat.uploaded_logo_dark?.url || '',
          children: []
        })
      })

      list.forEach(cat => {
        if (cat.parent_category_id && nodeMap.has(cat.parent_category_id)) {
          linkChild(cat.parent_category_id, cat.id)
        }
      })

      list.forEach(cat => {
        if (!cat.subcategory_ids?.length) return
        cat.subcategory_ids.forEach(childId => {
          if (nodeMap.has(childId)) {
            linkChild(cat.id, childId)
          }
        })
      })

      const hasParent = new Set<number>()
      childrenByParent.forEach((childIds, parentId) => {
        const parent = nodeMap.get(parentId)
        if (!parent) return
        childIds.forEach(childId => {
          const child = nodeMap.get(childId)
          if (!child) return
          if (!parent.children.some(item => item.value === child.value)) {
            parent.children.push(child)
          }
          hasParent.add(childId)
        })
      })

      const roots: Array<{ title: string; value: number; key: number; children: any[] }> = []
      nodeMap.forEach((node, id) => {
        if (!hasParent.has(id)) {
          roots.push(node)
        }
      })

      return roots
    })

    const normalizeTreeNode = (node: any) => {
      return node?.dataRef ?? node
    }

    // `previewHtml` is evaluated immediately by the watcher below, so keep its
    // renderer initialized before creating the computed ref.  Otherwise a
    // newly mounted composer can hit the temporal-dead-zone for this constant.
    const renderMarkdown = renderDiscourseMarkdown

    const previewHtml = computed(() => {
      emojiReadyToken.value
      if (previewFormat.value === 'html') {
        return renderHtml(raw.value)
      }
      if (previewFormat.value === 'markdown') {
        return renderMarkdown(raw.value)
      }
      return renderBBCodeWithMath(raw.value)
    })

    watch(previewHtml, async () => {
      await nextTick()
      applyHighlighting()
    })

    function renderBBCodeWithMath(input: string) {
      if (!input) return ''

      const withEmoji = parseEmojiShortcodeToBBCode(input)

      const mathBlocks: Array<{ tex: string; display: boolean }> = []
      let source = withEmoji.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
        const id = mathBlocks.length
        mathBlocks.push({ tex, display: true })
        return `@@MATH_BLOCK_${id}@@`
      })
      source = source.replace(/(^|[^\\])\$(?!\d)([^\s$][^$]*?)\$/g, (_match, prefix, tex) => {
        const id = mathBlocks.length
        mathBlocks.push({ tex, display: false })
        return `${prefix}@@MATH_INLINE_${id}@@`
      })

      let html = renderBBCode(source)

      html = html.replace(/@@MATH_(BLOCK|INLINE)_(\d+)@@/g, (_match, kind, index) => {
        const item = mathBlocks[Number(index)]
        if (!item) return ''
        return katex.renderToString(item.tex, {
          displayMode: kind === 'BLOCK',
          throwOnError: false
        })
      })

      return DOMPurify.sanitize(html, {
        ADD_TAGS: [
          'math',
          'semantics',
          'mrow',
          'mi',
          'mn',
          'mo',
          'annotation',
          'annotation-xml',
          'svg',
          'path',
          'img',
          'details',
          'summary',
          'table',
          'thead',
          'tbody',
          'tr',
          'th',
          'td',
          'mark',
          'ins',
          'del',
          'video',
          'audio'
        ],
        ADD_ATTR: [
          'class',
          'style',
          'src',
          'alt',
          'viewBox',
          'width',
          'height',
          'rel',
          'loading',
          'controls',
          'preload',
          'data-code-wrap',
          'data-post',
          'data-topic'
        ]
      })
    }

    function renderHtml(input: string) {
      if (!input) return ''
      return DOMPurify.sanitize(input, {
        ADD_TAGS: [
          'math',
          'semantics',
          'mrow',
          'mi',
          'mn',
          'mo',
          'annotation',
          'annotation-xml',
          'svg',
          'path',
          'img',
          'details',
          'summary',
          'table',
          'thead',
          'tbody',
          'tr',
          'th',
          'td',
          'mark',
          'ins',
          'del',
          'video',
          'audio'
        ],
        ADD_ATTR: [
          'class',
          'style',
          'src',
          'alt',
          'viewBox',
          'width',
          'height',
          'rel',
          'loading',
          'controls',
          'preload',
          'data-code-wrap',
          'data-post',
          'data-topic'
        ]
      })
    }

    function detectHtmlAst(input: string) {
      if (!input || !/<[a-zA-Z/!]/.test(input)) return false
      try {
        const parser = new DOMParser()
        const doc = parser.parseFromString(input, 'text/html')
        const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT)
        while (walker.nextNode()) {
          const el = walker.currentNode as Element
          const tag = el.tagName.toLowerCase()
          if (tag !== 'br') return true
        }
      } catch {
        return false
      }
      return false
    }

    function detectMarkdownAst(input: string) {
      if (!input) return false
      try {
        const tokens = marked.lexer(input)
        return tokens.some(token => token.type !== 'space')
      } catch {
        return false
      }
    }

    function detectBbcodeAst(input: string) {
      if (!input || !input.includes('[')) return false
      const allowed = new Set([
        'b',
        'i',
        'u',
        's',
        'img',
        'url',
        'quote',
        'code',
        'list',
        'spoiler',
        'size',
        'color',
        'center',
        'left',
        'right',
        'sub',
        'sup'
      ])
      const stack: string[] = []
      const regex = /\[\/?([a-z0-9]+)(?:=[^\]]+)?\]/gi
      let match: RegExpExecArray | null
      let found = false
      while ((match = regex.exec(input))) {
        const rawTag = match[1]?.toLowerCase()
        if (!rawTag || !allowed.has(rawTag)) continue
        found = true
        const isClosing = match[0].startsWith('[/')
        if (isClosing) {
          if (stack.length && stack[stack.length - 1] === rawTag) {
            stack.pop()
          }
        } else {
          stack.push(rawTag)
        }
      }
      return found
    }

    const addRecipient = (value: string) => {
      const username = normalizeUsername(value)
      if (!username) return
      if (
        targetUsernames.value.some(existing => existing.toLowerCase() === username.toLowerCase())
      ) {
        recipientQuery.value = ''
        return
      }
      targetUsernames.value = [...targetUsernames.value, username]
      recipientQuery.value = ''
      recipientResults.value = []
    }

    const removeRecipient = (username: string) => {
      targetUsernames.value = targetUsernames.value.filter(
        value => value.toLowerCase() !== username.toLowerCase()
      )
    }

    const searchRecipients = async (query: string) => {
      const term = normalizeUsername(query)
      if (!term) {
        recipientResults.value = []
        return
      }
      recipientSearching.value = true
      try {
        const result = await pageFetch<any>(
          `${props.baseUrl}/u/search.json?term=${encodeURIComponent(term)}&limit=8`
        )
        const data = extractData(result)
        const users = Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : []
        recipientResults.value = users.filter(
          (user: DiscourseUser) =>
            user?.username &&
            !targetUsernames.value.some(
              selected => selected.toLowerCase() === user.username.toLowerCase()
            )
        )
      } catch {
        recipientResults.value = []
      } finally {
        recipientSearching.value = false
      }
    }

    const handleRecipientInput = (value: string) => {
      recipientQuery.value = value
      if (recipientSearchTimer) clearTimeout(recipientSearchTimer)
      if (!value.trim()) {
        recipientResults.value = []
        return
      }
      recipientSearchTimer = setTimeout(() => void searchRecipients(value), 220)
    }

    const handleRecipientKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && recipientQuery.value.trim()) {
        event.preventDefault()
        const first = recipientResults.value[0]
        addRecipient(first?.username || recipientQuery.value)
      }
      if (event.key === 'Backspace' && !recipientQuery.value && targetUsernames.value.length) {
        targetUsernames.value = targetUsernames.value.slice(0, -1)
      }
    }

    async function handleSubmit() {
      if (!raw.value.trim()) {
        errorMessage.value = '请输入内容'
        return
      }
      if (props.mode === 'topic' && !title.value.trim()) {
        errorMessage.value = '请输入标题'
        return
      }
      if (props.mode === 'privateMessage' && targetUsernames.value.length === 0) {
        errorMessage.value = '请至少选择一位收件人'
        return
      }
      if (props.mode === 'reply' && !props.topicId) {
        errorMessage.value = '缺少话题 ID'
        return
      }
      if (props.mode === 'edit' && !props.postId) {
        errorMessage.value = '缺少帖子 ID'
        return
      }

      errorMessage.value = ''
      successMessage.value = ''
      isSubmitting.value = true
      try {
        let result: any = null
        if (props.mode === 'topic') {
          result = await createTopic(props.baseUrl, {
            title: title.value.trim(),
            raw: raw.value.trim(),
            categoryId: categoryId.value,
            tags: selectedTags.value
          })
          title.value = ''
          selectedTags.value = []
        } else if (props.mode === 'privateMessage') {
          result = await createTopic(props.baseUrl, {
            title: title.value.trim() || `私信给 ${targetUsernames.value.join(', ')}`,
            raw: raw.value.trim(),
            targetUsernames: targetUsernames.value
          })
          title.value = ''
          targetUsernames.value = []
        } else if (props.mode === 'reply') {
          const topicId = props.topicId as number
          result = await replyToTopic(props.baseUrl, {
            topicId,
            raw: raw.value.trim(),
            replyToPostNumber: props.replyToPostNumber
          })
        } else {
          const postId = props.postId as number
          result = await editPost(props.baseUrl, {
            postId,
            raw: raw.value.trim(),
            editReason: editReason.value || undefined,
            topicId: props.topicId,
            originalText: props.originalRaw ?? props.initialRaw ?? raw.value.trim(),
            locale: ''
          })
        }
        raw.value = ''
        successMessage.value =
          props.mode === 'edit'
            ? '编辑成功'
            : props.mode === 'privateMessage'
              ? '私信已发送'
              : '发布成功'
        emit('posted', result)
      } catch (error) {
        errorMessage.value = (error as Error).message || '请求失败'
      } finally {
        isSubmitting.value = false
      }
    }

    async function runTagSearch(query: string) {
      tagsLoading.value = true
      try {
        const results = await searchTags(props.baseUrl, query, categoryId.value)
        tagOptions.value = results.map(item => ({
          value: item.name || item.text,
          label: item.text || item.name,
          description: item.description || null
        }))
      } catch {
        tagOptions.value = []
      } finally {
        tagsLoading.value = false
      }
    }

    const getTagOption = (value: string) => {
      return tagOptions.value.find(option => option.value === value) || null
    }

    const handleTagSearch = (query: string) => {
      if (tagSearchTimer) window.clearTimeout(tagSearchTimer)
      tagSearchTimer = window.setTimeout(() => runTagSearch(query), 250)
    }

    const handleTagDropdown = (open: boolean) => {
      if (open && tagOptions.value.length === 0) {
        runTagSearch('')
      }
    }

    watch(categoryId, () => {
      tagOptions.value = []
      if (selectedTags.value.length === 0) {
        runTagSearch('')
      }
    })

    return () => (
      <div class="composer border rounded-lg dark:border-gray-700 bg-white dark:bg-gray-900">
        <div class="composer-header flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
          <div class="text-sm font-medium dark:text-white">
            {props.mode === 'topic' ? (
              '发帖子'
            ) : props.mode === 'privateMessage' ? (
              '新建私信'
            ) : props.mode === 'edit' ? (
              '编辑帖子'
            ) : (
              <>
                回复
                {props.replyToPostNumber ? (
                  <span class="text-xs text-gray-500 ml-1">
                    #{props.replyToPostNumber}
                    {props.replyToUsername ? `(@${props.replyToUsername})` : null}
                  </span>
                ) : null}
              </>
            )}
          </div>
          <div class="flex items-center gap-2">
            <Button
              size="small"
              type="text"
              class={{ 'text-blue-500': editMode.value === 'edit' }}
              onClick={() => (editMode.value = 'edit')}
            >
              编辑
            </Button>
            <Button
              size="small"
              type="text"
              class={{ 'text-blue-500': editMode.value === 'split' }}
              onClick={() => (editMode.value = 'split')}
            >
              分屏
            </Button>
            <Button
              size="small"
              type="text"
              class={{ 'text-blue-500': editMode.value === 'preview' }}
              onClick={() => (editMode.value = 'preview')}
            >
              预览
            </Button>
            <Button
              size="small"
              type="text"
              class={{ 'text-blue-500': editMode.value === 'wysiwyg' }}
              onClick={() => (editMode.value = 'wysiwyg')}
            >
              所见即所得
            </Button>
            {props.mode === 'reply' && props.replyToPostNumber ? (
              <Button size="small" onClick={() => emit('clearReply')}>
                取消引用
              </Button>
            ) : null}
            {props.showClose ? (
              <Button size="small" type="text" onClick={() => emit('close')}>
                关闭
              </Button>
            ) : null}
          </div>
        </div>

        {props.mode === 'privateMessage' ? (
          <div class="composer-private-message-fields">
            <div class="composer-recipient-field">
              <label for="composer-private-message-recipient">收件人</label>
              <div class="composer-recipient-control">
                {targetUsernames.value.map(username => (
                  <span key={username} class="composer-recipient-chip">
                    @{username}
                    <button
                      type="button"
                      aria-label={`移除收件人 ${username}`}
                      title={`移除 @${username}`}
                      onClick={() => removeRecipient(username)}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <Input
                  id="composer-private-message-recipient"
                  value={recipientQuery.value}
                  bordered={false}
                  placeholder={
                    targetUsernames.value.length ? '继续搜索收件人' : '搜索用户名并选择收件人'
                  }
                  aria-label="搜索收件人"
                  onUpdate:value={handleRecipientInput}
                  onKeydown={handleRecipientKeydown}
                />
              </div>
              <div class="composer-recipient-results" aria-live="polite">
                {recipientSearching.value && (
                  <div class="composer-recipient-hint">正在搜索用户…</div>
                )}
                {!recipientSearching.value &&
                  recipientResults.value.map(user => (
                    <button
                      key={user.id || user.username}
                      type="button"
                      class="composer-recipient-result"
                      onClick={() => addRecipient(user.username)}
                    >
                      {user.avatar_template ? (
                        <img
                          src={getAvatarUrl(user.avatar_template, props.baseUrl, 28)}
                          alt=""
                          loading="lazy"
                        />
                      ) : (
                        <span class="composer-recipient-result__fallback" aria-hidden="true">
                          {user.username[0]?.toUpperCase() || '?'}
                        </span>
                      )}
                      <span>
                        <strong>{user.name || user.username}</strong>
                        <small>@{user.username}</small>
                      </span>
                    </button>
                  ))}
                {!recipientSearching.value &&
                  recipientQuery.value.trim() &&
                  recipientResults.value.length === 0 && (
                    <div class="composer-recipient-hint">
                      没有匹配用户，按 Enter 可按用户名添加。
                    </div>
                  )}
              </div>
              <small class="composer-recipient-help">可选择多位收件人；会创建群组私信。</small>
            </div>
            <Input
              value={title.value}
              placeholder="私信标题（可选）"
              aria-label="私信标题"
              onUpdate:value={v => (title.value = v)}
            />
          </div>
        ) : props.mode === 'topic' ? (
          <div class="px-4 pt-4 space-y-3">
            <Input value={title.value} placeholder="标题" onUpdate:value={v => (title.value = v)} />
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <TreeSelect
                value={categoryId.value}
                placeholder="选择分类"
                allowClear
                showSearch
                treeDefaultExpandAll
                treeNodeFilterProp="title"
                treeData={categoryTreeData.value as any}
                onUpdate:value={v => (categoryId.value = v as number)}
                v-slots={{
                  title: (node: any) => {
                    const normalized = normalizeTreeNode(node)
                    return normalized?.title ? (
                      <span class="category-option">
                        <span
                          class="category-option-icon"
                          style={{ color: `#${normalized?.color || '94a3b8'}` }}
                        >
                          {normalized?.logoUrl ? (
                            <img
                              src={getImageUrl(normalized?.logoUrl)}
                              alt={normalized?.title}
                              class="category-option-img"
                            />
                          ) : normalized?.emoji ? (
                            <span class="category-option-emoji">{normalized?.emoji}</span>
                          ) : normalized?.icon ? (
                            <svg class="category-option-svg" viewBox="0 0 24 24">
                              <use href={getDiscourseIconHref(normalized?.icon)} />
                            </svg>
                          ) : (
                            <span
                              class="category-option-dot"
                              style={{ backgroundColor: `#${normalized?.color || '94a3b8'}` }}
                            />
                          )}
                        </span>
                        <span>{normalized?.title}</span>
                      </span>
                    ) : (
                      <span>{normalized?.title || normalized}</span>
                    )
                  }
                }}
              />
              <Select
                value={selectedTags.value}
                mode="multiple"
                showSearch
                filterOption={false}
                notFoundContent={tagsLoading.value ? '加载中...' : '无结果'}
                placeholder="标签 (搜索或输入)"
                onSearch={handleTagSearch}
                onDropdownVisibleChange={handleTagDropdown}
                onUpdate:value={v => (selectedTags.value = v as string[])}
                v-slots={{
                  tagRender: ({ value, closable, onClose }: any) => (
                    <span class="inline-flex items-center gap-1 mr-1">
                      <TagPill
                        name={String(value)}
                        text={getTagOption(String(value))?.label || String(value)}
                        description={getTagOption(String(value))?.description || undefined}
                        compact
                      />
                      {closable ? (
                        <button
                          type="button"
                          class="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          onMousedown={(event: Event) => event.preventDefault()}
                          onClick={onClose}
                        >
                          ×
                        </button>
                      ) : null}
                    </span>
                  ),
                  default: () =>
                    tagOptions.value.map(tag => (
                      <Select.Option key={tag.value} value={tag.value}>
                        <TagPill
                          name={tag.value}
                          text={tag.label}
                          description={tag.description || undefined}
                          compact
                        />
                      </Select.Option>
                    ))
                }}
              />
            </div>
          </div>
        ) : null}

        <div
          class={[
            'composer-body px-4 py-4 grid gap-4',
            showPreview.value && showEditor.value ? 'md:grid-cols-2' : 'grid-cols-1'
          ]}
        >
          {showEditor.value ? (
            <div class="composer-editor space-y-2">
              <ProseMirrorEditor
                modelValue={raw.value}
                inputFormat={inputFormat.value}
                baseUrl={props.baseUrl}
                onUpdate:modelValue={value => (raw.value = value)}
                class="composer-editor-input"
              />
            </div>
          ) : null}

          {showWysiwyg.value ? (
            <div class="composer-editor space-y-2">
              <WysiwygEditor
                modelValue={raw.value}
                baseUrl={props.baseUrl}
                onUpdate:modelValue={value => (raw.value = value)}
              />
              <div class="text-xs text-gray-500">
                <span>所见即所得模式 · 输出 HTML</span>
              </div>
            </div>
          ) : null}

          {showPreview.value ? (
            <div class="preview border rounded-md dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800">
              <div class="text-xs text-gray-400 mb-2">预览</div>
              <div
                ref={previewContentRef}
                class="preview-content prose dark:prose-invert max-w-none text-sm"
                innerHTML={previewHtml.value}
              />
            </div>
          ) : null}
        </div>

        <div class="composer-footer px-4 pb-4 space-y-2">
          {props.mode === 'edit' ? (
            <Input
              value={editReason.value}
              placeholder="编辑原因（可选）"
              onUpdate:value={v => (editReason.value = v)}
            />
          ) : null}
          {errorMessage.value ? <div class="text-sm text-red-500">{errorMessage.value}</div> : null}
          {successMessage.value ? (
            <div class="text-sm text-green-600">{successMessage.value}</div>
          ) : null}
          <div class="flex items-center justify-end gap-2">
            <Button loading={isSubmitting.value} type="primary" onClick={handleSubmit}>
              {props.mode === 'topic'
                ? '发布'
                : props.mode === 'privateMessage'
                  ? '发送私信'
                  : props.mode === 'edit'
                    ? '保存'
                    : '回复'}
            </Button>
          </div>
        </div>
      </div>
    )
  }
})
