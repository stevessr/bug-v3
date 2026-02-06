import { ref } from 'vue'

import { fetchAiTopicSummary, requestAiTopicSummaryRegenerate } from '../actions'

type Notify = {
  info: (message: string) => void
  warning: (message: string) => void
  error: (message: string) => void
}

export function useAiSummary(options: { baseUrl: string; topicId: number; notify: Notify }) {
  const aiSummary = ref<string | null>(null)
  const aiMeta = ref<{
    algorithm?: string
    updatedAt?: string
    outdated?: boolean
    canRegenerate?: boolean
    newPosts?: number
  } | null>(null)
  const aiLoading = ref(false)
  const aiAvailable = ref(true)
  const aiErrorMessage = ref('')
  const showAiSummaryModal = ref(false)

  const fetchAiSummaryData = async () => {
    const fetchOnce = async () => {
      return await fetchAiTopicSummary(options.baseUrl, options.topicId)
    }
    let result = await fetchOnce()
    let summary = result.summary
    if (!summary?.summarized_text) {
      await new Promise(resolve => setTimeout(resolve, 1500))
      result = await fetchOnce()
      summary = result.summary
    }

    if (result.status === 404) {
      aiAvailable.value = false
      options.notify.info('当前站点未启用 AI 总结')
      return
    }

    if (!summary?.summarized_text) {
      aiErrorMessage.value = 'AI 总结暂不可用，请稍后再试'
      options.notify.warning(aiErrorMessage.value)
      return
    }

    aiSummary.value = summary.summarized_text
    aiMeta.value = {
      algorithm: summary.algorithm,
      updatedAt: summary.updated_at,
      outdated: summary.outdated,
      canRegenerate: summary.can_regenerate,
      newPosts: summary.new_posts_since_summary
    }
  }

  const handleAiSummary = async () => {
    if (aiLoading.value) return
    aiErrorMessage.value = ''
    showAiSummaryModal.value = true
    aiLoading.value = true
    try {
      await fetchAiSummaryData()
    } catch (error) {
      console.warn('[DiscourseBrowser] ai summary failed:', error)
      aiErrorMessage.value = 'AI 总结获取失败'
      options.notify.error(aiErrorMessage.value)
    } finally {
      aiLoading.value = false
    }
  }

  const handleAiRegenerate = async () => {
    if (aiLoading.value) return
    aiErrorMessage.value = ''
    aiLoading.value = true
    try {
      const result = await requestAiTopicSummaryRegenerate(options.baseUrl, options.topicId)
      if (result.status === 404) {
        aiAvailable.value = false
        options.notify.info('当前站点未启用 AI 总结')
        return
      }
      await new Promise(resolve => setTimeout(resolve, 1500))
      await fetchAiSummaryData()
    } catch (error) {
      console.warn('[DiscourseBrowser] ai summary regenerate failed:', error)
      aiErrorMessage.value = 'AI 总结重新生成失败'
      options.notify.error(aiErrorMessage.value)
    } finally {
      aiLoading.value = false
    }
  }

  return {
    aiSummary,
    aiMeta,
    aiLoading,
    aiAvailable,
    aiErrorMessage,
    showAiSummaryModal,
    handleAiSummary,
    handleAiRegenerate
  }
}
