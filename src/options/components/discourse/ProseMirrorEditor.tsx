import { defineComponent, ref, watch, computed } from 'vue'
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
  UploadOutlined
} from '@ant-design/icons-vue'

import { ensureEmojiShortcodesLoaded } from './linux.do/emojis'
import { searchEmojis } from './bbcode'
import { useDiscourseUpload } from './composables/useDiscourseUpload'

import { buildMarkdownImage } from '@/utils/emojiMarkdown'
import { EmojiPicker, PluginEmojiPicker } from '@/components/editor/wysiwyg'
import '@/components/editor/wysiwyg/styles/EmojiPicker.css'
import '@/components/editor/wysiwyg/styles/PluginEmojiPicker.css'
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
    const emojiPickerPos = ref<{ x: number; y: number } | null>(null)
    const showPluginEmojiPicker = ref(false)
    const pluginEmojiPickerPos = ref<{ x: number; y: number } | null>(null)
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
    const insertBlockquote = () => wrapSelection('[quote]', '[/quote]')
    const insertOrderedList = () => insertTextAtCursor('[list=1]\n[*]item\n[/list]')
    const insertUnorderedList = () => insertTextAtCursor('[list]\n[*]item\n[/list]')
    const insertHeading = () => insertTextAtCursor('[size=20][b] 标题 [/b][/size]')
    const undoAction = () => document.execCommand('undo')
    const redoAction = () => document.execCommand('redo')

    const insertEmojiShortcode = (name: string) => {
      insertTextAtCursor(`:${name}:`)
    }

    const buildImageMarkup = computed(() => {
      return (emoji: { url: string; short_url?: string }, filename?: string) => {
        const safeUrl = emoji.url
        if (props.inputFormat === 'markdown') {
          const alt = filename || 'image'
          return buildMarkdownImage(alt, emoji)
        }
        return `[img]${safeUrl}[/img]`
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

    const handleEmojiPickerOpen = (event: MouseEvent) => {
      const target = event.currentTarget as HTMLElement | null
      if (target) {
        const rect = target.getBoundingClientRect()
        emojiPickerPos.value = { x: rect.left, y: rect.bottom + 8 }
      } else {
        emojiPickerPos.value = null
      }
      showEmojiPicker.value = true
    }

    const handlePluginEmojiPickerOpen = (event: MouseEvent) => {
      const target = event.currentTarget as HTMLElement | null
      if (target) {
        const rect = target.getBoundingClientRect()
        pluginEmojiPickerPos.value = { x: rect.left, y: rect.bottom + 8 }
      } else {
        pluginEmojiPickerPos.value = null
      }
      showPluginEmojiPicker.value = true
    }

    const handleEmojiSelect = (emoji: { name: string; shortcode: string }) => {
      insertEmojiShortcode(emoji.name)
      showEmojiPicker.value = false
    }

    const handlePluginEmojiSelect = (emoji: { name: string; url: string; short_url?: string }) => {
      const markup = buildImageMarkup.value(emoji, emoji.name)
      insertTextAtCursor(markup)
      showPluginEmojiPicker.value = false
    }

    const { handleUploadClick, handleUploadChange, fileInputRef, uploadFile } = useDiscourseUpload({
      baseUrl: props.baseUrl,
      inputFormat: () => props.inputFormat,
      onInsertText: insertTextAtCursor
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
              <button class="toolbar-btn" onClick={handleEmojiPickerOpen} title="表情">
                🙂
              </button>
              <button class="toolbar-btn" onClick={handlePluginEmojiPickerOpen} title="插件表情">
                ⭐
              </button>
              <button class="toolbar-btn" onClick={handleUploadClick} title="上传文件">
                <UploadOutlined />
              </button>
              <button class="toolbar-btn" onClick={openLinkPanel} title="插入链接">
                <LinkOutlined />
              </button>
              <button class="toolbar-btn" onClick={openImagePanel} title="插入图片">
                <PictureOutlined />
              </button>
              <button class="toolbar-btn" onClick={insertCode} title="行内代码">
                <CodeOutlined />
              </button>
            </div>
            <div class="toolbar-divider" />
            <div class="toolbar-group">
              <button class="toolbar-btn" onClick={insertBlockquote} title="引用">
                <BlockOutlined />
              </button>
              <button class="toolbar-btn" onClick={insertOrderedList} title="有序列表">
                <OrderedListOutlined />
              </button>
              <button class="toolbar-btn" onClick={insertUnorderedList} title="无序列表">
                <UnorderedListOutlined />
              </button>
              <button class="toolbar-btn" onClick={insertHeading} title="标题">
                <BgColorsOutlined />
              </button>
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
                <div class="editor-modal-row">
                  <label class="editor-modal-label">链接地址</label>
                  <input
                    class="editor-modal-input"
                    value={linkUrl.value}
                    onInput={event => {
                      linkUrl.value = (event.target as HTMLInputElement).value
                    }}
                    placeholder="https://"
                  />
                </div>
                <div class="editor-modal-row">
                  <label class="editor-modal-label">显示文本（可选）</label>
                  <input
                    class="editor-modal-input"
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
                <div class="editor-modal-row">
                  <label class="editor-modal-label">图片地址</label>
                  <input
                    class="editor-modal-input"
                    value={imageUrl.value}
                    onInput={event => {
                      imageUrl.value = (event.target as HTMLInputElement).value
                    }}
                    placeholder="https://"
                  />
                </div>
                <div class="editor-modal-row">
                  <label class="editor-modal-label">描述（可选）</label>
                  <input
                    class="editor-modal-input"
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

        <EmojiPicker
          show={showEmojiPicker.value}
          position={emojiPickerPos.value}
          baseUrl={props.baseUrl}
          onSelect={handleEmojiSelect}
          onClose={() => {
            showEmojiPicker.value = false
          }}
        />
        <PluginEmojiPicker
          show={showPluginEmojiPicker.value}
          position={pluginEmojiPickerPos.value}
          onSelect={handlePluginEmojiSelect}
          onClose={() => {
            showPluginEmojiPicker.value = false
          }}
        />
      </>
    )
  }
})
