<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { EditorState, Plugin, PluginKey } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { Schema, DOMParser as ProseMirrorDOMParser } from 'prosemirror-model'
import { schema as basicSchema } from 'prosemirror-schema-basic'
import {
  defaultKeymap,
  toggleMark,
  setBlockType,
  chainCommands,
  exitCode,
  joinUp,
  joinDown,
  lift,
  selectParentNode
} from 'prosemirror-commands'
import { history, undo, redo } from 'prosemirror-history'
import { inputRules, wrappingInputRule, textblockTypeInputRule } from 'prosemirror-inputrules'
import { keymap } from 'prosemirror-keymap'
import { MarkdownParser, MarkdownSerializer } from 'prosemirror-markdown'
import { marked } from 'marked'
import katex from 'katex'
import EmojiPicker from './EmojiPicker.vue'

interface Props {
  modelValue: string
  inputFormat: 'markdown' | 'bbcode'
}

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const editorContainer = ref<HTMLElement | null>(null)
const emojiPickerRef = ref<InstanceType<typeof EmojiPicker> | null>(null)
const showEmojiPicker = ref(false)
const emojiPickerPosition = ref<{ x: number; y: number } | null>(null)
let editorView: EditorView | null = null

// Parse BBCode to HTML then to ProseMirror document
function parseBBCodeToProse(bbcode: string): string {
  if (!bbcode) return ''

  // Convert BBCode to HTML (simplified)
  let html = bbcode
    .replace(/\[b\](.*?)\[\/b\]/gi, '<strong>$1</strong>')
    .replace(/\[i\](.*?)\[\/i\]/gi, '<em>$1</em>')
    .replace(/\[u\](.*?)\[\/u\]/gi, '<u>$1</u>')
    .replace(/\[s\](.*?)\[\/s\]/gi, '<s>$1</s>')
    .replace(/\[url=([^\]]+)\](.*?)\[\/url\]/gi, '<a href="$1">$2</a>')
    .replace(/\[img\]([^\[]*?)\[\/img\]/gi, '<img src="$1" />')
    .replace(/\[quote\](.*?)\[\/quote\]/gi, '<blockquote>$1</blockquote>')
    .replace(/\[code\](.*?)\[\/code\]/gi, '<pre><code>$1</code></pre>')
    .replace(/\[list\](.*?)\[\/list\]/gi, '<ul>$1</ul>')
    .replace(/\[\*\](.*?)(?=\[\*\]|<\/ul>)/gi, '<li>$1</li>')
    .replace(/\n/g, '<br>')

  return html
}

// Convert ProseMirror document to BBCode
function prosemirrorToBBCode(doc: any): string {
  if (!doc) return ''

  // Simple HTML to BBCode conversion
  const div = document.createElement('div')
  div.innerHTML = EditorView.fromJSON(basicSchema, doc).dom.textContent

  let result = div.innerHTML
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '[b]$1[/b]')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '[i]$1[/i]')
    .replace(/<u[^>]*>(.*?)<\/u>/gi, '[u]$1[/u]')
    .replace(/<s[^>]*>(.*?)<\/s>/gi, '[s]$1[/s]')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[url=$1]$2[/url]')
    .replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, '[img]$1[/img]')
    .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '[quote]$1[/quote]')
    .replace(/<pre><code[^>]*>(.*?)<\/code><\/pre>/gi, '[code]$1[/code]')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '[*]$1')
    .replace(/<br\s*\/?/gi, '\n')
    .replace(/<\/?(?:ul|ol|div|p)[^>]*>/gi, '')
    .replace(/\n{3,}/g, '\n')
    .trim()

  return result
}

// Convert ProseMirror document to Markdown
function prosemirrorToMarkdown(doc: any): string {
  if (!doc) return ''

  const div = document.createElement('div')
  div.innerHTML = EditorView.fromJSON(basicSchema, doc).dom.textContent
  return div.textContent
}

function createEditorState(content: string): EditorState {
  const doc = basicSchema.node('doc', null, [
    basicSchema.node('paragraph', null, [basicSchema.text(content || '')])
  ])

  return EditorState.create({
    doc,
    plugins: [
      history(),
      keymap({
        'Mod-z': undo,
        'Mod-y': redo,
        'Mod-Shift-z': redo,
        'Mod-b': toggleMark(basicSchema.marks.strong),
        'Mod-i': toggleMark(basicSchema.marks.em),
        'Mod-u': toggleMark(basicSchema.marks.underline),
        'Mod-Alt-s': toggleMark(basicSchema.marks.strike),
        'Mod-Enter': chainCommands(exitCode, (state, dispatch) => {
          if (dispatch) {
            const tr = state.tr.replaceSelectionWith(basicSchema.node('paragraph'))
            dispatch(tr)
          }
          return true
        }),
        'Mod-Backspace': chainCommands(selectParentNode, (state, dispatch) => {
          if (dispatch) {
            const tr = state.tr.replaceSelectionWith(basicSchema.node('paragraph'))
            dispatch(tr)
          }
          return true
        }),
        'Mod-[': lift,
        Escape: selectParentNode
      }),
      new Plugin({
        key: new PluginKey('change-handler'),
        view: () => {
          return {
            update: view => {
              const content = view.state.doc.textContent
              emit('update:modelValue', content)
            }
          }
        }
      })
    ]
  })
}

onMounted(() => {
  if (!editorContainer.value) return

  const content =
    props.inputFormat === 'bbcode' ? parseBBCodeToProse(props.modelValue) : props.modelValue

  editorView = new EditorView(editorContainer.value, {
    state: createEditorState(content),
    dispatchTransaction: transaction => {
      const newState = editorView!.state.apply(transaction)
      editorView!.updateState(newState)
    }
  })
})

onUnmounted(() => {
  if (editorView) {
    editorView.destroy()
    editorView = null
  }
})

watch(
  () => props.modelValue,
  newValue => {
    if (!editorView || newValue === editorView.state.doc.textContent) return

    const content = props.inputFormat === 'bbcode' ? parseBBCodeToProse(newValue) : newValue

    const tr = editorView.state.tr.insert(0, basicSchema.text(content))
    editorView.dispatch(tr)
  }
)

watch(
  () => props.inputFormat,
  () => {
    if (!editorView) return

    const currentContent = editorView.state.doc.textContent
    emit('update:modelValue', currentContent)
  }
)

// Emoji picker functions
const openEmojiPicker = (event: MouseEvent) => {
  const rect = (event.target as HTMLElement).getBoundingClientRect()
  emojiPickerPosition.value = {
    x: rect.left,
    y: rect.bottom + 5
  }
  showEmojiPicker.value = true
}

const handleEmojiSelect = (emoji: { name: string; url: string; shortcode: string }) => {
  if (!editorView) return

  // Insert emoji shortcode at cursor position
  const { from, to } = editorView.state.selection
  const tr = editorView.state.tr.insertText(emoji.shortcode, from, to)
  editorView.dispatch(tr)
  editorView.focus()

  showEmojiPicker.value = false
}

const handleEmojiPickerClose = () => {
  showEmojiPicker.value = false
}
</script>

<template>
  <div class="prosemirror-editor-wrapper">
    <div class="prosemirror-toolbar">
      <button
        class="toolbar-btn"
        title="插入表情"
        @click="openEmojiPicker"
      >
        😊
      </button>
    </div>
    <div ref="editorContainer" class="prosemirror-editor"></div>
    <EmojiPicker
      ref="emojiPickerRef"
      :show="showEmojiPicker"
      :position="emojiPickerPosition"
      @select="handleEmojiSelect"
      @close="handleEmojiPickerClose"
    />
  </div>
</template>

<style scoped>
.prosemirror-editor-wrapper {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.prosemirror-toolbar {
  display: flex;
  gap: 4px;
  padding: 4px;
  border: 1px solid #d1d5db;
  border-bottom: none;
  border-radius: 0.375rem 0.375rem 0 0;
  background: #f9fafb;
}

.toolbar-btn {
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
}

.toolbar-btn:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.prosemirror-editor {
  min-height: 200px;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0 0 0.375rem 0.375rem;
  background-color: #fff;
  outline: none;
}

.prosemirror-editor :deep(.ProseMirror) {
  outline: none;
}

.prosemirror-editor :deep(.ProseMirror-focused) {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.prosemirror-editor :deep(.ProseMirror p) {
  margin: 0.5em 0;
}

.prosemirror-editor :deep(.ProseMirror blockquote) {
  border-left: 3px solid #4b5563;
  padding-left: 1em;
  margin: 1em 0;
  color: #6b7280;
}

.prosemirror-editor :deep(.ProseMirror pre) {
  background: #111827;
  color: #e5e7eb;
  padding: 0.75rem;
  border-radius: 0.375rem;
  overflow-x: auto;
}

.prosemirror-editor :deep(.ProseMirror code) {
  background: #1f2937;
  padding: 0.1rem 0.25rem;
  border-radius: 0.25rem;
  font-family: monospace;
}

.prosemirror-editor :deep(.ProseMirror img) {
  max-width: 100%;
  border-radius: 0.25rem;
}

.prosemirror-editor :deep(.ProseMirror ul),
.prosemirror-editor :deep(.ProseMirror ol) {
  padding-left: 1.5rem;
  margin: 0.5em 0;
}

.prosemirror-editor :deep(.ProseMirror li) {
  margin: 0.25em 0;
}

.prosemirror-editor :deep(.ProseMirror a) {
  color: #3b82f6;
  text-decoration: underline;
}

.prosemirror-editor :deep(.ProseMirror a:hover) {
  color: #2563eb;
}
</style>
