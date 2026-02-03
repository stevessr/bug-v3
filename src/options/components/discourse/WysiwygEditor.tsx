import { defineComponent, ref, watch, computed, onMounted } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import katex from 'katex'
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

import EmojiPicker from './EmojiPicker'
import PluginEmojiPicker from './PluginEmojiPicker'
import { parseEmojiShortcodeToBBCode, parseEmojiShortcodeToMarkdown, renderBBCode } from './bbcode'
import { useDiscourseUpload } from './composables/useDiscourseUpload'
import './css/EmojiPicker.css'
import './css/PluginEmojiPicker.css'
import './css/ProseMirrorEditor.css'

marked.setOptions({ breaks: true, gfm: true })

export default defineComponent({
  name: 'WysiwygEditor',
  props: {
    modelValue: { type: String, required: true },
    baseUrl: { type: String, default: undefined }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const editorRef = ref<HTMLDivElement | null>(null)
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
    let lastEmittedValue = ''

    const escapeAttr = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')

    const emitValue = (value: string) => {
      lastEmittedValue = value
      emit('update:modelValue', value)
    }

    const renderBBCodeWithMath = (input: string) => {
      if (!input) return ''
      const withEmoji = parseEmojiShortcodeToBBCode(input)

      const mathBlocks: Array<{ tex: string; display: boolean }> = []
      let source = withEmoji.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
        const id = mathBlocks.length
        mathBlocks.push({ tex, display: true })
        return `@@MATH_BLOCK_${id}@@`
      })
      source = source.replace(/(^|[^\\])\$(.+?)\$/g, (_match, prefix, tex) => {
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
          'img'
        ],
        ADD_ATTR: ['class', 'style', 'src', 'alt', 'viewBox']
      })
    }

    const renderMarkdown = (input: string) => {
      if (!input) return ''
      const withEmoji = parseEmojiShortcodeToMarkdown(input)
      const blocks: Array<{ tex: string; display: boolean }> = []
      let source = withEmoji.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
        const id = blocks.length
        blocks.push({ tex, display: true })
        return `@@MATH_BLOCK_${id}@@`
      })
      source = source.replace(/(^|[^\\])\$(.+?)\$/g, (_match, prefix, tex) => {
        const id = blocks.length
        blocks.push({ tex, display: false })
        return `${prefix}@@MATH_INLINE_${id}@@`
      })
      let html = marked.parse(source) as string
      html = html.replace(/@@MATH_(BLOCK|INLINE)_(\d+)@@/g, (_match, kind, index) => {
        const item = blocks[Number(index)]
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
          'img'
        ],
        ADD_ATTR: ['class', 'style', 'src', 'alt', 'viewBox']
      })
    }

    const renderHtml = (input: string) => {
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
          'img'
        ],
        ADD_ATTR: ['class', 'style', 'src', 'alt', 'viewBox']
      })
    }

    const detectHtmlAst = (input: string) => {
      if (!input || !input.includes('<')) return false
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

    const detectMarkdownAst = (input: string) => {
      if (!input) return false
      try {
        const tokens = marked.lexer(input)
        return tokens.some(token => token.type !== 'space')
      } catch {
        return false
      }
    }

    const detectBbcodeAst = (input: string) => {
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

    const convertToHtml = (value: string) => {
      if (!value) return ''
      if (detectHtmlAst(value)) return renderHtml(value)
      if (detectBbcodeAst(value)) return renderBBCodeWithMath(value)
      if (detectMarkdownAst(value)) return renderMarkdown(value)
      return renderMarkdown(value)
    }

    const isPlainTextHtml = (value: string) => {
      if (!value) return true
      try {
        const container = document.createElement('div')
        container.innerHTML = value
        const elements = Array.from(container.querySelectorAll('*'))
        return elements.every(el => {
          const tag = el.tagName.toLowerCase()
          return tag === 'br' || tag === 'div' || tag === 'p' || tag === 'span'
        })
      } catch {
        return false
      }
    }

    const readEditorHtml = () => editorRef.value?.innerHTML ?? ''

    const normalizeHtml = (value: string) => {
      const trimmed = value.trim()
      if (trimmed === '<br>' || trimmed === '<div><br></div>') return ''
      return value
    }

    const syncEditorHtml = (value: string) => {
      if (!editorRef.value) return
      const html = convertToHtml(value)
      if (html === editorRef.value.innerHTML) return
      editorRef.value.innerHTML = html
    }

    const handleInput = () => {
      const html = normalizeHtml(readEditorHtml())
      const plainText = editorRef.value?.innerText?.replace(/\u00a0/g, ' ') ?? ''
      if (html && isPlainTextHtml(html)) {
        const trimmed = plainText.trim()
        if (trimmed && (detectBbcodeAst(trimmed) || detectMarkdownAst(trimmed))) {
          const converted = convertToHtml(trimmed)
          if (editorRef.value) {
            editorRef.value.innerHTML = converted
          }
          emitValue(converted)
          return
        }
      }
      emitValue(html)
    }

    const execCommand = (command: string, value?: string) => {
      editorRef.value?.focus()
      document.execCommand(command, false, value)
      handleInput()
    }

    const insertHtml = (html: string) => {
      editorRef.value?.focus()
      document.execCommand('insertHTML', false, html)
      handleInput()
    }

    const insertText = (text: string) => {
      editorRef.value?.focus()
      document.execCommand('insertText', false, text)
      handleInput()
    }

    const wrapSelection = (prefix: string, suffix: string) => {
      const editor = editorRef.value
      if (!editor) {
        insertText(`${prefix}${suffix}`)
        return
      }
      editor.focus()
      const selection = window.getSelection()
      if (
        !selection ||
        selection.rangeCount === 0 ||
        !selection.anchorNode ||
        !editor.contains(selection.anchorNode)
      ) {
        insertText(`${prefix}${suffix}`)
        return
      }
      const range = selection.getRangeAt(0)
      const selectedText = range.toString()
      const textNode = document.createTextNode(`${prefix}${selectedText}${suffix}`)
      range.deleteContents()
      range.insertNode(textNode)
      const newRange = document.createRange()
      const cursorPosition = selectedText ? (textNode.nodeValue?.length ?? 0) : prefix.length
      newRange.setStart(textNode, cursorPosition)
      newRange.setEnd(textNode, cursorPosition)
      selection.removeAllRanges()
      selection.addRange(newRange)
      handleInput()
    }

    const toggleBold = () => wrapSelection('**', '**')
    const toggleItalic = () => wrapSelection('*', '*')
    const toggleUnderline = () => wrapSelection('<u>', '</u>')
    const toggleStrike = () => wrapSelection('~~', '~~')
    const insertCode = () => execCommand('formatBlock', 'pre')
    const insertBlockquote = () => execCommand('formatBlock', 'blockquote')

    const insertOrderedList = () => execCommand('insertOrderedList')
    const insertUnorderedList = () => execCommand('insertUnorderedList')

    const insertHeadingLevel = (level: number) => {
      const hashes = '#'.repeat(level)
      wrapSelection(`\n${hashes} `, '\n')
    }

    const insertTable = () => {
      insertText(`\n| 列 1 | 列 2 |\n| --- | --- |\n| 内容 1 | 内容 2 |\n`)
    }

    const insertDetails = () => {
      wrapSelection('[details="详细信息"]\n', '\n[/details]')
    }

    const insertSpoiler = () => {
      wrapSelection('[spoiler]', '[/spoiler]')
    }

    const insertPoll = () => {
      insertText(`\n[poll]\n* 选项一\n* 选项二\n[/poll]\n`)
    }

    const insertFootnote = () => {
      wrapSelection('^[', ']')
    }

    const insertMathInline = () => {
      wrapSelection('$', '$')
    }

    const insertMathBlock = () => {
      insertText(`\n$$\nE=mc^2\n$$\n`)
    }

    const insertMermaid = () => {
      insertText(`\n\`\`\`mermaid height=200\ngraph TD;\n  A --> B;\n\`\`\`\n`)
    }

    const insertScrollable = () => {
      insertText(`\n[wrap=scrollable]\n在这里填写内容\n[/wrap]\n`)
    }

    const insertAppWrap = () => {
      insertText(`\n[wrap=app]\n在这里填写内容\n[/wrap]\n`)
    }

    const undoAction = () => execCommand('undo')
    const redoAction = () => execCommand('redo')

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
      insertText(`[${text}](${url}) `)
      closePanels()
    }

    const insertImageMarkup = () => {
      const url = imageUrl.value.trim()
      if (!url) return
      const alt = imageAlt.value.trim() || 'image'
      insertText(`![${alt}](${url}) `)
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

    const handleEmojiSelect = (emoji: { name: string; shortcode: string; url: string }) => {
      const safeUrl = escapeAttr(emoji.url)
      const safeAlt = escapeAttr(emoji.name)
      insertHtml(`<img src="${safeUrl}" alt=":${safeAlt}:" /> `)
      showEmojiPicker.value = false
    }

    const handlePluginEmojiSelect = (emoji: { name: string; url: string }) => {
      const safeUrl = escapeAttr(emoji.url)
      const safeAlt = escapeAttr(emoji.name)
      insertHtml(`<img src="${safeUrl}" alt=":${safeAlt}:" /> `)
      showPluginEmojiPicker.value = false
    }

    const { handleUploadClick, handleUploadChange, fileInputRef, uploadFile } = useDiscourseUpload({
      baseUrl: props.baseUrl,
      inputFormat: () => 'markdown',
      onInsertText: insertText
    })

    const handleEditorPaste = async (event: ClipboardEvent) => {
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

    const handleEditorKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        event.preventDefault()
        insertText('  ')
      }
    }

    watch(
      () => props.modelValue,
      value => {
        const nextValue = value || ''
        if (!editorRef.value) return
        if (nextValue === lastEmittedValue) return
        const html = convertToHtml(nextValue)
        if (html !== nextValue) {
          syncEditorHtml(html)
          emitValue(html)
          return
        }
        syncEditorHtml(nextValue)
      }
    )

    onMounted(() => {
      const initialValue = props.modelValue || ''
      const html = convertToHtml(initialValue)
      syncEditorHtml(html)
      if (html !== initialValue) {
        emitValue(html)
      }
    })

    const placeholderText = computed(() =>
      props.modelValue?.trim() ? '' : '在此处输入。所见即所得模式下将输出 HTML。'
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
              <button class="toolbar-btn" onClick={insertCode} title="代码块">
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
            </div>
            <div class="toolbar-divider" />
            <div class="toolbar-group">
              <button class="toolbar-btn" onClick={() => insertHeadingLevel(1)} title="一级标题">
                H1
              </button>
              <button class="toolbar-btn" onClick={() => insertHeadingLevel(2)} title="二级标题">
                H2
              </button>
              <button class="toolbar-btn" onClick={() => insertHeadingLevel(3)} title="三级标题">
                H3
              </button>
              <button class="toolbar-btn" onClick={insertTable} title="表格">
                表格
              </button>
              <button class="toolbar-btn" onClick={insertDetails} title="隐藏详细信息">
                详情
              </button>
              <button class="toolbar-btn" onClick={insertSpoiler} title="剧透">
                剧透
              </button>
            </div>
            <div class="toolbar-group">
              <button class="toolbar-btn" onClick={insertPoll} title="投票">
                投票
              </button>
              <button class="toolbar-btn" onClick={insertFootnote} title="脚注">
                脚注
              </button>
              <button class="toolbar-btn" onClick={insertMathInline} title="公式（行内）">
                公式
              </button>
              <button class="toolbar-btn" onClick={insertMathBlock} title="公式（块）">
                公式块
              </button>
              <button class="toolbar-btn" onClick={insertMermaid} title="Mermaid 图表">
                Mermaid
              </button>
              <button class="toolbar-btn" onClick={insertScrollable} title="滚动内容">
                滚动
              </button>
              <button class="toolbar-btn" onClick={insertAppWrap} title="应用包装">
                应用
              </button>
            </div>
          </div>
          <div class="prosemirror-editor wysiwyg-editor">
            <div
              ref={editorRef}
              class="ProseMirror wysiwyg-editor-content"
              contenteditable
              data-placeholder={placeholderText.value}
              aria-label="所见即所得编辑器"
              onInput={handleInput}
              onPaste={handleEditorPaste}
              onKeydown={handleEditorKeydown}
            />
          </div>

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
