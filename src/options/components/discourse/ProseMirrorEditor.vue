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
  lift
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

function createEditorState(content: string): EditorState {
  // Ensure content exists and is a string
  const textContent = (content || '').toString()
  
  // Create doc node
  let docNode
  if (textContent) {
    // Create paragraph with text content
    const paragraphNode = basicSchema.node('paragraph', null, [
      basicSchema.text(textContent)
    ])
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
  (newValue) => {
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
        newDoc = basicSchema.node('doc', null, [
          basicSchema.node('paragraph')
        ])
      }
      
      const tr = editorView.state.tr.replaceWith(
        0,
        editorView.state.doc.content.size,
        newDoc
      )
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
  <div ref="editorContainer" class="prosemirror-editor"></div>
</template>

<style scoped>
.prosemirror-editor {
  min-height: 200px;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background-color: #fff;
  outline: none;
  cursor: text;
}

.prosemirror-editor :deep(.ProseMirror) {
  outline: none;
  min-height: 180px;
  cursor: text;
}

.prosemirror-editor :deep(.ProseMirror-focused) {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.prosemirror-editor :deep(.ProseMirror p) {
  margin: 0.5em 0;
  line-height: 1.5;
}

.prosemirror-editor :deep(.ProseMirror p:first-child) {
  margin-top: 0;
}

.prosemirror-editor :deep(.ProseMirror p:last-child) {
  margin-bottom: 0;
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
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.875em;
}

.prosemirror-editor :deep(.ProseMirror pre code) {
  background: transparent;
  padding: 0;
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

.prosemirror-editor :deep(.ProseMirror-selection) {
  background: #3b82f6;
}

@media (prefers-color-scheme: dark) {
  .prosemirror-editor {
    background-color: #1f2937;
    border-color: #374151;
  }

  .prosemirror-editor :deep(.ProseMirror-focused) {
    border-color: #60a5fa;
    box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.2);
  }

  .prosemirror-editor :deep(.ProseMirror blockquote) {
    color: #9ca3af;
  }

  .prosemirror-editor :deep(.ProseMirror pre) {
    background: #111827;
  }

  .prosemirror-editor :deep(.ProseMirror code) {
    background: #374151;
  }

  .prosemirror-editor :deep(.ProseMirror a) {
    color: #60a5fa;
  }

  .prosemirror-editor :deep(.ProseMirror a:hover) {
    color: #3b82f6;
  }
}
</style>