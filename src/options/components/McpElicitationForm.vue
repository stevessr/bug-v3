<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  FormOutlined,
  SendOutlined,
  CloseOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'

import {
  setElicitationHandler,
  respondToElicitation,
  schemaToFormFields,
  validateFormData,
  type ElicitationRequest,
  type ElicitationSchema,
  type FormField
} from '@/agent/mcpUI'

// 当前显示的 elicitation 请求
const currentRequest = ref<{
  id: string
  serverId: string
  serverName: string
  request: ElicitationRequest
} | null>(null)

// 表单字段
const formFields = ref<FormField[]>([])

// 表单数据
const formData = ref<Record<string, unknown>>({})

// 验证错误
const formErrors = ref<Record<string, string>>({})

// 提交中状态
const submitting = ref(false)

// 计算可见的表单
const isVisible = computed(() => currentRequest.value !== null)

// 处理新的 elicitation 请求
const handleRequest = (request: {
  id: string
  serverId: string
  serverName: string
  request: ElicitationRequest
}) => {
  currentRequest.value = request

  // 解析 schema 生成表单字段
  if (request.request.requestedSchema) {
    formFields.value = schemaToFormFields(request.request.requestedSchema)
  } else {
    // 如果没有 schema，创建默认的文本输入
    formFields.value = [
      {
        name: 'response',
        type: 'text',
        label: '回复',
        required: true
      }
    ]
  }

  // 初始化表单数据（使用默认值）
  formData.value = {}
  formFields.value.forEach(field => {
    if (field.default !== undefined) {
      formData.value[field.name] = field.default
    } else if (field.type === 'boolean') {
      formData.value[field.name] = false
    } else if (field.type === 'multiselect') {
      formData.value[field.name] = []
    }
  })

  formErrors.value = {}
}

// 提交表单
const handleSubmit = () => {
  if (!currentRequest.value) return

  // 验证表单
  if (currentRequest.value.request.requestedSchema) {
    const validation = validateFormData(
      formData.value,
      currentRequest.value.request.requestedSchema
    )
    if (!validation.valid) {
      formErrors.value = validation.errors
      message.warning('请检查表单中的错误')
      return
    }
  }

  submitting.value = true

  // 响应请求
  const success = respondToElicitation(currentRequest.value.id, {
    action: 'accept',
    content: formData.value
  })

  if (success) {
    message.success('已提交')
    closeForm()
  } else {
    message.error('提交失败')
  }

  submitting.value = false
}

// 拒绝请求
const handleDecline = () => {
  if (!currentRequest.value) return

  respondToElicitation(currentRequest.value.id, { action: 'decline' })
  message.info('已拒绝')
  closeForm()
}

// 取消请求
const handleCancel = () => {
  if (!currentRequest.value) return

  respondToElicitation(currentRequest.value.id, { action: 'cancel' })
  closeForm()
}

// 关闭表单
const closeForm = () => {
  currentRequest.value = null
  formFields.value = []
  formData.value = {}
  formErrors.value = {}
}

// 注册处理器
onMounted(() => {
  setElicitationHandler(handleRequest)
})

// 清理处理器
onUnmounted(() => {
  setElicitationHandler(null)
})
</script>

<template>
  <a-modal
    :open="isVisible"
    :title="null"
    :footer="null"
    :closable="false"
    :maskClosable="false"
    width="500px"
    class="mcp-elicitation-modal"
  >
    <div v-if="currentRequest" class="space-y-4">
      <!-- 标题区域 -->
      <div
        class="flex items-center gap-3 p-4 -mx-6 -mt-6 mb-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-t-lg"
      >
        <FormOutlined class="text-2xl" />
        <div>
          <h3 class="text-lg font-semibold">MCP 服务请求输入</h3>
          <p class="text-sm opacity-90">来自：{{ currentRequest.serverName }}</p>
        </div>
      </div>

      <!-- 请求消息 -->
      <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p class="text-gray-700 dark:text-gray-300">{{ currentRequest.request.message }}</p>
      </div>

      <!-- 表单字段 -->
      <div class="space-y-4">
        <div v-for="field in formFields" :key="field.name" class="space-y-1">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ field.label }}
            <span v-if="field.required" class="text-red-500">*</span>
          </label>

          <p v-if="field.description" class="text-xs text-gray-500 dark:text-gray-400 mb-1">
            {{ field.description }}
          </p>

          <!-- 文本输入 -->
          <a-input
            v-if="field.type === 'text'"
            v-model:value="formData[field.name]"
            :placeholder="field.label"
            :status="formErrors[field.name] ? 'error' : undefined"
          />

          <!-- 邮箱输入 -->
          <a-input
            v-else-if="field.type === 'email'"
            v-model:value="formData[field.name]"
            type="email"
            :placeholder="field.label"
            :status="formErrors[field.name] ? 'error' : undefined"
          />

          <!-- 日期输入 -->
          <a-date-picker
            v-else-if="field.type === 'date'"
            v-model:value="formData[field.name]"
            class="w-full"
            :status="formErrors[field.name] ? 'error' : undefined"
          />

          <!-- 日期时间输入 -->
          <a-date-picker
            v-else-if="field.type === 'datetime'"
            v-model:value="formData[field.name]"
            show-time
            class="w-full"
            :status="formErrors[field.name] ? 'error' : undefined"
          />

          <!-- 数字输入 -->
          <a-input-number
            v-else-if="field.type === 'number'"
            v-model:value="formData[field.name]"
            class="w-full"
            :min="field.validation?.min"
            :max="field.validation?.max"
            :status="formErrors[field.name] ? 'error' : undefined"
          />

          <!-- 布尔开关 -->
          <a-switch v-else-if="field.type === 'boolean'" v-model:checked="formData[field.name]" />

          <!-- 单选下拉 -->
          <a-select
            v-else-if="field.type === 'select'"
            v-model:value="formData[field.name]"
            class="w-full"
            :options="field.options?.map(o => ({ value: o.value, label: o.label }))"
            :status="formErrors[field.name] ? 'error' : undefined"
          />

          <!-- 多选下拉 -->
          <a-select
            v-else-if="field.type === 'multiselect'"
            v-model:value="formData[field.name]"
            mode="multiple"
            class="w-full"
            :options="field.options?.map(o => ({ value: o.value, label: o.label }))"
            :status="formErrors[field.name] ? 'error' : undefined"
          />

          <!-- 错误提示 -->
          <p v-if="formErrors[field.name]" class="text-xs text-red-500 flex items-center gap-1">
            <ExclamationCircleOutlined />
            {{ formErrors[field.name] }}
          </p>
        </div>
      </div>

      <!-- 安全警告 -->
      <div
        class="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm text-yellow-700 dark:text-yellow-300"
      >
        <ExclamationCircleOutlined class="mr-1" />
        请注意：请勿在此输入敏感信息（如密码、密钥等）
      </div>

      <!-- 操作按钮 -->
      <div class="flex justify-end gap-2 pt-2">
        <a-button @click="handleCancel">
          <template #icon><CloseOutlined /></template>
          取消
        </a-button>
        <a-button danger @click="handleDecline">拒绝</a-button>
        <a-button type="primary" :loading="submitting" @click="handleSubmit">
          <template #icon><SendOutlined /></template>
          提交
        </a-button>
      </div>
    </div>
  </a-modal>
</template>

<style scoped>
.mcp-elicitation-modal :deep(.ant-modal-content) {
  padding: 0;
  overflow: hidden;
}

.mcp-elicitation-modal :deep(.ant-modal-body) {
  padding: 24px;
}
</style>
