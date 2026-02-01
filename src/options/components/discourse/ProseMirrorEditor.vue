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

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const editorContainer = ref<HTMLElement | null>(null)
let editorView: EditorView | null = null

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
        'Mod-[': lift,
        Escape: selectParentNode
      }),
      keymap(baseKeymap),
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

  editorView = new EditorView(editorContainer.value, {
    state: createEditorState(props.modelValue),
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

    const tr = editorView.state.tr.insert(0, basicSchema.text(newValue))
    editorView.dispatch(tr)
  }
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
}

.prosemirror-editor :deep(.ProseMirror) {
  outline: none;
  min-height: 180px;
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