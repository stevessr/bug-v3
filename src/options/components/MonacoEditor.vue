<template>
  <div ref="editorContainer" style="height: 300px; border: 1px solid #d9d9d9; border-radius: 6px"></div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, onUnmounted, watch } from 'vue'

export default defineComponent({
  name: 'MonacoEditor',
  props: {
    modelValue: {
      type: String,
      default: ''
    },
    readonly: {
      type: Boolean,
      default: false
    },
    language: {
      type: String,
      default: 'json'
    }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const editorContainer = ref<HTMLElement>()
    let editor: any = null

    async function initEditor() {
      if (!editorContainer.value) return

      // 动态导入 Monaco Editor
      const monaco = await import('monaco-editor')
      
      // 配置 Monaco Editor
      monaco.editor.defineTheme('vs-light', {
        base: 'vs',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#ffffff'
        }
      })

      editor = monaco.editor.create(editorContainer.value, {
        value: props.modelValue,
        language: props.language,
        theme: 'vs-light',
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 14,
        lineNumbers: 'on',
        roundedSelection: false,
        scrollbar: {
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8
        },
        readOnly: props.readonly
      })

      // 监听内容变化
      editor.onDidChangeModelContent(() => {
        const value = editor.getValue()
        emit('update:modelValue', value)
      })

      // 格式化 JSON（仅在只读模式下自动格式化）
      if (props.language === 'json' && props.modelValue && props.readonly) {
        try {
          const parsed = JSON.parse(props.modelValue)
          const formatted = JSON.stringify(parsed, null, 2)
          if (formatted !== props.modelValue) {
            setTimeout(() => {
              editor.setValue(formatted)
            }, 100)
          }
        } catch (e) {
          // 如果 JSON 格式不正确，保持原样
        }
      }
    }

    // 监听外部值变化
    watch(() => props.modelValue, (newValue) => {
      if (editor && editor.getValue() !== newValue) {
        editor.setValue(newValue)
      }
    })

    // 监听只读状态变化
    watch(() => props.readonly, (newValue) => {
      if (editor) {
        editor.updateOptions({ readOnly: newValue })
      }
    })

    onMounted(() => {
      initEditor()
    })

    onUnmounted(() => {
      if (editor) {
        editor.dispose()
      }
    })

    return {
      editorContainer
    }
  }
})
</script>