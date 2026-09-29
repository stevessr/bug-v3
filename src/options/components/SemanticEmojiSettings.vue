<script setup lang="ts">
import { ref, watch } from 'vue'

import type { AppSettings } from '@/types/type'
import { useEmojiStore } from '@/stores/emojiStore'

const props = defineProps<{ settings: AppSettings }>()
const store = useEmojiStore()
const enabled = ref(false)
const contextEnabled = ref(false)
const endpoint = ref('')
const apiKey = ref('')
const model = ref('')
const status = ref('')

watch(
  () => props.settings,
  value => {
    enabled.value = Boolean(value.semanticSearchEnabled)
    contextEnabled.value = Boolean(value.semanticContextSuggestionsEnabled)
    endpoint.value = value.semanticEmbeddingEndpoint || 'https://api.openai.com/v1'
    apiKey.value = value.semanticEmbeddingApiKey || ''
    model.value = value.semanticEmbeddingModel || 'text-embedding-3-small'
  },
  { immediate: true }
)

function save() {
  status.value = ''
  try {
    const url = new URL(endpoint.value.trim())
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (
      (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
      url.username || url.password || url.search || url.hash
    ) throw new Error('请使用 HTTPS，或 localhost HTTP，不要在 URL 中填写密钥')
    if (!model.value.trim()) throw new Error('请填写 Embedding 模型')
    if (enabled.value && !apiKey.value.trim() && url.protocol !== 'http:') {
      throw new Error('使用远程 Embedding 服务需要填写 API Key')
    }
    store.updateSettings({
      semanticSearchEnabled: enabled.value,
      semanticContextSuggestionsEnabled: enabled.value && contextEnabled.value,
      semanticEmbeddingEndpoint: url.toString(),
      semanticEmbeddingApiKey: apiKey.value.trim(),
      semanticEmbeddingModel: model.value.trim()
    })
    status.value = '配置已保存'
  } catch (error) {
    status.value = error instanceof Error ? error.message : '配置无效'
  }
}
</script>

<template>
  <div class="mt-6 rounded-lg border border-gray-200 p-5 dark:border-gray-700 space-y-3">
    <div class="flex items-center justify-between gap-3">
      <div>
        <h3 class="font-medium dark:text-white">表情包语义联想（实验性）</h3>
        <p class="text-xs text-gray-500 mt-1">
          使用文本 Embedding 模型，根据一句话联想名称、标签语义相近的收藏表情。
        </p>
      </div>
      <a-switch v-model:checked="enabled" />
    </div>
    <p class="text-xs text-amber-700 dark:text-amber-300">
      默认关闭。基础模式仅在表情搜索框中输入至少 2 个字符时请求服务。
      查询文字和表情名称/标签/分组名会发送给配置的提供商，不上传图片。
      不会自动发送聊天历史。API 请求可能计费。
    </p>
    <div class="flex items-center justify-between gap-4">
      <div>
        <div class="text-sm dark:text-white">Discourse 聊天/帖子输入时自动联想（单独授权）</div>
        <p class="text-xs text-amber-700 dark:text-amber-300">
          启用后监听当前正在输入的编辑器，停止输入约 900 ms 后，
          仅将最后一段文字（最多 80 字符）发送给配置的 Embedding 提供商；
          不读取既有消息或其他网页输入框。可以随时关闭。
        </p>
      </div>
      <a-switch v-model:checked="contextEnabled" :disabled="!enabled" />
    </div>
    <div>
      <label class="block text-sm mb-1 dark:text-white">Embedding API Base URL</label>
      <a-input v-model:value="endpoint" placeholder="https://api.openai.com/v1" />
      <p class="text-xs text-gray-500 mt-1">兼容 POST /embeddings，也可填写完整 /embeddings 路径；支持本机自托管。</p>
    </div>
    <div>
      <label class="block text-sm mb-1 dark:text-white">Embedding Model</label>
      <a-input v-model:value="model" placeholder="text-embedding-3-small" />
    </div>
    <div>
      <label class="block text-sm mb-1 dark:text-white">API Key</label>
      <a-input-password v-model:value="apiKey" placeholder="仅本机 HTTP 端点允许空 Key" />
    </div>
    <p class="text-xs text-gray-500">
      首次检索会按批次计算最多 1000 个表情的元数据向量；模型向量仅在后台内存缓存，
      浏览器重启或扩展 Service Worker 重启后会重建。没有描述性名称/标签的图片不会自动识图。
    </p>
    <div class="flex justify-end gap-3 items-center">
      <span v-if="status" role="status" class="text-xs dark:text-gray-200">{{ status }}</span>
      <a-button type="primary" @click="save">保存语义联想设置</a-button>
    </div>
  </div>
</template>
