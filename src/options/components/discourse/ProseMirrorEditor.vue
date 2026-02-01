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

interface Props {
  modelValue: string
  inputFormat: 'markdown' | 'bbcode'
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const editorContainer = ref<HTMLElement | null>(null)
let editorView: EditorView | null = null
let isInternalUpdate = false

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
      basicSchema.schema.nodes.image.create({ src: url })
    )
    editorView.dispatch(tr)
    editorView.focus()
  }
}

const insertBlockquote = () => {
  if (!editorView) return
  wrapIn(basicSchema.schema.nodes.blockquote)(editorView.state, editorView.dispatch)
  editorView.focus()
}

const insertOrderedList = () => {
  if (!editorView) return
  wrapIn(basicSchema.schema.nodes.ordered_list)(editorView.state, editorView.dispatch)
  editorView.focus()
}

const insertUnorderedList = () => {
  if (!editorView) return
  wrapIn(basicSchema.schema.nodes.bullet_list)(editorView.state, editorView.dispatch)
  editorView.focus()
}

const insertHeading = () => {
  if (!editorView) return
  setBlockType(basicSchema.schema.nodes.heading, { level: 1 })(
    editorView.state,
    editorView.dispatch
  )
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
  } catch (error) {
    console.error('Failed to initialize ProseMirror editor:', error)
  }
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
  </div>
</template>

<style scoped src="./css/ProseMirrorEditor.css"></style>
