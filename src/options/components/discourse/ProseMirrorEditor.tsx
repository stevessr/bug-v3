import { defineComponent, ref, watch, computed } from 'vue'
import { EditorState } from 'prosemirror-state'
import { schema as basicSchema } from 'prosemirror-schema-basic'
import {
  toggleMark,
  selectParentNode,
  lift,
  wrapIn,
  setBlockType
} from 'prosemirror-commands'
import { baseKeymap } from 'prosemirror-commands'
import { history, undo, redo } from 'prosemirror-history'
import { keymap } from 'prosemirror-keymap'
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
import { ensureEmojiShortcodesLoaded } from './linux.do/emojis'
import { useProseMirrorView } from './composables/useProseMirrorView'
import { useEmojiAutocomplete } from './composables/useEmojiAutocomplete'
import { useDiscourseUpload } from './composables/useDiscourseUpload'
import './css/EmojiPicker.css'
import './css/PluginEmojiPicker.css'
import './css/ProseMirrorEditor.css'

type Props = {
  modelValue: string
  inputFormat: 'markdown' | 'bbcode'
  baseUrl?: string
}

export default defineComponent({
  name: 'ProseMirrorEditor',
  props: {
    modelValue: { type: String, required: true },
    inputFormat: { type: String as () => 'markdown' | 'bbcode', required: true },
    baseUrl: { type: String, default: undefined }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const editorViewRef = ref<ReturnType<typeof useProseMirrorView>['editorView']['value']>(null)
    const showEmojiPicker = ref(false)
    const emojiPickerPos = ref<{ x: number; y: number } | null>(null)
    const showPluginEmojiPicker = ref(false)
    const pluginEmojiPickerPos = ref<{ x: number; y: number } | null>(null)

    const toggleBold = () => {
      const editorView = editorViewRef.value
      if (!editorView) return
      toggleMark(basicSchema.marks.strong)(editorView.state, editorView.dispatch)
      editorView.focus()
    }

    const toggleItalic = () => {
      const editorView = editorViewRef.value
      if (!editorView) return
      toggleMark(basicSchema.marks.em)(editorView.state, editorView.dispatch)
      editorView.focus()
    }

    const toggleUnderline = () => {
      const editorView = editorViewRef.value
      if (!editorView) return
      toggleMark(basicSchema.marks.underline)(editorView.state, editorView.dispatch)
      editorView.focus()
    }

    const toggleStrike = () => {
      const editorView = editorViewRef.value
      if (!editorView) return
      toggleMark(basicSchema.marks.strike)(editorView.state, editorView.dispatch)
      editorView.focus()
    }

    const insertCode = () => {
      const editorView = editorViewRef.value
      if (!editorView) return
      toggleMark(basicSchema.marks.code)(editorView.state, editorView.dispatch)
      editorView.focus()
    }

    const insertLink = () => {
      const editorView = editorViewRef.value
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
      const editorView = editorViewRef.value
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
      const editorView = editorViewRef.value
      if (!editorView) return
      wrapIn(basicSchema.nodes.blockquote)(editorView.state, editorView.dispatch)
      editorView.focus()
    }

    const insertOrderedList = () => {
      const editorView = editorViewRef.value
      if (!editorView) return
      wrapIn(basicSchema.nodes.ordered_list)(editorView.state, editorView.dispatch)
      editorView.focus()
    }

    const insertUnorderedList = () => {
      const editorView = editorViewRef.value
      if (!editorView) return
      wrapIn(basicSchema.nodes.bullet_list)(editorView.state, editorView.dispatch)
      editorView.focus()
    }

    const insertHeading = () => {
      const editorView = editorViewRef.value
      if (!editorView) return
      setBlockType(basicSchema.nodes.heading, { level: 1 })(editorView.state, editorView.dispatch)
      editorView.focus()
    }

    const undoAction = () => {
      const editorView = editorViewRef.value
      if (!editorView) return
      undo(editorView.state, editorView.dispatch)
      editorView.focus()
    }

    const redoAction = () => {
      const editorView = editorViewRef.value
      if (!editorView) return
      redo(editorView.state, editorView.dispatch)
      editorView.focus()
    }

    const insertEmojiShortcode = (name: string) => {
      const editorView = editorViewRef.value
      if (!editorView) return
      const shortcode = `:${name}:`
      const { state, dispatch } = editorView
      const { from, to } = state.selection
      const tr = state.tr.insertText(shortcode, from, to)
      dispatch(tr)
      editorView.focus()
    }

    const insertTextAtCursor = (text: string) => {
      const editorView = editorViewRef.value
      if (!editorView) return
      const { state, dispatch } = editorView
      const { from, to } = state.selection
      const tr = state.tr.insertText(text, from, to)
      dispatch(tr)
      editorView.focus()
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

    const handlePluginEmojiSelect = (emoji: { name: string; url: string }) => {
      const markup = buildImageMarkup.value(emoji.url, emoji.name)
      insertTextAtCursor(markup)
      showPluginEmojiPicker.value = false
    }

    const buildImageMarkup = computed(() => {
      return (url: string, filename?: string) => {
        const safeUrl = url
        if (props.inputFormat === 'markdown') {
          const alt = filename || 'image'
          return `![${alt}](${safeUrl})`
        }
        return `[img]${safeUrl}[/img]`
      }
    })

    const { handleUploadClick, handleUploadChange, fileInputRef } = useDiscourseUpload({
      baseUrl: props.baseUrl,
      inputFormat: () => props.inputFormat,
      onInsertText: insertTextAtCursor
    })

    const {
      showEmojiAutocomplete,
      emojiSuggestions,
      emojiActiveIndex,
      emojiAutocompletePos,
      emojiAutocompleteRef,
      handleEditorKeydown,
      handleEditorKeyup,
      insertEmojiFromAutocomplete
    } = useEmojiAutocomplete({
      getEditorView: () => editorViewRef.value,
      insertEmojiShortcode
    })

    const createEditorState = (content: string): EditorState => {
      const textContent = (content || '').toString()
      let docNode
      if (textContent) {
        const paragraphNode = basicSchema.node('paragraph', null, [basicSchema.text(textContent)])
        docNode = basicSchema.node('doc', null, [paragraphNode])
      } else {
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

    const { editorContainer, editorView } = useProseMirrorView({
      modelValue: () => props.modelValue,
      createState: createEditorState,
      onUpdate: value => emit('update:modelValue', value),
      onViewCreated: view => {
        editorViewRef.value = view
        view.dom.addEventListener('keydown', handleEditorKeydown)
        view.dom.addEventListener('keyup', handleEditorKeyup)
        view.dom.addEventListener('click', handleEditorKeyup)
      },
      onBeforeDestroy: view => {
        view.dom.removeEventListener('keydown', handleEditorKeydown)
        view.dom.removeEventListener('keyup', handleEditorKeyup)
        view.dom.removeEventListener('click', handleEditorKeyup)
      }
    })

    watch(
      editorView,
      view => {
        editorViewRef.value = view
      },
      { immediate: true }
    )

    watch(
      () => props.baseUrl,
      async value => {
        if (!value) return
        await ensureEmojiShortcodesLoaded(value)
      },
      { immediate: true }
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
              <button class="toolbar-btn" onClick={insertLink} title="插入链接">
                <LinkOutlined />
              </button>
              <button class="toolbar-btn" onClick={insertImage} title="插入图片">
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
          <div ref={editorContainer} class="prosemirror-editor" />
          <input
            ref={fileInputRef}
            type="file"
            class="hidden-upload-field"
            onChange={handleUploadChange}
          />
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
                  onClick={() => insertEmojiFromAutocomplete(emoji.name)}
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
