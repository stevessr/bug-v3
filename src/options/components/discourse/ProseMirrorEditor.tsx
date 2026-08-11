import { computed, defineComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  RollbackOutlined,
  RedoOutlined,
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  StrikethroughOutlined,
  LinkOutlined,
  PictureOutlined,
  CodeOutlined,
  BlockOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  BgColorsOutlined,
  UploadOutlined,
  DownOutlined,
  FunctionOutlined,
  TableOutlined,
  InfoCircleOutlined
} from '@ant-design/icons-vue'

import {
  ensureEmojiShortcodesLoaded,
  fetchDiscourseEmojiGroups,
  type DiscourseEmojiGroup,
  type DiscourseEmojiEntry
} from './linux.do/emojis'
import { searchEmojis } from './bbcode'
import { useDiscourseUpload } from './composables/useDiscourseUpload'

import { buildMarkdownImage, shouldUseShortUrl } from '@/utils/emojiMarkdown'
import { useEmojiStore } from '@/stores/emojiStore'
import '@/components/editor/wysiwyg/styles/ProseMirrorEditor.css'

export default defineComponent({
  name: 'ProseMirrorEditor',
  props: {
    modelValue: { type: String, required: true },
    inputFormat: { type: String as () => 'markdown' | 'bbcode', required: true },
    baseUrl: { type: String, default: undefined }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const textareaRef = ref<HTMLTextAreaElement | null>(null)
    const showEmojiPicker = ref(false)
    const emojiSearchQuery = ref('')
    const emojiSource = ref<'discourse' | 'plugin'>('discourse')
    const activeEmojiGroup = ref('')
    const discourseEmojiGroups = ref<DiscourseEmojiGroup[]>([])
    const emojiLoading = ref(false)
    const emojiStore = useEmojiStore()
    const showAdvancedMenu = ref(false)
    const emojiMenuRef = ref<HTMLElement | null>(null)
    const advancedMenuRef = ref<HTMLElement | null>(null)
    const showLinkPanel = ref(false)
    const linkUrl = ref('https://')
    const linkText = ref('')
    const showImagePanel = ref(false)
    const imageUrl = ref('https://')
    const imageAlt = ref('')

    const showEmojiAutocomplete = ref(false)
    const emojiSuggestions = ref<Array<{ id: string; name: string; url: string }>>([])
    const emojiActiveIndex = ref(0)
    const emojiAutocompletePos = ref<{ x: number; y: number } | null>(null)
    const emojiAutocompleteRef = ref<HTMLElement | null>(null)

    const loadForumEmojiGroups = async () => {
      if (!props.baseUrl) return
      emojiLoading.value = true
      try {
        const [groups] = await Promise.all([
          fetchDiscourseEmojiGroups(props.baseUrl),
          emojiStore.loadData()
        ])
        discourseEmojiGroups.value = groups
        if (!activeEmojiGroup.value && groups.length > 0) {
          activeEmojiGroup.value = groups[0].id
        }
      } catch {
        discourseEmojiGroups.value = []
      } finally {
        emojiLoading.value = false
      }
    }

    const pluginEmojiGroups = computed(() =>
      emojiStore.groups
        .filter(group => group.id !== 'favorites')
        .map(group => ({
          id: group.id,
          name: group.name,
          icon: group.icon,
          emojis: (group.emojis || []).map(emoji => ({
            id: emoji.id,
            name: emoji.name,
            url: emoji.displayUrl || emoji.url,
            short_url: emoji.short_url
          }))
        }))
    )

    const visibleEmojiGroups = computed(() =>
      emojiSource.value === 'discourse' ? discourseEmojiGroups.value : pluginEmojiGroups.value
    )

    const visibleEmojis = computed(() => {
      const query = emojiSearchQuery.value.trim().toLowerCase()
      const groups = visibleEmojiGroups.value
      if (query) {
        return groups.flatMap(group =>
          group.emojis.filter(
            emoji =>
              emoji.name.toLowerCase().includes(query) || emoji.id.toLowerCase().includes(query)
          )
        )
      }
      return (
        groups.find(group => group.id === activeEmojiGroup.value)?.emojis || groups[0]?.emojis || []
      )
    })

    const toggleEmojiMenu = () => {
      showEmojiPicker.value = !showEmojiPicker.value
      showAdvancedMenu.value = false
      if (showEmojiPicker.value && discourseEmojiGroups.value.length === 0) {
        void loadForumEmojiGroups()
      }
    }

    const selectForumEmoji = (
      emoji: DiscourseEmojiEntry | { name: string; url: string; short_url?: string }
    ) => {
      if (emojiSource.value === 'plugin') {
        insertTextAtCursor(
          buildImageMarkup.value(emoji as { url: string; short_url?: string }, emoji.name)
        )
      } else {
        insertEmojiShortcode(emoji.name)
      }
      showEmojiPicker.value = false
      emojiSearchQuery.value = ''
    }

    const syncValue = (value: string) => {
      emit('update:modelValue', value)
    }

    const insertTextAtCursor = (text: string) => {
      const el = textareaRef.value
      if (!el) return
      const start = el.selectionStart ?? el.value.length
      const end = el.selectionEnd ?? el.value.length
      const next = `${el.value.slice(0, start)}${text}${el.value.slice(end)}`
      el.value = next
      const cursor = start + text.length
      el.setSelectionRange(cursor, cursor)
      syncValue(next)
      el.focus()
    }

    const wrapSelection = (before: string, after: string) => {
      const el = textareaRef.value
      if (!el) return
      const start = el.selectionStart ?? 0
      const end = el.selectionEnd ?? 0
      const selected = el.value.slice(start, end)
      const next = `${el.value.slice(0, start)}${before}${selected}${after}${el.value.slice(end)}`
      el.value = next
      const cursor = end + before.length + after.length
      el.setSelectionRange(cursor, cursor)
      syncValue(next)
      el.focus()
    }

    const toggleBold = () => wrapSelection('[b]', '[/b]')
    const toggleItalic = () => wrapSelection('[i]', '[/i]')
    const toggleUnderline = () => wrapSelection('[u]', '[/u]')
    const toggleStrike = () => wrapSelection('[s]', '[/s]')
    const insertCode = () => wrapSelection('[code]', '[/code]')
    const insertCodeBlock = () => insertTextAtCursor('[code]\n代码\n[/code]')
    const insertBlockquote = () => wrapSelection('[quote]', '[/quote]')
    const insertOrderedList = () => insertTextAtCursor('[list=1]\n[*]item\n[/list]')
    const insertUnorderedList = () => insertTextAtCursor('[list]\n[*]item\n[/list]')
    const insertHeading = () => insertTextAtCursor('[size=20][b] 标题 [/b][/size]')
    const insertMathInline = () => wrapSelection('$', '$')
    const insertMathBlock = () => insertTextAtCursor('\n$$\n公式\n$$\n')
    const insertDetails = () => insertTextAtCursor('[details=展开说明]\n内容\n[/details]')
    const insertTable = () => insertTextAtCursor('| 列 1 | 列 2 |\n| --- | --- |\n| 内容 | 内容 |')
    const chooseAdvancedSyntax = (action: () => void) => {
      action()
      showAdvancedMenu.value = false
    }
    const undoAction = () => document.execCommand('undo')
    const redoAction = () => document.execCommand('redo')

    const insertEmojiShortcode = (name: string) => {
      insertTextAtCursor(`:${name}:`)
    }

    const buildImageMarkup = computed(() => {
      return (emoji: { url: string; short_url?: string }, filename?: string) => {
        if (props.inputFormat === 'markdown') {
          const alt = filename || 'image'
          const currentHost = new URL(props.baseUrl || 'https://localhost').hostname
          const safeSource = {
            url: emoji.url,
            short_url: shouldUseShortUrl(emoji, currentHost) ? emoji.short_url : null
          }
          return buildMarkdownImage(alt, safeSource)
        }
        return `[img]${emoji.url}[/img]`
      }
    })

    const openLinkPanel = () => {
      showLinkPanel.value = true
      showImagePanel.value = false
    }

    const openImagePanel = () => {
      showImagePanel.value = true
      showLinkPanel.value = false
    }

    const closePanels = () => {
      showLinkPanel.value = false
      showImagePanel.value = false
    }

    const insertLinkMarkup = () => {
      const url = linkUrl.value.trim()
      if (!url) return
      const text = linkText.value.trim() || url
      const markup =
        props.inputFormat === 'markdown' ? `[${text}](${url})` : `[url=${url}]${text}[/url]`
      insertTextAtCursor(markup)
      closePanels()
    }

    const insertImageMarkup = () => {
      const url = imageUrl.value.trim()
      if (!url) return
      const alt = imageAlt.value.trim() || 'image'
      const markup = props.inputFormat === 'markdown' ? `![${alt}](${url})` : `[img]${url}[/img]`
      insertTextAtCursor(markup)
      closePanels()
    }

    const { handleUploadClick, handleUploadChange, fileInputRef, uploadFile } = useDiscourseUpload({
      baseUrl: props.baseUrl,
      inputFormat: () => props.inputFormat,
      onInsertText: insertTextAtCursor
    })

    const handleDocumentPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (emojiMenuRef.value?.contains(target) || advancedMenuRef.value?.contains(target)) return
      showEmojiPicker.value = false
      showAdvancedMenu.value = false
    }

    const handleDocumentKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        showEmojiPicker.value = false
        showAdvancedMenu.value = false
      }
    }

    onMounted(() => {
      document.addEventListener('pointerdown', handleDocumentPointerDown, true)
      document.addEventListener('keydown', handleDocumentKeydown)
      void loadForumEmojiGroups()
    })

    onBeforeUnmount(() => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
      document.removeEventListener('keydown', handleDocumentKeydown)
    })

    const updateAutocompleteForTextarea = () => {
      const el = textareaRef.value
      if (!el) return
      const cursor = el.selectionStart ?? el.value.length
      const textBefore = el.value.slice(0, cursor)
      const match = textBefore.match(/(^|\s):([a-zA-Z0-9_\u4e00-\u9fa5+-]*)$/)
      if (!match) {
        showEmojiAutocomplete.value = false
        emojiSuggestions.value = []
        return
      }
      const query = match[2] || ''
      const searched = searchEmojis(query).slice(0, 12)
      emojiSuggestions.value = searched.map(item => ({
        id: item.id,
        name: item.name,
        url: item.url
      }))
      if (emojiSuggestions.value.length === 0) {
        showEmojiAutocomplete.value = false
        return
      }
      const rect = el.getBoundingClientRect()
      emojiAutocompletePos.value = { x: rect.left + 12, y: rect.bottom + 8 }
      emojiActiveIndex.value = 0
      showEmojiAutocomplete.value = true
    }

    const handleTextareaKeydown = (event: KeyboardEvent) => {
      if (!showEmojiAutocomplete.value || emojiSuggestions.value.length === 0) return
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        emojiActiveIndex.value = (emojiActiveIndex.value + 1) % emojiSuggestions.value.length
        requestAnimationFrame(() => {
          const host = emojiAutocompleteRef.value
          host
            ?.querySelector('.emoji-autocomplete-item.active')
            ?.scrollIntoView({ block: 'nearest' })
        })
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        emojiActiveIndex.value =
          (emojiActiveIndex.value - 1 + emojiSuggestions.value.length) %
          emojiSuggestions.value.length
        requestAnimationFrame(() => {
          const host = emojiAutocompleteRef.value
          host
            ?.querySelector('.emoji-autocomplete-item.active')
            ?.scrollIntoView({ block: 'nearest' })
        })
      } else if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        const selected = emojiSuggestions.value[emojiActiveIndex.value]
        if (selected) {
          insertTextAtCursor(`:${selected.name}:`)
          showEmojiAutocomplete.value = false
        }
      } else if (event.key === 'Escape') {
        event.preventDefault()
        showEmojiAutocomplete.value = false
      }
    }

    const handleTextareaKeyup = (event: KeyboardEvent) => {
      if (
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === 'Enter' ||
        event.key === 'Tab' ||
        event.key === 'Escape'
      ) {
        return
      }
      updateAutocompleteForTextarea()
    }

    const handleTextareaPaste = async (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files || [])
      if (files.length === 0) return
      event.preventDefault()
      event.stopPropagation()
      for (const file of files) {
        try {
          await uploadFile(file)
        } catch (error) {
          console.error('Paste upload failed:', error)
        }
      }
    }

    watch(
      () => props.baseUrl,
      async value => {
        if (!value) return
        await ensureEmojiShortcodesLoaded(value)
      },
      { immediate: true }
    )

    watch(
      () => props.modelValue,
      value => {
        const el = textareaRef.value
        if (el && el.value !== value) {
          el.value = value
        }
      }
    )

    return () => (
      <>
        <div class="prosemirror-editor-wrapper">
          <div class="prosemirror-toolbar">
            <div class="toolbar-group">
              <button class="toolbar-btn" onClick={undoAction} title="撤销 (Ctrl+Z)">
                <RollbackOutlined />
              </button>
              <button class="toolbar-btn" onClick={redoAction} title="重做 (Ctrl+Y)">
                <RedoOutlined />
              </button>
            </div>
            <div class="toolbar-divider" />
            <div class="toolbar-group">
              <button class="toolbar-btn" onClick={toggleBold} title="粗体 (Ctrl+B)">
                <BoldOutlined />
              </button>
              <button class="toolbar-btn" onClick={toggleItalic} title="斜体 (Ctrl+I)">
                <ItalicOutlined />
              </button>
              <button class="toolbar-btn" onClick={toggleUnderline} title="下划线 (Ctrl+U)">
                <UnderlineOutlined />
              </button>
              <button class="toolbar-btn" onClick={toggleStrike} title="删除线 (Ctrl+Alt+S)">
                <StrikethroughOutlined />
              </button>
            </div>
            <div class="toolbar-divider" />
            <div class="toolbar-group">
              <div ref={emojiMenuRef} class="editor-toolbar-menu editor-toolbar-menu--emoji">
                <button
                  class={['toolbar-btn', showEmojiPicker.value ? 'is-active' : '']}
                  onClick={toggleEmojiMenu}
                  title="表情与插件表情"
                  aria-label="表情与插件表情"
                  aria-expanded={showEmojiPicker.value}
                >
                  🙂
                </button>
                {showEmojiPicker.value && (
                  <div class="forum-emoji-menu" role="dialog" aria-label="表情菜单">
                    <div class="forum-emoji-menu__header">
                      <input
                        value={emojiSearchQuery.value}
                        placeholder="搜索表情…"
                        aria-label="搜索表情"
                        onInput={event =>
                          (emojiSearchQuery.value = (event.target as HTMLInputElement).value)
                        }
                      />
                      <div class="forum-emoji-menu__sources" role="tablist" aria-label="表情来源">
                        <button
                          type="button"
                          class={emojiSource.value === 'discourse' ? 'is-active' : ''}
                          onClick={() => {
                            emojiSource.value = 'discourse'
                            activeEmojiGroup.value = discourseEmojiGroups.value[0]?.id || ''
                          }}
                        >
                          论坛
                        </button>
                        <button
                          type="button"
                          class={emojiSource.value === 'plugin' ? 'is-active' : ''}
                          onClick={() => {
                            emojiSource.value = 'plugin'
                            activeEmojiGroup.value = pluginEmojiGroups.value[0]?.id || ''
                          }}
                        >
                          插件
                        </button>
                      </div>
                    </div>
                    {!emojiSearchQuery.value && (
                      <div class="forum-emoji-menu__groups" role="tablist" aria-label="表情分组">
                        {visibleEmojiGroups.value.map(group => (
                          <button
                            key={group.id}
                            type="button"
                            class={activeEmojiGroup.value === group.id ? 'is-active' : ''}
                            title={group.name}
                            onClick={() => (activeEmojiGroup.value = group.id)}
                          >
                            {group.emojis[0]?.url ? (
                              <img src={group.emojis[0].url} alt="" />
                            ) : (
                              group.name.slice(0, 1) || '🙂'
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    <div class="forum-emoji-menu__grid">
                      {emojiLoading.value ? (
                        <span class="forum-emoji-menu__state">加载中…</span>
                      ) : visibleEmojis.value.length === 0 ? (
                        <span class="forum-emoji-menu__state">没有找到表情</span>
                      ) : (
                        visibleEmojis.value.map(emoji => (
                          <button
                            key={emoji.id}
                            type="button"
                            title={`:${emoji.name}:`}
                            onClick={() => selectForumEmoji(emoji as any)}
                          >
                            {emoji.url ? (
                              <img src={emoji.url} alt={emoji.name} loading="lazy" />
                            ) : (
                              <span>{(emoji as any).unicode || emoji.name}</span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              <button class="toolbar-btn" onClick={handleUploadClick} title="上传文件">
                <UploadOutlined />
              </button>
              <button class="toolbar-btn" onClick={openLinkPanel} title="插入链接">
                <LinkOutlined />
              </button>
              <button class="toolbar-btn" onClick={openImagePanel} title="插入图片">
                <PictureOutlined />
              </button>
              <div ref={advancedMenuRef} class="editor-toolbar-menu">
                <button
                  class={[
                    'toolbar-btn toolbar-btn--advanced',
                    showAdvancedMenu.value ? 'is-active' : ''
                  ]}
                  onClick={() => {
                    showAdvancedMenu.value = !showAdvancedMenu.value
                    showEmojiPicker.value = false
                  }}
                  title="高级语法"
                  aria-label="高级语法"
                  aria-expanded={showAdvancedMenu.value}
                >
                  <CodeOutlined /> <DownOutlined />
                </button>
                {showAdvancedMenu.value && (
                  <div class="advanced-syntax-menu" role="menu" aria-label="高级语法">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => chooseAdvancedSyntax(insertCode)}
                      title="行内代码"
                    >
                      <CodeOutlined /> <span>行内代码</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => chooseAdvancedSyntax(insertCodeBlock)}
                      title="代码块"
                    >
                      <CodeOutlined /> <span>代码块</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => chooseAdvancedSyntax(insertMathInline)}
                      title="行内公式"
                    >
                      <FunctionOutlined /> <span>行内公式</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => chooseAdvancedSyntax(insertMathBlock)}
                      title="公式块"
                    >
                      <span class="syntax-menu-icon" aria-hidden="true">
                        ∑
                      </span>
                      <span>公式块</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => chooseAdvancedSyntax(insertBlockquote)}
                      title="引用"
                    >
                      <BlockOutlined /> <span>引用</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => chooseAdvancedSyntax(insertOrderedList)}
                      title="有序列表"
                    >
                      <OrderedListOutlined /> <span>有序列表</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => chooseAdvancedSyntax(insertUnorderedList)}
                      title="无序列表"
                    >
                      <UnorderedListOutlined /> <span>无序列表</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => chooseAdvancedSyntax(insertHeading)}
                      title="标题"
                    >
                      <BgColorsOutlined /> <span>标题</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => chooseAdvancedSyntax(insertTable)}
                      title="表格"
                    >
                      <TableOutlined /> <span>表格</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => chooseAdvancedSyntax(insertDetails)}
                      title="折叠块"
                    >
                      <InfoCircleOutlined /> <span>折叠块</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <textarea
            ref={textareaRef}
            class="prosemirror-editor-textarea d-editor-input --markdown-monospace"
            value={props.modelValue}
            aria-label="在此处输入。使用 Markdown、BBCode 或 HTML 进行排版。拖放或粘贴图片以插入。"
            placeholder="在此处输入。使用 Markdown、BBCode 或 HTML 进行排版。拖放或粘贴图片以插入。"
            autocomplete="off"
            onInput={event => syncValue((event.target as HTMLTextAreaElement).value)}
            onKeydown={handleTextareaKeydown}
            onKeyup={handleTextareaKeyup}
            onPaste={handleTextareaPaste}
          />
          <input
            ref={fileInputRef}
            type="file"
            class="hidden-upload-field"
            onChange={handleUploadChange}
          />
          {showLinkPanel.value ? (
            <div class="editor-modal-backdrop" onClick={closePanels}>
              <div class="editor-modal-card" onClick={event => event.stopPropagation()}>
                <div class="editor-modal-header">
                  <span>插入链接</span>
                </div>
                <div class="editor-modal-field">
                  <span class="editor-modal-field__label">链接地址</span>
                  <input
                    class="editor-modal-field__input"
                    value={linkUrl.value}
                    onInput={event => {
                      linkUrl.value = (event.target as HTMLInputElement).value
                    }}
                    placeholder="https://"
                  />
                </div>
                <div class="editor-modal-field">
                  <span class="editor-modal-field__label">显示文本（可选）</span>
                  <input
                    class="editor-modal-field__input"
                    value={linkText.value}
                    onInput={event => {
                      linkText.value = (event.target as HTMLInputElement).value
                    }}
                    placeholder="显示文本（可选）"
                  />
                </div>
                <div class="editor-modal-preview">
                  <span class="editor-modal-preview-label">预览：</span>
                  {linkUrl.value.trim() ? (
                    <a
                      href={linkUrl.value.trim()}
                      target="_blank"
                      rel="nofollow noopener"
                      class="editor-modal-preview-link"
                    >
                      {linkText.value.trim() || linkUrl.value.trim()}
                    </a>
                  ) : (
                    <span class="editor-modal-preview-placeholder">未填写链接</span>
                  )}
                </div>
                <div class="editor-modal-actions">
                  <button class="editor-modal-btn" onClick={closePanels} title="取消">
                    取消
                  </button>
                  <button
                    class="editor-modal-btn primary"
                    onClick={insertLinkMarkup}
                    title="插入"
                    disabled={!linkUrl.value.trim()}
                  >
                    插入
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {showImagePanel.value ? (
            <div class="editor-modal-backdrop" onClick={closePanels}>
              <div class="editor-modal-card" onClick={event => event.stopPropagation()}>
                <div class="editor-modal-header">
                  <span>插入图片</span>
                </div>
                <div class="editor-modal-field">
                  <span class="editor-modal-field__label">图片地址</span>
                  <input
                    class="editor-modal-field__input"
                    value={imageUrl.value}
                    onInput={event => {
                      imageUrl.value = (event.target as HTMLInputElement).value
                    }}
                    placeholder="https://"
                  />
                </div>
                <div class="editor-modal-field">
                  <span class="editor-modal-field__label">描述（可选）</span>
                  <input
                    class="editor-modal-field__input"
                    value={imageAlt.value}
                    onInput={event => {
                      imageAlt.value = (event.target as HTMLInputElement).value
                    }}
                    placeholder="描述（可选）"
                  />
                </div>
                <div class="editor-modal-preview">
                  <span class="editor-modal-preview-label">预览：</span>
                  {imageUrl.value.trim() ? (
                    <img
                      src={imageUrl.value.trim()}
                      alt={imageAlt.value.trim() || 'image'}
                      class="editor-modal-preview-image"
                    />
                  ) : (
                    <span class="editor-modal-preview-placeholder">未填写图片地址</span>
                  )}
                </div>
                <div class="editor-modal-actions">
                  <button class="editor-modal-btn" onClick={closePanels} title="取消">
                    取消
                  </button>
                  <button
                    class="editor-modal-btn primary"
                    onClick={insertImageMarkup}
                    title="插入"
                    disabled={!imageUrl.value.trim()}
                  >
                    插入
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {showEmojiAutocomplete.value && emojiSuggestions.value.length ? (
            <div
              ref={emojiAutocompleteRef}
              class="emoji-autocomplete"
              style={
                emojiAutocompletePos.value
                  ? {
                      left: `${emojiAutocompletePos.value.x}px`,
                      top: `${emojiAutocompletePos.value.y}px`
                    }
                  : {}
              }
            >
              {emojiSuggestions.value.map((emoji, index) => (
                <button
                  key={emoji.id}
                  class={['emoji-autocomplete-item', { active: index === emojiActiveIndex.value }]}
                  onMousedown={event => event.preventDefault()}
                  onClick={() => insertTextAtCursor(`:${emoji.name}:`)}
                >
                  <img src={emoji.url} alt={emoji.name} />
                  <span>:{emoji.name}:</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </>
    )
  }
})
