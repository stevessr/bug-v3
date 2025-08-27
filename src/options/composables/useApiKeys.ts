import { ref } from 'vue'
import { message } from 'ant-design-vue'
import type { OpenRouterService } from '../../services/openrouter'

// State is defined outside the function, making it a singleton
const showApiKeyModal = ref(false)
const apiKeys = ref<string[]>([])
const tempApiKeys = ref<string[]>([''])
const showKeys = ref<boolean[]>([false])

let serviceInstance: OpenRouterService | null = null

export function useApiKeys(openRouterService?: OpenRouterService) {
  if (openRouterService && !serviceInstance) {
    serviceInstance = openRouterService
  }

  const loadApiKeys = () => {
    try {
      const saved = localStorage.getItem('openrouter-api-keys')
      if (saved) {
        const keys = JSON.parse(saved)
        apiKeys.value = keys
        serviceInstance?.setApiKeys(keys)
        tempApiKeys.value = [...keys, '']
        showKeys.value = new Array(tempApiKeys.value.length).fill(false)
      }
    } catch (e) {
      console.error('Failed to load API keys:', e)
    }
  }

  const saveApiKeysToStorage = () => {
    try {
      localStorage.setItem('openrouter-api-keys', JSON.stringify(apiKeys.value))
    } catch (e) {
      console.error('Failed to save API keys:', e)
    }
  }

  const addApiKey = () => {
    tempApiKeys.value.push('')
    showKeys.value.push(false)
  }

  const removeApiKey = (index: number) => {
    tempApiKeys.value.splice(index, 1)
    showKeys.value.splice(index, 1)
  }

  const toggleKeyVisibility = (index: number) => {
    showKeys.value[index] = !showKeys.value[index]
  }

  const saveApiKeys = () => {
    const validKeys = tempApiKeys.value.filter((k) => k.trim())
    apiKeys.value = validKeys
    serviceInstance?.setApiKeys(validKeys)
    saveApiKeysToStorage()
    showApiKeyModal.value = false
    message.success(`已保存 ${validKeys.length} 个 API Key`)
  }

  const cancelApiKeys = () => {
    tempApiKeys.value = [...apiKeys.value, '']
    if (tempApiKeys.value.length === 1 && tempApiKeys.value[0] === '') {
      // ensure there's always one empty input if no keys are saved
    } else if (tempApiKeys.value.length > 1 && tempApiKeys.value[tempApiKeys.value.length - 1] !== '') {
       tempApiKeys.value.push('')
    }
    showKeys.value = new Array(tempApiKeys.value.length).fill(false)
    showApiKeyModal.value = false
  }
  
  const openApiKeyModal = () => {
    tempApiKeys.value = [...apiKeys.value, '']
    showKeys.value = new Array(tempApiKeys.value.length).fill(false)
    showApiKeyModal.value = true
  }

  return {
    showApiKeyModal,
    apiKeys,
    tempApiKeys,
    showKeys,
    loadApiKeys,
    addApiKey,
    removeApiKey,
    toggleKeyVisibility,
    saveApiKeys,
    cancelApiKeys,
    openApiKeyModal,
  }
}
