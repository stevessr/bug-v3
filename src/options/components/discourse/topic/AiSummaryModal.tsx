import { defineComponent } from 'vue'
import { Modal } from 'ant-design-vue'

export default defineComponent({
  name: 'AiSummaryModal',
  props: {
    open: { type: Boolean, required: true },
    summary: { type: String, default: '' },
    loading: { type: Boolean, required: true },
    errorMessage: { type: String, default: '' },
    meta: {
      type: Object as () =>
        | {
            outdated?: boolean
            canRegenerate?: boolean
            algorithm?: string
            updatedAt?: string
            newPosts?: number
          }
        | null
        | undefined,
      default: null
    },
    onCancel: { type: Function as () => () => void, required: true },
    onRegenerate: { type: Function as () => () => void, required: true }
  },
  setup(props) {
    return () => (
      <Modal open={props.open} title="AI 总结" footer={null} width="720px" onCancel={props.onCancel}>
        <div class="space-y-3">
          {props.loading && <div class="text-sm text-gray-500">生成中...</div>}
          {props.summary && (
            <div class="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
              {props.summary}
            </div>
          )}
          {props.errorMessage && <div class="text-sm text-red-500">{props.errorMessage}</div>}
          {props.meta && (
            <div class="text-xs text-gray-500">
              {props.meta.outdated ? '内容已过期' : '已更新'}
              {props.meta.algorithm && ` · ${props.meta.algorithm}`}
              {props.meta.updatedAt && ` · ${props.meta.updatedAt}`}
              {typeof props.meta.newPosts === 'number' && ` · 新增 ${props.meta.newPosts} 条`}
            </div>
          )}
          {(props.meta?.outdated || props.meta?.canRegenerate) && (
            <div>
              <button
                type="button"
                class="px-3 py-1 text-sm bg-blue-600 text-white rounded"
                disabled={props.loading}
                onClick={props.onRegenerate}
              >
                重新生成
              </button>
            </div>
          )}
        </div>
      </Modal>
    )
  }
})
