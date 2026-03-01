import { ref, watch, onMounted, onUnmounted } from 'vue'
import type { EditorState } from 'prosemirror-state'
import type { Schema } from 'prosemirror-model'
import { EditorView } from 'prosemirror-view'

type UseProseMirrorViewOptions = {
  modelValue: () => string
  createState: (content: string) => EditorState
  onUpdate: (value: string) => void
  serializeDoc?: (state: EditorState) => string
  parseDoc?: (value: string, schema: Schema) => EditorState
  onViewCreated?: (view: EditorView) => void
  onBeforeDestroy?: (view: EditorView) => void
}

export function useProseMirrorView(options: UseProseMirrorViewOptions) {
  const editorContainer = ref<HTMLElement | null>(null)
  const editorView = ref<EditorView | null>(null)
  let isInternalUpdate = false
  let lastEmittedValue = ''

  onMounted(() => {
    if (!editorContainer.value) {
      console.error('Editor container not found')
      return
    }

    try {
      const view = new EditorView(editorContainer.value, {
        state: options.createState(options.modelValue()),
        editable: () => true,
        attributes: {
          class: 'ProseMirror',
          spellcheck: 'false'
        },
        dispatchTransaction: transaction => {
          if (!editorView.value) return
          const newState = editorView.value.state.apply(transaction)
          editorView.value.updateState(newState)
          if (transaction.docChanged && !isInternalUpdate) {
            const content = options.serializeDoc
              ? options.serializeDoc(newState)
              : newState.doc.textContent
            lastEmittedValue = content
            options.onUpdate(content)
          }
        }
      })
      editorView.value = view
      options.onViewCreated?.(view)
    } catch (error) {
      console.error('Failed to initialize ProseMirror editor:', error)
    }
  })

  onUnmounted(() => {
    if (editorView.value) {
      options.onBeforeDestroy?.(editorView.value as EditorView)
      editorView.value.destroy()
      editorView.value = null
    }
  })

  watch(
    () => options.modelValue(),
    newValue => {
      if (!editorView.value || isInternalUpdate) return
      const currentContent = options.serializeDoc
        ? options.serializeDoc(editorView.value.state as EditorState)
        : editorView.value.state.doc.textContent
      if (newValue === currentContent || newValue === lastEmittedValue) return
      isInternalUpdate = true
      try {
        if (options.parseDoc) {
          const nextState = options.parseDoc(newValue || '', editorView.value.state.schema)
          editorView.value.updateState(nextState)
        } else {
          const textContent = (newValue || '').toString()
          let newDoc
          if (textContent) {
            newDoc = editorView.value.state.schema.node('doc', null, [
              editorView.value.state.schema.node('paragraph', null, [
                editorView.value.state.schema.text(textContent)
              ])
            ])
          } else {
            newDoc = editorView.value.state.schema.node('doc', null, [
              editorView.value.state.schema.node('paragraph')
            ])
          }
          const tr = editorView.value.state.tr.replaceWith(
            0,
            editorView.value.state.doc.content.size,
            newDoc
          )
          editorView.value.dispatch(tr)
        }
      } catch (error) {
        console.error('Failed to update editor:', error)
      }
      setTimeout(() => {
        isInternalUpdate = false
      }, 0)
    },
    { immediate: false }
  )

  return { editorContainer, editorView }
}
