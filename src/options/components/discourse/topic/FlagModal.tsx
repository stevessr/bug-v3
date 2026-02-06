import { defineComponent, ref, computed, watch, type PropType } from 'vue'
import { Modal, Radio, Input, Spin } from 'ant-design-vue'
import type { DiscourseFlagType, DiscoursePost } from '../types'

export default defineComponent({
  name: 'FlagModal',
  props: {
    open: { type: Boolean, required: true },
    post: { type: Object as PropType<DiscoursePost | null>, default: null },
    flagTypes: { type: Array as PropType<DiscourseFlagType[]>, default: () => [] },
    loading: { type: Boolean, default: false },
    submitting: { type: Boolean, default: false },
    onCancel: { type: Function as PropType<() => void>, required: true },
    onSubmit: {
      type: Function as PropType<(flagTypeId: number, message: string) => void>,
      required: true
    }
  },
  setup(props) {
    const selectedFlagType = ref<number | null>(null)
    const message = ref('')

    const selectedFlagInfo = computed(() => {
      if (!selectedFlagType.value) return null
      return props.flagTypes.find(f => f.id === selectedFlagType.value)
    })

    const requiresMessage = computed(() => {
      return selectedFlagInfo.value?.require_message || false
    })

    const canSubmit = computed(() => {
      if (!selectedFlagType.value) return false
      if (requiresMessage.value && !message.value.trim()) return false
      return true
    })

    watch(
      () => props.open,
      open => {
        if (open) {
          selectedFlagType.value = null
          message.value = ''
        }
      }
    )

    const handleSubmit = () => {
      if (!canSubmit.value || !selectedFlagType.value) return
      props.onSubmit(selectedFlagType.value, message.value.trim())
    }

    return () => (
      <Modal
        open={props.open}
        title="举报帖子"
        okText="提交举报"
        cancelText="取消"
        width="520px"
        onCancel={props.onCancel}
        onOk={handleSubmit}
        okButtonProps={{ disabled: !canSubmit.value || props.submitting }}
        confirmLoading={props.submitting}
      >
        <div class="space-y-4">
          {props.loading ? (
            <div class="flex justify-center py-8">
              <Spin tip="加载举报类型中..." />
            </div>
          ) : props.flagTypes.length === 0 ? (
            <div class="text-center py-8 text-gray-500">无可用的举报类型</div>
          ) : (
            <>
              <div class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                请选择举报理由：
              </div>
              <Radio.Group
                value={selectedFlagType.value}
                onChange={(e: any) => {
                  selectedFlagType.value = e.target.value
                }}
                class="w-full"
              >
                <div class="space-y-2">
                  {props.flagTypes.map(flagType => (
                    <div
                      key={flagType.id}
                      class={[
                        'p-3 border rounded-lg cursor-pointer transition-colors',
                        selectedFlagType.value === flagType.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      ]}
                      onClick={() => {
                        selectedFlagType.value = flagType.id
                      }}
                    >
                      <Radio value={flagType.id} class="w-full">
                        <div class="ml-2">
                          <div class="font-medium text-gray-900 dark:text-gray-100">
                            {flagType.name}
                          </div>
                          {flagType.description && (
                            <div
                              class="text-xs text-gray-500 dark:text-gray-400 mt-1"
                              innerHTML={flagType.description}
                            />
                          )}
                        </div>
                      </Radio>
                    </div>
                  ))}
                </div>
              </Radio.Group>

              {selectedFlagInfo.value && (
                <div class="mt-4">
                  {requiresMessage.value && (
                    <div class="mb-2 text-sm text-orange-600 dark:text-orange-400">
                      此举报类型需要提供详细说明
                    </div>
                  )}
                  <Input.TextArea
                    value={message.value}
                    onChange={(e: any) => {
                      message.value = e.target.value
                    }}
                    placeholder={
                      requiresMessage.value
                        ? '请详细描述问题（必填）'
                        : '补充说明（可选）'
                    }
                    rows={3}
                    maxlength={500}
                    showCount
                  />
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
    )
  }
})
