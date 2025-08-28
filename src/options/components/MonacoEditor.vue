<script lang="ts">
import { defineComponent, ref, onMounted, onUnmounted, watch } from 'vue'

export default defineComponent({
  name: 'MonacoEditor',
  props: {
    modelValue: {
      type: String,
      default: '',
    },
    readonly: {
      type: Boolean,
      default: false,
    },
    language: {
      type: String,
      default: 'json',
    },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const editorContainer = ref<HTMLElement>()
    let editor: any = null

    async function initEditor() {
      if (!editorContainer.value) return

      // 在某些环境（比如浏览器扩展或没有 AMD loader）下，monaco 的
      // FileAccessImpl 会调用 require.toUrl，导致 `toUrl` 未定义的错误。
      // 这里注入一个轻量 polyfill，满足 monaco 的调用约定；同时在
      // 全局（window/self）都注入，确保主线程与 worker（若被创建）都有。
      function ensureRequireDefineOnGlobal(g: any) {
        if (!g) return
        if (typeof g.require === 'undefined') {
          const req: any = function () {}
          req.toUrl = (url: string) => url
          g.require = req
        } else if (typeof g.require.toUrl !== 'function') {
          g.require.toUrl = (url: string) => url
        }
        if (typeof g.define === 'undefined') {
          g.define = function () {}
        }
      }

      ensureRequireDefineOnGlobal(window as any)
      // worker 的 global 是 self；有时 self === window，在严格 worker 环境下这段也能运行
      ensureRequireDefineOnGlobal((self as any) || {})

      // 使用 Vite 的 worker 打包支持导入真实的 monaco worker 并设置 MonacoEnvironment
      // 这样 Vite 会把 worker 当作单独的 bundle 打包并返回一个构造器。
      if (typeof window !== 'undefined' && !(window as any).MonacoEnvironment) {
        try {
          const EditorWorkerModule = await import(
            'monaco-editor/esm/vs/editor/editor.worker?worker'
          )
          const JsonWorkerModule = await import(
            'monaco-editor/esm/vs/language/json/json.worker?worker'
          )
          // 可按需再导入 typescript 等 worker

          ;(window as any).MonacoEnvironment = {
            getWorker: function (_moduleId: string, label: string) {
              if (label === 'json') {
                return new JsonWorkerModule.default()
              }
              return new EditorWorkerModule.default()
            },
          }
        } catch (e) {
          // 如果导入 worker 失败，回退到之前的 safe fake worker，以避免运行时错误
          ;(window as any).MonacoEnvironment = {
            getWorker: function () {
              const fakeWorker: any = {
                onmessage: null,
                postMessage: function () {},
                addEventListener: function () {},
                removeEventListener: function () {},
                terminate: function () {},
              }
              return fakeWorker
            },
          }
        }
      }

      // 动态导入 Monaco Editor
      const monaco = await import('monaco-editor')

      // 进一步禁用 JSON 的远程 schema 请求和语言服务（避免 worker 使用）
      try {
        if (
          (monaco as any).languages &&
          (monaco as any).languages.json &&
          (monaco as any).languages.json.jsonDefaults
        ) {
          ;(monaco as any).languages.json.jsonDefaults.setDiagnosticsOptions({
            validate: false,
            enableSchemaRequest: false,
            allowComments: true,
          })
        }
      } catch (e) {
        // 忽略失败，保持兼容性
      }

      // 配置 Monaco Editor
      monaco.editor.defineTheme('vs-light', {
        base: 'vs',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#ffffff',
        },
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
          horizontalScrollbarSize: 8,
        },
        readOnly: props.readonly,
        // 启用编辑器级别的自动补全（尽量不依赖 worker 的语言服务）
        wordBasedSuggestions: 'allDocuments',
        quickSuggestions: true,
        parameterHints: { enabled: true },
        suggestOnTriggerCharacters: true,
        acceptSuggestionOnEnter: 'on',
        tabCompletion: 'on',
        wordWrap: 'on',
        // 禁用其他可能导致问题的功能
        codeLens: false,
        colorDecorators: false,
        gotoLocation: { multiple: 'goto' },
        hover: { enabled: false },
        links: false,
        folding: false,
        lineNumbersMinChars: 3,
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
    watch(
      () => props.modelValue,
      (newValue) => {
        if (editor && editor.getValue() !== newValue) {
          editor.setValue(newValue)
        }
      },
    )

    // 监听只读状态变化
    watch(
      () => props.readonly,
      (newValue) => {
        if (editor) {
          editor.updateOptions({ readOnly: newValue })
        }
      },
    )

    onMounted(() => {
      initEditor()
    })

    onUnmounted(() => {
      if (editor) {
        editor.dispose()
      }
    })

    return {
      editorContainer,
    }
  },
})
</script>

<template>
  <div
    ref="editorContainer"
    style="height: 300px; border: 1px solid #d9d9d9; border-radius: 6px"
  ></div>
</template>
