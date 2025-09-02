<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Dropdown as ADropdown, Menu as AMenu, Button as AButton } from 'ant-design-vue'
import { DownOutlined } from '@ant-design/icons-vue'

import { PROVIDER_CONFIGS } from '@/types/imageGenerator'
import type { ProviderManager } from '@/utils/imageProviders'

interface Props {
  providerManager: ProviderManager
}

const props = defineProps<Props>()

const emit = defineEmits<{
  providerChanged: [provider: string]
  apiKeyChanged: [key: string]
  modelChanged: [model: string]
}>()

const selectedProvider = ref('gemini')
const apiKey = ref('')
const selectedModel = ref('')

const onProviderSelect = (info: any) => {
  selectedProvider.value = String(info.key)
  onProviderChange()
}

const onModelSelect = (info: any) => {
  selectedModel.value = String(info.key)
  onModelChange()
}

const providerDisplay = computed(() => getProviderDisplayName(selectedProvider.value))

const selectedModelLabel = computed(() => {
  const models = currentProviderConfig.value?.models || []
  const m = models.find((x: any) => x.id === selectedModel.value)
  return m ? m.name : models[0]?.name || ''
})

const providerNames = computed(() => props.providerManager.getProviderNames())

const currentProviderConfig = computed(() => {
  return PROVIDER_CONFIGS[selectedProvider.value]
})

const getProviderDisplayName = (providerName: string) => {
  return PROVIDER_CONFIGS[providerName]?.displayName || providerName
}

const onProviderChange = () => {
  props.providerManager.setCurrentProvider(selectedProvider.value)
  loadApiKey()
  loadModel()
  emit('providerChanged', selectedProvider.value)
}

const onApiKeyChange = () => {
  const provider = props.providerManager.getCurrentProvider()
  if (provider && typeof provider.setApiKey === 'function') {
    provider.setApiKey(apiKey.value)
  }
  emit('apiKeyChanged', apiKey.value)
}

const onModelChange = () => {
  props.providerManager.setProviderModel(selectedProvider.value, selectedModel.value)
  emit('modelChanged', selectedModel.value)
}

const loadApiKey = () => {
  const provider = props.providerManager.getCurrentProvider()
  apiKey.value = typeof provider.loadApiKey === 'function' ? provider.loadApiKey() : ''
}

const loadModel = () => {
  if (currentProviderConfig.value?.supportsModels) {
    props.providerManager.loadProviderModel(selectedProvider.value)
    const model = props.providerManager.getProviderModel(selectedProvider.value)
    selectedModel.value = model || currentProviderConfig.value.models?.[0]?.id || ''
  }
}

const initializeProvider = () => {
  selectedProvider.value = props.providerManager.getCurrentProviderName()
  loadApiKey()
  loadModel()
}

onMounted(() => {
  initializeProvider()
})

// Watch for external provider changes
watch(
  () => props.providerManager.getCurrentProviderName(),
  newProvider => {
    if (newProvider !== selectedProvider.value) {
      selectedProvider.value = newProvider
      loadApiKey()
      loadModel()
    }
  }
)
</script>

<template>
  <div class="api-config">
    <h3>⚙️ API 配置</h3>

    <!-- Provider Selection -->
    <div class="config-item">
      <label for="providerSelect">选择服务商</label>
      <ADropdown>
        <template #overlay>
          <AMenu @click="info => onProviderSelect(info)">
            <AMenu.Item v-for="provider in providerNames" :key="provider" :value="provider">
              {{ getProviderDisplayName(provider) }}
            </AMenu.Item>
          </AMenu>
        </template>
        <AButton>
          {{ providerDisplay }}
          <DownOutlined />
        </AButton>
      </ADropdown>
    </div>

    <!-- API Key Input -->
    <div class="config-item">
      <input
        type="password"
        v-model="apiKey"
        @input="onApiKeyChange"
        :placeholder="currentProviderConfig?.placeholder || '请输入您的 API Key'"
        class="form-input"
      />
      <small class="help-text">
        {{ currentProviderConfig?.helpText }}:
        <a :href="currentProviderConfig?.helpLink" target="_blank" class="help-link">
          {{ getProviderDisplayName(selectedProvider) }}
        </a>
      </small>
    </div>

    <!-- Model Selection for providers that support it -->
    <div v-if="currentProviderConfig?.supportsModels" class="config-item">
      <label for="modelSelect">选择模型</label>
      <ADropdown>
        <template #overlay>
          <AMenu @click="info => onModelSelect(info)">
            <AMenu.Item
              v-for="model in currentProviderConfig.models"
              :key="model.id"
              :value="model.id"
            >
              {{ model.name }}
            </AMenu.Item>
          </AMenu>
        </template>
        <AButton>
          {{ selectedModelLabel }}
          <DownOutlined />
        </AButton>
      </ADropdown>
    </div>
  </div>
</template>

<style scoped>
.api-config {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.api-config h3 {
  margin: 0 0 15px 0;
  color: #856404;
  font-size: 16px;
  font-weight: 600;
}

.config-item {
  margin-bottom: 15px;
}

.config-item:last-child {
  margin-bottom: 0;
}

.config-item label {
  display: block;
  margin-bottom: 5px;
  font-weight: 600;
  color: #856404;
}

.form-select,
.form-input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ffeaa7;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-select:focus,
.form-input:focus {
  outline: none;
  border-color: #f39c12;
  box-shadow: 0 0 0 2px rgba(243, 156, 18, 0.2);
}

.help-text {
  color: #856404;
  margin-top: 5px;
  display: block;
  font-size: 12px;
}

.help-link {
  color: #856404;
  text-decoration: underline;
}

.help-link:hover {
  color: #6c5ce7;
}
</style>
