/* @jsxImportSource vue */
import { defineComponent, ref, watch, computed, onMounted } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import katex from 'katex'

import EmojiPicker from './EmojiPicker'
import PluginEmojiPicker from './PluginEmojiPicker'
import ForumTemplatePicker from './ForumTemplatePicker'
import WysiwygEditorToolbar from './WysiwygEditorToolbar'
import WysiwygEditorDialogs from './WysiwygEditorDialogs'
import { decodeDiscourseDraftSource, encodeDiscourseDraftSource } from './discourseDrafts'

import { renderDiscourseMarkdown } from '@/options/components/discourse/bbcode/renderDiscourse'
import { useDiscourseUpload } from '@/options/components/discourse/composables/useDiscourseUpload'
import './styles/EmojiPicker.css'
import './styles/PluginEmojiPicker.css'
import './styles/ProseMirrorEditor.css'

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
    const showTableAssistant = ref(false)
    const tableRows = ref(3)
    const tableColumns = ref(3)
    const tableHasHeader = ref(true)
    const tableGrid = ref<string[][]>([])
    const tableContextMenu = ref({ open: false, x: 0, y: 0, row: 0, column: 0 })
    const tableClipboard = ref<{ axis: 'row' | 'column'; values: string[] } | null>(null)
    const showPollAssistant = ref(false)
    const pollQuestion = ref('')
    const pollOptions = ref('选项一\n选项二')
    const pollType = ref<'regular' | 'multiple' | 'number'>('regular')
    const pollResults = ref<'always' | 'on_close'>('always')
    const showFormulaAssistant = ref(false)
    const formula = ref('E = mc^2')
    const formulaDisplay = ref<'inline' | 'block'>('inline')
    const formulaWysiwyg = ref(true)
    const showWrapAssistant = ref(false)
    const wrapMode = ref<'scrollable' | 'app'>('scrollable')
    const wrapContent = ref('在这里填写内容')
    const showTemplatePicker = ref(false)
    let lastEmittedValue = ''
    let savedSelectionRange: Range | null = null

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

    const renderMarkdown = renderDiscourseMarkdown

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
          'data-topic',
          'data-discourse-draft',
          'data-discourse-source',
          'data-wrap-mode'
        ]
      })
    }

    const detectHtmlAst = (input: string) => {
      // 避免误判：只有出现真正的 HTML 标签（< 后跟字母 / / !）才走 HTML 渲染
      // 例如 `a < b`、`$x<y$` 仍是纯文本/markdown
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
        'ins',
        'del',
        'sub',
        'sup',
        'mark',
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
        'details',
        'wrap',
        'poll',
        'tabs',
        'tab',
        'table',
        'video',
        'audio',
        'youtube',
        'tip',
        'note',
        'warning',
        'footnote',
        'mermaid',
        'mention',
        'emoji',
        'hr'
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
      // 统一走增强 markdown 渲染：内置全部 Discourse BBCode 预处理（嵌套/多行/官方结构）
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

    const captureEditorSelection = () => {
      const editor = editorRef.value
      const selection = window.getSelection()
      if (
        !editor ||
        !selection?.rangeCount ||
        !selection.anchorNode ||
        !editor.contains(selection.anchorNode)
      ) {
        return
      }
      savedSelectionRange = selection.getRangeAt(0).cloneRange()
    }

    const focusEditorAtSavedSelection = () => {
      const editor = editorRef.value
      if (!editor) return
      editor.focus()
      if (!savedSelectionRange) return
      const selection = window.getSelection()
      try {
        selection?.removeAllRanges()
        selection?.addRange(savedSelectionRange)
      } catch {
        savedSelectionRange = null
      }
    }

    const readEditorHtml = () => editorRef.value?.innerHTML ?? ''

    const normalizeHtml = (value: string) => {
      const trimmed = value.trim()
      if (trimmed === '<br>' || trimmed === '<div><br></div>') return ''
      return value
    }

    const draftText = (element: HTMLElement) => {
      const clone = element.cloneNode(true) as HTMLElement
      clone.querySelectorAll<HTMLElement>('[data-discourse-source]').forEach(node => {
        const source = decodeDiscourseDraftSource(node.dataset.discourseSource || null)
        if (source) node.replaceWith(document.createTextNode(source))
      })
      return (clone.innerText || clone.textContent || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    }

    const refreshDiscourseDraftSources = () => {
      const editor = editorRef.value
      if (!editor) return

      editor.querySelectorAll<HTMLElement>('[data-discourse-draft]').forEach(element => {
        const kind = element.dataset.discourseDraft
        if (kind === 'spoiler') {
          const source = `[spoiler]\n${draftText(element)}\n[/spoiler]`
          element.dataset.discourseSource = encodeDiscourseDraftSource(source)
          return
        }

        if (kind === 'details') {
          const summary = element.querySelector('summary')?.textContent?.trim() || '详细信息'
          const content = element.querySelector<HTMLElement>('.wysiwyg-details-content')
          const source = `[details="${summary.replace(/"/g, '\\"')}"]\n${
            content ? draftText(content) : ''
          }\n[/details]`
          element.dataset.discourseSource = encodeDiscourseDraftSource(source)
          return
        }

        if (kind === 'table') {
          const rows = Array.from(element.querySelectorAll('tr'))
            .map(row =>
              Array.from(row.querySelectorAll('th, td'))
                .map(cell => (cell.textContent || '').replace(/\|/g, '\\|').trim())
                .join(' | ')
            )
            .filter(Boolean)
          if (rows.length === 0) return
          const hasHeader = element.querySelector('thead') !== null
          const lines = rows.map((row, index) => {
            const cells = row.split(' | ')
            const line = `| ${cells.join(' | ')} |`
            if (hasHeader && index === 0) {
              return `${line}\n| ${cells.map(() => '---').join(' | ')} |`
            }
            return line
          })
          element.dataset.discourseSource = encodeDiscourseDraftSource(
            `[table]\n${lines.join('\n')}\n[/table]`
          )
          return
        }

        if (kind === 'wrap') {
          const mode = element.dataset.wrapMode || 'scrollable'
          element.dataset.discourseSource = encodeDiscourseDraftSource(
            `[wrap=${mode}]\n${draftText(element)}\n[/wrap]`
          )
          return
        }

        if (kind === 'mermaid') {
          const code = element.querySelector('code')?.textContent || element.textContent || ''
          element.dataset.discourseSource = encodeDiscourseDraftSource(
            `\`\`\`mermaid\n${code.replace(/\n+$/, '')}\n\`\`\``
          )
          return
        }

        if (kind === 'poll' || kind === 'formula') {
          // These blocks retain their canonical Discourse syntax in the data
          // attribute while the visible draft remains a presentation preview.
          return
        }
      })
    }

    const syncEditorHtml = (value: string) => {
      if (!editorRef.value) return
      const html = convertToHtml(value)
      if (html === editorRef.value.innerHTML) return
      editorRef.value.innerHTML = html
    }

    const handleInput = () => {
      refreshDiscourseDraftSources()
      const html = normalizeHtml(readEditorHtml())
      const plainText = editorRef.value?.innerText?.replace(/\u00a0/g, ' ') ?? ''
      const containsDraftBlock = Boolean(editorRef.value?.querySelector('[data-discourse-draft]'))
      if (html && !containsDraftBlock && isPlainTextHtml(html)) {
        const trimmed = plainText.trim()
        if (trimmed && (detectBbcodeAst(trimmed) || detectMarkdownAst(trimmed))) {
          const converted = convertToHtml(trimmed)
          if (editorRef.value) {
            editorRef.value.innerHTML = converted
          }
          emitValue(converted)
          captureEditorSelection()
          return
        }
      }
      emitValue(html)
      captureEditorSelection()
    }

    const execCommand = (command: string, value?: string) => {
      focusEditorAtSavedSelection()
      if (document.queryCommandSupported(command)) {
        document.execCommand(command, false, value)
      }
      handleInput()
    }

    const insertHtml = (html: string) => {
      focusEditorAtSavedSelection()
      if (document.queryCommandSupported('insertHTML')) {
        document.execCommand('insertHTML', false, html)
      }
      handleInput()
    }

    const insertText = (text: string) => {
      focusEditorAtSavedSelection()
      if (document.queryCommandSupported('insertText')) {
        document.execCommand('insertText', false, text)
      }
      handleInput()
    }

    const wrapSelection = (prefix: string, suffix: string) => {
      const editor = editorRef.value
      if (!editor) {
        insertText(`${prefix}${suffix}`)
        return
      }
      focusEditorAtSavedSelection()
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

    const selectedEditorText = () => {
      const selection = window.getSelection()
      if (
        !selection?.rangeCount ||
        !selection.anchorNode ||
        !editorRef.value?.contains(selection.anchorNode)
      ) {
        return ''
      }
      return selection.toString().trim()
    }

    const moveCaretAfterDraftBlock = () => {
      const editor = editorRef.value
      if (!editor) return
      focusEditorAtSavedSelection()
      const selection = window.getSelection()
      const candidateNodes = [selection?.anchorNode, savedSelectionRange?.startContainer].filter(
        Boolean
      ) as Node[]
      const block = candidateNodes
        .map(anchor =>
          (anchor.nodeType === Node.ELEMENT_NODE
            ? (anchor as HTMLElement)
            : anchor.parentElement
          )?.closest<HTMLElement>(
            '.wysiwyg-spoiler-draft, .wysiwyg-details-draft, .discourse-poll-draft, .discourse-formula-draft, .wysiwyg-wrap-draft, .wysiwyg-mermaid-draft'
          )
        )
        .find(Boolean)
      if (!block || !editor.contains(block) || !selection) return
      const range = document.createRange()
      range.setStartAfter(block)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
      savedSelectionRange = range.cloneRange()
    }

    const closeAssistants = () => {
      showTableAssistant.value = false
      showPollAssistant.value = false
      showFormulaAssistant.value = false
      showWrapAssistant.value = false
    }

    const openTableAssistant = () => {
      captureEditorSelection()
      closePanels()
      closeAssistants()
      tableGrid.value = Array.from(
        { length: tableRows.value + (tableHasHeader.value ? 1 : 0) },
        (_, rowIndex) =>
          Array.from({ length: tableColumns.value }, (_, columnIndex) =>
            rowIndex === 0 && tableHasHeader.value
              ? `列 ${columnIndex + 1}`
              : `内容 ${rowIndex + 1}-${columnIndex + 1}`
          )
      )
      tableContextMenu.value.open = false
      showTableAssistant.value = true
    }

    const resizeTableGrid = (dataRows: number, columns: number) => {
      const rows = dataRows + (tableHasHeader.value ? 1 : 0)
      const next = Array.from({ length: rows }, (_, rowIndex) =>
        Array.from(
          { length: columns },
          (_, columnIndex) =>
            tableGrid.value[rowIndex]?.[columnIndex] ??
            (rowIndex === 0 && tableHasHeader.value
              ? `列 ${columnIndex + 1}`
              : `内容 ${rowIndex + 1}-${columnIndex + 1}`)
        )
      )
      tableGrid.value = next
      tableRows.value = dataRows
      tableColumns.value = columns
    }

    const onTableCellInput = (row: number, column: number, value: string) => {
      if (!tableGrid.value[row] || tableGrid.value[row][column] === undefined) return
      tableGrid.value[row][column] = value
    }

    const onTableContextMenu = (event: MouseEvent, row: number, column: number) => {
      event.preventDefault()
      const target = event.currentTarget as HTMLElement
      const rect = target.getBoundingClientRect()
      const maxX = Math.max(8, window.innerWidth - 250)
      const maxY = Math.max(8, window.innerHeight - 380)
      tableContextMenu.value = {
        open: true,
        x: Math.min(Math.max(8, event.clientX || rect.left), maxX),
        y: Math.min(Math.max(8, event.clientY || rect.bottom), maxY),
        row,
        column
      }
    }

    const closeTableContextMenu = () => {
      tableContextMenu.value.open = false
    }

    const tableContextAction = (
      action:
        | 'insert-row-before'
        | 'insert-row-after'
        | 'delete-row'
        | 'move-row-up'
        | 'move-row-down'
        | 'copy-row'
        | 'paste-row'
        | 'insert-column-before'
        | 'insert-column-after'
        | 'delete-column'
        | 'move-column-left'
        | 'move-column-right'
        | 'copy-column'
        | 'paste-column'
    ) => {
      const { row, column } = tableContextMenu.value
      const grid = tableGrid.value.map(item => [...item])
      if (!grid.length || !grid[0]?.length) return
      const rowCount = grid.length
      const columnCount = grid[0].length
      const isRowAction = action.includes('row')
      const clipboard = tableClipboard.value
      if (isRowAction) {
        if (action === 'copy-row') {
          tableClipboard.value = { axis: 'row', values: [...grid[row]] }
        } else if (action === 'paste-row' && clipboard?.axis === 'row') {
          grid.splice(
            row,
            1,
            Array.from({ length: columnCount }, (_, index) => clipboard.values[index] ?? '')
          )
        } else if (action === 'insert-row-before' || action === 'insert-row-after') {
          const target = action.endsWith('before') ? row : row + 1
          grid.splice(
            target,
            0,
            Array.from({ length: columnCount }, (_, index) => `内容 ${target + 1}-${index + 1}`)
          )
        } else if (action === 'delete-row' && rowCount > 1) {
          grid.splice(row, 1)
        } else if (action === 'move-row-up' && row > 0) {
          ;[grid[row - 1], grid[row]] = [grid[row], grid[row - 1]]
        } else if (action === 'move-row-down' && row < rowCount - 1) {
          ;[grid[row + 1], grid[row]] = [grid[row], grid[row + 1]]
        }
      } else {
        if (action === 'copy-column') {
          tableClipboard.value = { axis: 'column', values: grid.map(item => item[column] ?? '') }
        } else if (action === 'paste-column' && clipboard?.axis === 'column') {
          grid.forEach((item, index) => {
            item[column] = clipboard.values[index] ?? ''
          })
        } else if (action === 'insert-column-before' || action === 'insert-column-after') {
          const target = action.endsWith('before') ? column : column + 1
          grid.forEach((item, index) => item.splice(target, 0, `内容 ${index + 1}-${target + 1}`))
        } else if (action === 'delete-column' && columnCount > 1) {
          grid.forEach(item => item.splice(column, 1))
        } else if (action === 'move-column-left' && column > 0) {
          grid.forEach(item => {
            ;[item[column - 1], item[column]] = [item[column], item[column - 1]]
          })
        } else if (action === 'move-column-right' && column < columnCount - 1) {
          grid.forEach(item => {
            ;[item[column + 1], item[column]] = [item[column], item[column + 1]]
          })
        }
      }
      const nextRow = Math.min(row, Math.max(0, grid.length - 1))
      const nextColumn = Math.min(column, Math.max(0, (grid[0]?.length || 1) - 1))
      tableGrid.value = grid
      tableRows.value = Math.max(1, grid.length - (tableHasHeader.value ? 1 : 0))
      tableColumns.value = grid[0]?.length || 1
      tableContextMenu.value = {
        ...tableContextMenu.value,
        open: false,
        row: nextRow,
        column: nextColumn
      }
    }

    const insertTable = () => {
      const rows = Math.min(20, Math.max(1, Math.round(tableRows.value || 1)))
      const columns = Math.min(12, Math.max(1, Math.round(tableColumns.value || 1)))
      const expectedGridRows = rows + (tableHasHeader.value ? 1 : 0)
      const grid =
        tableGrid.value.length === expectedGridRows && tableGrid.value[0]?.length === columns
          ? tableGrid.value
          : Array.from({ length: expectedGridRows }, (_, rowIndex) =>
              Array.from({ length: columns }, (_, columnIndex) =>
                rowIndex === 0 && tableHasHeader.value
                  ? `列 ${columnIndex + 1}`
                  : `内容 ${rowIndex + 1}-${columnIndex + 1}`
              )
            )
      const headers = tableHasHeader.value ? [...grid[0]] : []
      const bodyRows = tableHasHeader.value ? grid.slice(1) : grid
      const sourceRows = tableHasHeader.value
        ? [headers, Array.from({ length: columns }, () => '---'), ...bodyRows]
        : bodyRows
      const source = `[table]\n${sourceRows
        .map(row => `| ${row.join(' | ')} |`)
        .join('\n')}\n[/table]`
      const headerHtml = tableHasHeader.value
        ? `<thead><tr>${headers.map(cell => `<th>${escapeAttr(cell)}</th>`).join('')}</tr></thead>`
        : ''
      const bodyHtml = `<tbody>${bodyRows
        .map(row => `<tr>${row.map(cell => `<td>${escapeAttr(cell)}</td>`).join('')}</tr>`)
        .join('')}</tbody>`
      insertHtml(
        `<table class="wysiwyg-table-draft" data-discourse-draft="table" data-discourse-source="${encodeDiscourseDraftSource(source)}">${headerHtml}${bodyHtml}</table><p><br></p>`
      )
      closeAssistants()
    }

    const insertDetails = () => {
      const selected = selectedEditorText()
      const source = `[details="详细信息"]\n${selected}\n[/details]`
      insertHtml(
        `<details open class="wysiwyg-details-draft" data-discourse-draft="details" data-discourse-source="${encodeDiscourseDraftSource(source)}"><summary>详细信息</summary><div class="wysiwyg-details-content"><p>${selected ? escapeAttr(selected) : '<br>'}</p></div></details><p><br></p>`
      )
    }

    const insertSpoiler = () => {
      const selected = selectedEditorText()
      const source = `[spoiler]\n${selected}\n[/spoiler]`
      insertHtml(
        `<div class="spoiler wysiwyg-spoiler-draft" data-discourse-draft="spoiler" data-discourse-source="${encodeDiscourseDraftSource(source)}"><p>${selected ? escapeAttr(selected) : '<br>'}</p></div><p><br></p>`
      )
    }

    const insertPoll = () => {
      const question = pollQuestion.value.trim()
      const options = pollOptions.value
        .split(/\r?\n/)
        .map(option => option.trim())
        .filter(Boolean)
      if (!question || (pollType.value !== 'number' && options.length < 2)) return
      moveCaretAfterDraftBlock()

      const source =
        pollType.value === 'number'
          ? `[poll type=number min=1 max=10 step=1 results=${pollResults.value}]\n# ${question}\n[/poll]`
          : `[poll type=${pollType.value} results=${pollResults.value} chartType=bar]\n# ${question}\n${options
              .map(option => `* ${option}`)
              .join('\n')}\n[/poll]`
      const description =
        pollType.value === 'multiple'
          ? '多选 · 发布后由 Discourse 统计'
          : pollType.value === 'number'
            ? '数字评分 · 1–10'
            : '单选 · 发布后由 Discourse 统计'
      const optionsHtml =
        pollType.value === 'number'
          ? '<div class="discourse-poll-draft__scale">1&nbsp;&nbsp;2&nbsp;&nbsp;3&nbsp;&nbsp;4&nbsp;&nbsp;5&nbsp;&nbsp;6&nbsp;&nbsp;7&nbsp;&nbsp;8&nbsp;&nbsp;9&nbsp;&nbsp;10</div>'
          : `<ol>${options.map(option => `<li>${escapeAttr(option)}</li>`).join('')}</ol>`
      insertHtml(
        `<section class="poll discourse-poll-draft" contenteditable="false" data-discourse-draft="poll" data-discourse-source="${encodeDiscourseDraftSource(source)}"><strong>${escapeAttr(question)}</strong>${optionsHtml}<small>${description}</small></section><p><br></p>`
      )
      closeAssistants()
    }

    const insertFootnote = () => {
      const selected = selectedEditorText() || '脚注内容'
      const source = `^[${selected}]`
      insertHtml(
        `<span class="footnote wysiwyg-footnote-draft" contenteditable="false" title="${escapeAttr(selected)}" data-discourse-draft="footnote" data-discourse-source="${encodeDiscourseDraftSource(source)}">${escapeAttr(selected)}</span>&nbsp;`
      )
    }

    const openFormulaAssistant = () => {
      captureEditorSelection()
      closePanels()
      closeAssistants()
      const selected = selectedEditorText()
      if (selected) formula.value = selected
      showFormulaAssistant.value = true
    }

    const insertFormula = () => {
      const value = formula.value.trim()
      if (!value) return
      const source = formulaDisplay.value === 'block' ? `$$\n${value}\n$$` : `$${value}$`
      const displayClass = formulaDisplay.value === 'block' ? 'is-block' : 'is-inline'
      moveCaretAfterDraftBlock()
      const renderedFormula = formulaWysiwyg.value
        ? katex.renderToString(value, {
            displayMode: formulaDisplay.value === 'block',
            throwOnError: false
          })
        : escapeAttr(value)
      insertHtml(
        `<span class="discourse-formula-draft ${displayClass} ${formulaWysiwyg.value ? 'is-wysiwyg' : 'is-source'}" contenteditable="false" data-discourse-draft="formula" data-discourse-source="${encodeDiscourseDraftSource(source)}">${renderedFormula}</span>${formulaDisplay.value === 'block' ? '<p><br></p>' : '&nbsp;'}`
      )
      closeAssistants()
    }

    const insertMermaid = () => {
      const source = '```mermaid\ngraph TD;\n  A --> B;\n```'
      moveCaretAfterDraftBlock()
      insertHtml(
        `<pre class="wysiwyg-mermaid-draft" data-discourse-draft="mermaid" data-discourse-source="${encodeDiscourseDraftSource(source)}"><code class="lang-mermaid">graph TD;\n  A --&gt; B;</code></pre><p><br></p>`
      )
    }

    const openWrapAssistant = (mode: 'scrollable' | 'app') => {
      captureEditorSelection()
      closePanels()
      closeAssistants()
      wrapMode.value = mode
      wrapContent.value = selectedEditorText() || '在这里填写内容'
      showWrapAssistant.value = true
    }

    const insertWrap = () => {
      const content = wrapContent.value.trim()
      if (!content) return
      moveCaretAfterDraftBlock()
      const source = `[wrap=${wrapMode.value}]\n${content}\n[/wrap]`
      const visibleContent = escapeAttr(content).replace(/\r?\n/g, '<br>')
      insertHtml(
        `<div class="d-wrap d-wrap-${escapeAttr(wrapMode.value)} wysiwyg-wrap-draft" data-discourse-draft="wrap" data-wrap-mode="${escapeAttr(wrapMode.value)}" data-discourse-source="${encodeDiscourseDraftSource(source)}">${visibleContent}</div><p><br></p>`
      )
      closeAssistants()
    }

    const insertScrollable = () => openWrapAssistant('scrollable')

    const insertAppWrap = () => openWrapAssistant('app')

    const undoAction = () => execCommand('undo')
    const redoAction = () => execCommand('redo')

    const openLinkPanel = () => {
      captureEditorSelection()
      showLinkPanel.value = true
      showImagePanel.value = false
      closeAssistants()
    }

    const openImagePanel = () => {
      captureEditorSelection()
      showImagePanel.value = true
      showLinkPanel.value = false
      closeAssistants()
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

    const handleEmojiPickerOpen = (event?: MouseEvent) => {
      captureEditorSelection()
      const target = event?.currentTarget as HTMLElement | null | undefined
      if (target) {
        const rect = target.getBoundingClientRect()
        emojiPickerPos.value = { x: rect.left, y: rect.bottom + 8 }
      } else {
        emojiPickerPos.value = null
      }
      showEmojiPicker.value = true
    }

    const handlePluginEmojiPickerOpen = (event?: MouseEvent) => {
      captureEditorSelection()
      const target = event?.currentTarget as HTMLElement | null | undefined
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

    const handlePluginEmojiSelect = (emoji: { name: string; url: string; short_url?: string }) => {
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

    const openTemplatePicker = () => {
      captureEditorSelection()
      closePanels()
      closeAssistants()
      showEmojiPicker.value = false
      showPluginEmojiPicker.value = false
      showTemplatePicker.value = true
    }

    const insertForumTemplate = (template: { content: string }) => {
      const content = template.content.trim()
      if (!content) return
      insertText(content)
    }

    const handleEditorKeydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'i') {
        event.preventDefault()
        openTemplatePicker()
        return
      }
      if (event.key === 'Tab') {
        event.preventDefault()
        insertText('  ')
        return
      }

      if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
      const selection = window.getSelection()
      const anchor = selection?.anchorNode
      const anchorElement =
        anchor?.nodeType === Node.ELEMENT_NODE
          ? (anchor as HTMLElement)
          : anchor?.parentElement || null
      const spoiler = anchorElement?.closest<HTMLElement>('.wysiwyg-spoiler-draft, .spoiler')
      if (!spoiler || !editorRef.value?.contains(spoiler)) return

      // A native contenteditable block split can place the new paragraph after
      // `.spoiler`, making the spoiler appear to disappear. Insert a line break
      // at the current range instead so the caret and every following line stay
      // inside the spoiler draft.
      event.preventDefault()
      editorRef.value?.focus()
      if (document.queryCommandSupported('insertLineBreak')) {
        document.execCommand('insertLineBreak', false)
      } else {
        document.execCommand('insertHTML', false, '<br>')
      }
      handleInput()
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

    const toolbarActions = {
      undo: undoAction,
      redo: redoAction,
      toggleBold,
      toggleItalic,
      toggleUnderline,
      toggleStrike,
      openEmojiPicker: handleEmojiPickerOpen,
      openPluginEmojiPicker: handlePluginEmojiPickerOpen,
      handleUploadClick,
      openLinkPanel,
      openImagePanel,
      insertCode,
      insertBlockquote,
      insertOrderedList,
      insertUnorderedList,
      insertHeadingLevel,
      openTableAssistant,
      insertDetails,
      insertSpoiler,
      openTemplatePicker,
      openPollAssistant: () => {
        captureEditorSelection()
        closePanels()
        closeAssistants()
        showPollAssistant.value = true
      },
      insertFootnote,
      openFormulaAssistant,
      insertMermaid,
      insertScrollable,
      insertAppWrap
    }

    const dialogState = computed(() => ({
      showLinkPanel: showLinkPanel.value,
      showImagePanel: showImagePanel.value,
      showTableAssistant: showTableAssistant.value,
      showPollAssistant: showPollAssistant.value,
      showFormulaAssistant: showFormulaAssistant.value,
      showWrapAssistant: showWrapAssistant.value,
      linkUrl: linkUrl.value,
      linkText: linkText.value,
      imageUrl: imageUrl.value,
      imageAlt: imageAlt.value,
      tableRows: tableRows.value,
      tableColumns: tableColumns.value,
      tableHasHeader: tableHasHeader.value,
      tableGrid: tableGrid.value,
      tableContextMenu: tableContextMenu.value,
      pollQuestion: pollQuestion.value,
      pollOptions: pollOptions.value,
      pollType: pollType.value,
      pollResults: pollResults.value,
      formula: formula.value,
      formulaDisplay: formulaDisplay.value,
      formulaWysiwyg: formulaWysiwyg.value,
      formulaPreviewHtml: formulaWysiwyg.value
        ? katex.renderToString(formula.value, {
            displayMode: formulaDisplay.value === 'block',
            throwOnError: false
          })
        : '',
      wrapMode: wrapMode.value,
      wrapContent: wrapContent.value
    }))

    const dialogActions = {
      openLinkPanel,
      openImagePanel,
      closePanels,
      insertLink: insertLinkMarkup,
      insertImage: insertImageMarkup,
      onLinkInput: (value: string) => (linkUrl.value = value),
      onLinkTextInput: (value: string) => (linkText.value = value),
      onImageInput: (value: string) => (imageUrl.value = value),
      onImageAltInput: (value: string) => (imageAlt.value = value),
      closeTableAssistant: () => (showTableAssistant.value = false),
      insertTable,
      onTableRowsInput: (value: number) =>
        resizeTableGrid(Math.min(20, Math.max(1, Math.round(value || 1))), tableColumns.value),
      onTableColumnsInput: (value: number) =>
        resizeTableGrid(tableRows.value, Math.min(12, Math.max(1, Math.round(value || 1)))),
      onTableHeaderChange: (value: boolean) => {
        tableHasHeader.value = value
        resizeTableGrid(tableRows.value, tableColumns.value)
      },
      onTableCellInput,
      onTableContextMenu,
      closeTableContextMenu,
      tableContextAction,
      closePollAssistant: () => (showPollAssistant.value = false),
      insertPoll,
      onPollQuestionInput: (value: string) => (pollQuestion.value = value),
      onPollOptionsInput: (value: string) => (pollOptions.value = value),
      onPollTypeInput: (value: 'regular' | 'multiple' | 'number') => (pollType.value = value),
      onPollResultsInput: (value: 'always' | 'on_close') => (pollResults.value = value),
      closeFormulaAssistant: () => (showFormulaAssistant.value = false),
      insertFormula,
      onFormulaInput: (value: string) => (formula.value = value),
      onFormulaDisplayInput: (value: 'inline' | 'block') => (formulaDisplay.value = value),
      onFormulaWysiwygInput: (value: boolean) => (formulaWysiwyg.value = value),
      closeWrapAssistant: () => (showWrapAssistant.value = false),
      insertWrap,
      onWrapModeInput: (value: string) => {
        if (value === 'app' || value === 'scrollable') wrapMode.value = value
      },
      onWrapContentInput: (value: string) => (wrapContent.value = value)
    }

    return () => (
      <>
        <div class="prosemirror-editor-wrapper">
          <WysiwygEditorToolbar actions={toolbarActions} />
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
        </div>

        <WysiwygEditorDialogs state={dialogState.value} actions={dialogActions} />

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
        <ForumTemplatePicker
          show={showTemplatePicker.value}
          baseUrl={props.baseUrl}
          onSelect={insertForumTemplate}
          onClose={() => (showTemplatePicker.value = false)}
        />
      </>
    )
  }
})
