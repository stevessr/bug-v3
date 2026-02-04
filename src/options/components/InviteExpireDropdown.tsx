import { defineComponent, ref, watch, nextTick } from 'vue'
import dayjs from 'dayjs'

export default defineComponent({
  name: 'InviteExpireDropdown',
  props: {
    open: { type: Boolean, default: false },
    value: { type: String, default: '' }
  },
  emits: ['update:open', 'update:value'],
  setup(props, { emit }) {
    const localDate = ref('')
    const localTime = ref('00:00:00')
    const rootRef = ref<HTMLElement | null>(null)

    const syncFromValue = () => {
      const parsed = dayjs(props.value)
      if (!parsed.isValid()) return
      localDate.value = parsed.format('YYYY-MM-DD')
      localTime.value = parsed.format('HH:mm:ss')
    }

    watch(
      () => props.open,
      async open => {
        if (!open) return
        syncFromValue()
        await nextTick()
      }
    )

    watch(
      () => props.value,
      () => {
        if (props.open) syncFromValue()
      }
    )

    const close = () => emit('update:open', false)

    const handleOk = () => {
      if (!localDate.value) {
        close()
        return
      }
      const time = localTime.value || '00:00:00'
      const composed = dayjs(`${localDate.value}T${time}`)
      if (composed.isValid()) {
        emit('update:value', composed.toISOString())
      }
      close()
    }

    const onDocumentClick = (e: MouseEvent) => {
      if (!props.open) return
      const target = e.target as Node | null
      if (rootRef.value && target && rootRef.value.contains(target)) return
      close()
    }

    watch(
      () => props.open,
      open => {
        if (open) {
          document.addEventListener('mousedown', onDocumentClick)
        } else {
          document.removeEventListener('mousedown', onDocumentClick)
        }
      }
    )

    return () =>
      props.open ? (
        <div
          ref={rootRef}
          class="absolute z-50 mt-1 w-full max-w-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg p-3"
        >
          <div class="space-y-3">
            <div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">日期</div>
              <input
                type="date"
                class="w-full border rounded px-2 py-1 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600"
                value={localDate.value}
                onInput={e => {
                  const target = e.target as HTMLInputElement
                  localDate.value = target.value
                }}
              />
            </div>
            <div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">时间</div>
              <input
                type="time"
                step="1"
                class="w-full border rounded px-2 py-1 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600"
                value={localTime.value}
                onInput={e => {
                  const target = e.target as HTMLInputElement
                  localTime.value = target.value
                }}
              />
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400">
              保存后将转换为 ISO 时间（UTC）
            </div>
          </div>
          <div class="flex justify-end gap-2 mt-3">
            <button
              type="button"
              class="px-3 py-1 text-sm border rounded dark:border-gray-600 dark:text-gray-200"
              onClick={close}
            >
              取消
            </button>
            <button
              type="button"
              class="px-3 py-1 text-sm bg-blue-600 text-white rounded"
              onClick={handleOk}
            >
              确定
            </button>
          </div>
        </div>
      ) : null
  }
})
