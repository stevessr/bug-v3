<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { EditorState, Plugin } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { Schema } from 'prosemirror-model'
import { schema as basicSchema } from 'prosemirror-schema-basic'
import {
  toggleMark,
  chainCommands,
  exitCode,
  selectParentNode,
  lift,
  wrapIn,
  setBlockType
} from 'prosemirror-commands'
import { baseKeymap } from 'prosemirror-commands'
import { history, undo, redo } from 'prosemirror-history'
import { keymap } from 'prosemirror-keymap'

import EmojiPicker from './EmojiPicker'
import './css/EmojiPicker.css'
import { ensureEmojiShortcodesLoaded } from './linux.do/emojis'
import { searchEmojis, type EmojiShortcode } from './bbcode'

interface Props {
  modelValue: string
  inputFormat: 'markdown' | 'bbcode'
  baseUrl?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const editorContainer = ref<HTMLElement | null>(null)
let editorView: EditorView | null = null
let isInternalUpdate = false
const showEmojiPicker = ref(false)
const emojiPickerPos = ref<{ x: number; y: number } | null>(null)
const showEmojiAutocomplete = ref(false)
const emojiSuggestions = ref<EmojiShortcode[]>([])
const emojiQuery = ref('')
const emojiActiveIndex = ref(0)
const emojiAutocompletePos = ref<{ x: number; y: number } | null>(null)
const emojiAutocompleteRef = ref<HTMLElement | null>(null)

// Toolbar functions
const toggleBold = () => {
  if (!editorView) return
  toggleMark(basicSchema.marks.strong)(editorView.state, editorView.dispatch)
  editorView.focus()
}

const toggleItalic = () => {
  if (!editorView) return
  toggleMark(basicSchema.marks.em)(editorView.state, editorView.dispatch)
  editorView.focus()
}

const toggleUnderline = () => {
  if (!editorView) return
  toggleMark(basicSchema.marks.underline)(editorView.state, editorView.dispatch)
  editorView.focus()
}

const toggleStrike = () => {
  if (!editorView) return
  toggleMark(basicSchema.marks.strike)(editorView.state, editorView.dispatch)
  editorView.focus()
}

const insertCode = () => {
  if (!editorView) return
  toggleMark(basicSchema.marks.code)(editorView.state, editorView.dispatch)
  editorView.focus()
}

const insertLink = () => {
  if (!editorView) return
  const url = prompt('请输入链接地址：', 'https://')
  if (url) {
    const tr = editorView.state.tr.addMark(
      editorView.state.selection.from,
      editorView.state.selection.to,
      basicSchema.marks.link.create({ href: url })
    )
    editorView.dispatch(tr)
    editorView.focus()
  }
}

const insertImage = () => {
  if (!editorView) return
  const url = prompt('请输入图片地址：', 'https://')
  if (url) {
    const tr = editorView.state.tr.replaceSelectionWith(
      basicSchema.nodes.image.create({ src: url })
    )
    editorView.dispatch(tr)
    editorView.focus()
  }
}

const insertBlockquote = () => {
  if (!editorView) return
  wrapIn(basicSchema.nodes.blockquote)(editorView.state, editorView.dispatch)
  editorView.focus()
}

const insertOrderedList = () => {
  if (!editorView) return
  wrapIn(basicSchema.nodes.ordered_list)(editorView.state, editorView.dispatch)
  editorView.focus()
}

const insertUnorderedList = () => {
  if (!editorView) return
  wrapIn(basicSchema.nodes.bullet_list)(editorView.state, editorView.dispatch)
  editorView.focus()
}

const insertHeading = () => {
  if (!editorView) return
  setBlockType(basicSchema.nodes.heading, { level: 1 })(editorView.state, editorView.dispatch)
  editorView.focus()
}

const undoAction = () => {
  if (!editorView) return
  undo(editorView.state, editorView.dispatch)
  editorView.focus()
}

const redoAction = () => {
  if (!editorView) return
  redo(editorView.state, editorView.dispatch)
  editorView.focus()
}

const insertEmojiShortcode = (name: string) => {
  if (!editorView) return
  const shortcode = `:${name}:`
  const { state, dispatch } = editorView
  const { from, to } = state.selection
  const tr = state.tr.insertText(shortcode, from, to)
  dispatch(tr)
  editorView.focus()
}

const insertEmojiFromAutocomplete = (name: string) => {
  if (!editorView) return
  const { state, dispatch } = editorView
  const { from } = state.selection
  const textBefore = state.doc.textBetween(0, from, '\n', '\n')
  const match = textBefore.match(/(^|\\s):([a-zA-Z0-9_\\u4e00-\\u9fa5+-]*)$/)
  if (!match) {
    insertEmojiShortcode(name)
    return
  }
  const tokenLength = match[2].length + 1
  const start = from - tokenLength
  const tr = state.tr.replaceWith(start, from, state.schema.text(`:${name}:`))
  dispatch(tr)
  editorView.focus()
}

const updateEmojiAutocomplete = () => {
  if (!editorView) return
  const { state } = editorView
  const { from } = state.selection
  const textBefore = state.doc.textBetween(0, from, '\n', '\n')
  const match = textBefore.match(/(^|\\s):([a-zA-Z0-9_\\u4e00-\\u9fa5+-]*)$/)
  if (!match) {
    showEmojiAutocomplete.value = false
    emojiSuggestions.value = []
    emojiQuery.value = ''
    return
  }
  const query = match[2] || ''
  emojiQuery.value = query
  const results = searchEmojis(query).slice(0, 12)
  emojiSuggestions.value = results
  emojiActiveIndex.value = 0
  if (results.length === 0) {
    showEmojiAutocomplete.value = false
    return
  }
  try {
    const coords = editorView.coordsAtPos(from)
    emojiAutocompletePos.value = { x: coords.left, y: coords.bottom + 8 }
  } catch {
    emojiAutocompletePos.value = null
  }
  showEmojiAutocomplete.value = true
  requestAnimationFrame(() => {
    scrollActiveEmojiIntoView()
  })
}

const scrollActiveEmojiIntoView = () => {
  const host = emojiAutocompleteRef.value
  if (!host) return
  const activeItem = host.querySelector('.emoji-autocomplete-item.active') as HTMLElement | null
  activeItem?.scrollIntoView({ block: 'nearest' })
}

const handleEditorKeydown = (event: KeyboardEvent) => {
  if (!showEmojiAutocomplete.value || emojiSuggestions.value.length === 0) return
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    emojiActiveIndex.value = (emojiActiveIndex.value + 1) % emojiSuggestions.value.length
    requestAnimationFrame(() => {
      scrollActiveEmojiIntoView()
    })
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    emojiActiveIndex.value =
      (emojiActiveIndex.value - 1 + emojiSuggestions.value.length) % emojiSuggestions.value.length
    requestAnimationFrame(() => {
      scrollActiveEmojiIntoView()
    })
  } else if (event.key === 'Enter' || event.key === 'Tab') {
    event.preventDefault()
    const selected = emojiSuggestions.value[emojiActiveIndex.value]
    if (selected) {
      insertEmojiFromAutocomplete(selected.name)
      showEmojiAutocomplete.value = false
    }
  } else if (event.key === 'Escape') {
    event.preventDefault()
    showEmojiAutocomplete.value = false
  }
}

const handleEditorKeyup = (event: KeyboardEvent) => {
  if (
    event.key === 'ArrowDown' ||
    event.key === 'ArrowUp' ||
    event.key === 'Enter' ||
    event.key === 'Tab' ||
    event.key === 'Escape'
  ) {
    return
  }
  updateEmojiAutocomplete()
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

const handleEmojiSelect = (emoji: { name: string; shortcode: string }) => {
  insertEmojiShortcode(emoji.name)
  showEmojiPicker.value = false
}

function createEditorState(content: string): EditorState {
  // Ensure content exists and is a string
  const textContent = (content || '').toString()

  // Create doc node
  let docNode
  if (textContent) {
    // Create paragraph with text content
    const paragraphNode = basicSchema.node('paragraph', null, [basicSchema.text(textContent)])
    docNode = basicSchema.node('doc', null, [paragraphNode])
  } else {
    // Create empty paragraph without text node
    const paragraphNode = basicSchema.node('paragraph')
    docNode = basicSchema.node('doc', null, [paragraphNode])
  }

  return EditorState.create({
    doc: docNode,
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
        'Mod-[': lift,
        Escape: selectParentNode
      }),
      keymap(baseKeymap)
    ]
  })
}

onMounted(() => {
  if (!editorContainer.value) {
    console.error('Editor container not found')
    return
  }

  console.log('Initializing ProseMirror editor with content:', props.modelValue)

  try {
    editorView = new EditorView(editorContainer.value, {
      state: createEditorState(props.modelValue),
      editable: () => true,
      attributes: {
        class: 'ProseMirror',
        spellcheck: 'false'
      },
      dispatchTransaction: transaction => {
        if (!editorView) return

        const newState = editorView.state.apply(transaction)
        editorView.updateState(newState)

        // Emit update only on document changes
        if (transaction.docChanged && !isInternalUpdate) {
          const content = newState.doc.textContent
          emit('update:modelValue', content)
        }
      }
    })

    console.log('ProseMirror editor initialized successfully')
    editorView.dom.addEventListener('keydown', handleEditorKeydown)
    editorView.dom.addEventListener('keyup', handleEditorKeyup)
    editorView.dom.addEventListener('click', handleEditorKeyup)
  } catch (error) {
    console.error('Failed to initialize ProseMirror editor:', error)
  }
})

onUnmounted(() => {
  if (editorView) {
    editorView.dom.removeEventListener('keydown', handleEditorKeydown)
    editorView.dom.removeEventListener('keyup', handleEditorKeyup)
    editorView.dom.removeEventListener('click', handleEditorKeyup)
    editorView.destroy()
    editorView = null
  }
})

watch(
  () => props.modelValue,
  newValue => {
    if (!editorView || isInternalUpdate) return

    const currentContent = editorView.state.doc.textContent
    if (newValue === currentContent) return

    console.log('Updating editor content:', newValue)

    isInternalUpdate = true
    try {
      const textContent = (newValue || '').toString()
      let newDoc

      if (textContent) {
        newDoc = basicSchema.node('doc', null, [
          basicSchema.node('paragraph', null, [basicSchema.text(textContent)])
        ])
      } else {
        newDoc = basicSchema.node('doc', null, [basicSchema.node('paragraph')])
      }

      const tr = editorView.state.tr.replaceWith(0, editorView.state.doc.content.size, newDoc)
      editorView.dispatch(tr)
    } catch (error) {
      console.error('Failed to update editor:', error)
    }

    setTimeout(() => {
      isInternalUpdate = false
    }, 0)
  },
  { immediate: false }
)

watch(
  () => props.baseUrl,
  async value => {
    if (!value) return
    await ensureEmojiShortcodesLoaded(value)
  },
  { immediate: true }
)
</script>

<template>
  <div class="prosemirror-editor-wrapper">
    <div class="prosemirror-toolbar">
      <div class="toolbar-group">
        <button class="toolbar-btn" @click="undoAction" title="撤销 (Ctrl+Z)">
          <RollbackOutlined />
        </button>
        <button class="toolbar-btn" @click="redoAction" title="重做 (Ctrl+Y)">
          <RedoOutlined />
        </button>
      </div>
      <div class="toolbar-divider"></div>
      <div class="toolbar-group">
        <button class="toolbar-btn" @click="toggleBold" title="粗体 (Ctrl+B)">
          <BoldOutlined />
        </button>
        <button class="toolbar-btn" @click="toggleItalic" title="斜体 (Ctrl+I)">
          <ItalicOutlined />
        </button>
        <button class="toolbar-btn" @click="toggleUnderline" title="下划线 (Ctrl+U)">
          <UnderlineOutlined />
        </button>
        <button class="toolbar-btn" @click="toggleStrike" title="删除线 (Ctrl+Alt+S)">
          <StrikethroughOutlined />
        </button>
      </div>
      <div class="toolbar-divider"></div>
      <div class="toolbar-group">
        <button class="toolbar-btn" @click="handleEmojiPickerOpen" title="表情">
          🙂
        </button>
        <button class="toolbar-btn" @click="insertLink" title="插入链接">
          <LinkOutlined />
        </button>
        <button class="toolbar-btn" @click="insertImage" title="插入图片">
          <PictureOutlined />
        </button>
        <button class="toolbar-btn" @click="insertCode" title="行内代码">
          <CodeOutlined />
        </button>
      </div>
      <div class="toolbar-divider"></div>
      <div class="toolbar-group">
        <button class="toolbar-btn" @click="insertBlockquote" title="引用">
          <BlockOutlined />
        </button>
        <button class="toolbar-btn" @click="insertOrderedList" title="有序列表">
          <OrderedListOutlined />
        </button>
        <button class="toolbar-btn" @click="insertUnorderedList" title="无序列表">
          <UnorderedListOutlined />
        </button>
        <button class="toolbar-btn" @click="insertHeading" title="标题">
          <BgColorsOutlined />
        </button>
      </div>
    </div>
    <div ref="editorContainer" class="prosemirror-editor"></div>
    <div
      v-if="showEmojiAutocomplete && emojiSuggestions.length"
      class="emoji-autocomplete"
      :style="
        emojiAutocompletePos
          ? { left: `${emojiAutocompletePos.x}px`, top: `${emojiAutocompletePos.y}px` }
          : {}
      "
      ref="emojiAutocompleteRef"
    >
      <button
        v-for="(emoji, index) in emojiSuggestions"
        :key="emoji.id"
        class="emoji-autocomplete-item"
        :class="{ active: index === emojiActiveIndex }"
        @mousedown.prevent
        @click="insertEmojiFromAutocomplete(emoji.name)"
      >
        <img :src="emoji.url" :alt="emoji.name" />
        <span> :{{ emoji.name }}: </span>
      </button>
    </div>
  </div>

  <EmojiPicker
    :show="showEmojiPicker"
    :position="emojiPickerPos"
    :baseUrl="props.baseUrl"
    @select="handleEmojiSelect"
    @close="showEmojiPicker = false"
  />
</template>

<style scoped src="./css/ProseMirrorEditor.css"></style>
