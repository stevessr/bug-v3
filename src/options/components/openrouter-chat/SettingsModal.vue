<template>
  <a-modal :open="open" title="配置" width="640px" @cancel="handleCancel" :footer="null">
    <a-tabs v-model:activeKey="activeTab">
      <a-tab-pane key="apiKeys" tab="API Keys">
        <div class="api-key-manager">
          <p>添加多个 API Key 以实现负载均衡和容错：</p>
          <div v-for="(key, index) in tempApiKeys" :key="index" class="api-key-item">
            <a-row :gutter="8">
              <a-col :span="20">
                <a-input
                  v-model:value="tempApiKeys[index]"
                  :type="showKeys[index] ? 'text' : 'password'"
                  placeholder="sk-or-..."
                />
              </a-col>
              <a-col :span="2">
                <a-button
                  type="link"
                  @click="toggleKeyVisibility(index)"
                  :icon="h(showKeys[index] ? EyeInvisibleOutlined : EyeOutlined)"
                />
              </a-col>
              <a-col :span="2">
                <a-button
                  type="link"
                  danger
                  @click="removeApiKey(index)"
                  :icon="h(DeleteOutlined)"
                />
              </a-col>
            </a-row>
          </div>
          <a-button @click="addApiKey" type="dashed" style="width: 100%; margin-top: 8px">
            <PlusOutlined /> 添加 API Key
          </a-button>
          <a-alert
            v-if="!tempApiKeys || tempApiKeys.filter((k) => k.trim()).length === 0"
            message="请至少添加一个有效的 API Key"
            type="warning"
            style="margin-top: 16px"
          />
        </div>
        <div style="margin-top: 16px; text-align: right">
          <a-button @click="handleCancelApiKeys" style="margin-right: 8px">取消</a-button>
          <a-button type="primary" @click="handleSaveApiKeys">保存</a-button>
        </div>
      </a-tab-pane>
      <a-tab-pane key="imgBed" tab="ImgBed 图床">
        <div style="display: flex; flex-direction: column; gap: 12px">
          <a-checkbox v-model:checked="useImgBed">使用 CloudFlare-ImgBed 上传</a-checkbox>
          <a-input
            v-model:value="imgBedEndpoint"
            placeholder="ImgBed endpoint (例如 https://your.domain/upload)"
            :disabled="!useImgBed"
          />
          <a-input
            v-model:value="imgBedAuthCode"
            placeholder="authCode (可选)"
            :disabled="!useImgBed"
          />
          <a-select v-model:value="imgBedUploadChannel" style="width: 200px" :disabled="!useImgBed">
            <a-select-option value="telegram">telegram</a-select-option>
            <a-select-option value="cfr2">cfr2</a-select-option>
            <a-select-option value="s3">s3</a-select-option>
          </a-select>
          <a-checkbox v-model:checked="imgBedServerCompress" :disabled="!useImgBed"
            >启用服务器压缩</a-checkbox
          >
          <a-checkbox v-model:checked="imgBedAutoRetry" :disabled="!useImgBed"
            >失败自动重试</a-checkbox
          >
        </div>
        <div style="margin-top: 16px; text-align: right">
          <a-button @click="handleCloseImgBedModal" style="margin-right: 8px">取消</a-button>
          <a-button type="primary" @click="handleSaveImgBedConfig">保存</a-button>
        </div>
      </a-tab-pane>
    </a-tabs>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, h, defineProps, defineEmits } from 'vue'
import {
  EyeOutlined,
  EyeInvisibleOutlined,
  DeleteOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue'
import { useApiKeys } from '../../composables/useApiKeys'
import { useImgBed as useImgBedComposable } from '../../composables/useImgBed'

const props = defineProps({
  open: { type: Boolean, required: true },
})

const emit = defineEmits(['update:open'])

const activeTab = ref('apiKeys')

const handleCancel = () => {
  emit('update:open', false)
}

// --- Composables ---
const {
  tempApiKeys,
  showKeys,
  addApiKey,
  removeApiKey,
  toggleKeyVisibility,
  saveApiKeys,
  cancelApiKeys,
} = useApiKeys()

const {
  useImgBed,
  imgBedEndpoint,
  imgBedAuthCode,
  imgBedUploadChannel,
  imgBedServerCompress,
  imgBedAutoRetry,
  saveImgBedConfig,
  closeImgBedModal,
} = useImgBedComposable()

const handleSaveApiKeys = () => {
  saveApiKeys()
  emit('update:open', false)
}

const handleCancelApiKeys = () => {
  cancelApiKeys()
  emit('update:open', false)
}

const handleSaveImgBedConfig = () => {
  saveImgBedConfig()
  emit('update:open', false)
}

const handleCloseImgBedModal = () => {
  closeImgBedModal()
  emit('update:open', false)
}
</script>

<style scoped>
.api-key-item {
  margin-bottom: 8px;
}
</style>
