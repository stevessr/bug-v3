import { ref } from 'vue'
import { message } from 'ant-design-vue'
import type { OpenRouterService } from '../../services/openrouter'
import storage from '../../data/update/storage'

export function useApiKeys(openRouterService: OpenRouterService) {
  const showApiKeyModal = ref(false)
  const apiKeys = ref<string[]>([])
  const tempApiKeys = ref<string[]>([''])
  const showKeys = ref<boolean[]>([false])

  const loadApiKeys = () => {
    try {
      let saved: any = null
      try {
        saved = storage.getItem('openrouter-api-keys')
      } catch (_) {
        saved = null
      }

      if (!saved) {
        try {
          const raw = localStorage.getItem('openrouter-api-keys')
          if (raw) saved = JSON.parse(raw)
        } catch (_) {
          saved = null
        }
      }

      if (saved) {
        apiKeys.value = saved
        openRouterService.setApiKeys(saved)
        // Also initialize temp keys for the modal
        tempApiKeys.value = [...saved, '']
        showKeys.value = new Array(tempApiKeys.value.length).fill(false)
      }
    } catch (e) {
      console.error('Failed to load API keys:', e)
    }
  }

  const saveApiKeysToStorage = () => {
    try {
      try {
        storage.setItem('openrouter-api-keys', apiKeys.value)
        return
      } catch (_) {
        // fallback
      }
      try {
        localStorage.setItem('openrouter-api-keys', JSON.stringify(apiKeys.value))
      } catch (e) {
        console.error('Failed to save API keys:', e)
      }
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
    openRouterService.setApiKeys(validKeys)
    saveApiKeysToStorage()
    showApiKeyModal.value = false
    message.success(`已保存 ${validKeys.length} 个 API Key`)
  }

  const cancelApiKeys = () => {
    // Reset temp keys from the currently saved keys
    tempApiKeys.value = [...apiKeys.value, '']
    showKeys.value = new Array(tempApiKeys.value.length).fill(false)
    showApiKeyModal.value = false
  }

  const openApiKeyModal = () => {
    // Before opening, ensure temp keys reflect the current state
    tempApiKeys.value = [...apiKeys.value, '']
    if (tempApiKeys.value.length === 0) {
      tempApiKeys.value.push('')
    }
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
