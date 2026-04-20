<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import {
  DownOutlined,
  RobotOutlined,
  TagOutlined,
  PlusOutlined,
  CloseOutlined
} from '@ant-design/icons-vue'

import { useEmojiStore } from '../../stores/emojiStore'
import type { Emoji } from '../../types/type'
import { emojiPreviewUploader } from '../utils/emojiPreviewUploader'
import { getEmojiImageUrlSync } from '../../utils/imageUrlHelper'
import CachedImage from '../../components/CachedImage.vue'

import GeminiNamingModal from './GeminiNamingModal.vue'

const props = defineProps<{
  show: boolean
  emoji?: Emoji
  groupId?: string
  index?: number
}>()

const emit = defineEmits(['update:show', 'save', 'imageError'])

const emojiStore = useEmojiStore()

const localEmoji = ref<Partial<Emoji>>({
  name: '',
  url: '',
  short_url: '',
  displayUrl: '',
  customOutput: '',
  tags: []
})

const showGeminiModal = ref(false)

// 標籤編輯相關
const newTag = ref('')
const showTagSuggestions = ref(false)

// Helper to hide tag suggestions with delay
const hideTagSuggestionsDelayed = () => {
  setTimeout(() => (showTagSuggestions.value = false), 200)
}

// 獲取當前表情的標籤
const currentTags = computed(() => {
  return localEmoji.value.tags || []
})

// 獲取建議標籤（來自熱門標籤但不在當前標籤中）
const suggestedTags = computed(() => {
  const popularTags = emojiStore.allTags.map(t => t.name).slice(0, 10)
  return popularTags.filter(tag => !currentTags.value.includes(tag))
})

// 添加新標籤
const addTag = () => {
  const trimmedTag = newTag.value.trim()
  if (trimmedTag && !currentTags.value.includes(trimmedTag)) {
    if (!localEmoji.value.tags) {
      localEmoji.value.tags = []
    }
    localEmoji.value.tags.push(trimmedTag)
    newTag.value = ''
    showTagSuggestions.value = false
  }
}

// 添加建議標籤
const addSuggestedTag = (tag: string) => {
  if (!localEmoji.value.tags) {
    localEmoji.value.tags = []
  }
  localEmoji.value.tags.push(tag)
}

// 移除標籤
const removeTag = (tag: string) => {
  if (localEmoji.value.tags) {
    const index = localEmoji.value.tags.indexOf(tag)
    if (index !== -1) {
      localEmoji.value.tags.splice(index, 1)
    }
  }
}

// 處理標籤輸入框回車
const handleTagInputEnter = (e: KeyboardEvent) => {
  e.preventDefault()
  addTag()
}

const openGeminiNaming = () => {
  if (!localEmoji.value.url?.trim()) {
    return
  }
  showGeminiModal.value = true
}

const handleGeminiNameSelected = (selectedName: string) => {
  if (localEmoji.value) {
    localEmoji.value.name = selectedName
  }
  showGeminiModal.value = false
}

// Upload functionality
const uploadingEmojiIds = ref(new Set<string>())

// Check if current URL contains linux.do
const shouldShowUploadButton = computed(() => {
  return !localEmoji.value.url?.includes('linux.do')
})

// Upload single emoji to linux.do
const uploadSingleEmoji = async (emoji: Partial<Emoji>) => {
  if (!emoji.url || !emoji.id || uploadingEmojiIds.value.has(emoji.id)) return

  try {
    uploadingEmojiIds.value.add(emoji.id)

    // Get image file
    const response = await fetch(emoji.url)
    const blob = await response.blob()
    const fileName = `${emoji.name}.${blob.type.split('/')[1] || 'png'}`
    const file = new File([blob], fileName, { type: blob.type })

    // Upload to linux.do and update store with returned url
    try {
      const resp = await emojiPreviewUploader.uploadEmojiImage(file, emoji.name || 'emoji')
      if (resp && resp.url && emoji.id) {
        emojiStore.updateEmoji(emoji.id, {
          url: resp.url,
          displayUrl: resp.url,
          short_url: resp.short_url || undefined
        })
        // 同步更新 UI 显示的 URL
        localEmoji.value.url = resp.url
        localEmoji.value.displayUrl = resp.url
        localEmoji.value.short_url = resp.short_url || undefined
      }
    } finally {
      // Show upload progress dialog regardless
      emojiPreviewUploader.showProgressDialog()
    }
  } catch (error: any) {
    console.error('表情上传失败：', error)
    alert(`表情 "${emoji.name}" 上传失败：${error.message || '未知错误'}`)
  } finally {
    uploadingEmojiIds.value.delete(emoji.id)
  }
}

// 图片加载状态
const imageLoadError = ref(false)
const proxyBlobUrl = ref<string | null>(null)
const isLoadingViaProxy = ref(false)

function handleImageLoad() {
  imageLoadError.value = false
}

async function handleImageError() {
  // 如果已经在加载代理或者已经有代理 URL，不再处理
  if (isLoadingViaProxy.value || proxyBlobUrl.value) {
    return
  }

  const srcUrl = localEmoji.value.displayUrl || localEmoji.value.url
  if (!srcUrl) {
    imageLoadError.value = true
    return
  }

  // 尝试通过代理获取图片（不创建缓存）
  isLoadingViaProxy.value = true
  try {
    const { fetchImageForPreview } = await import('@/utils/imageCache')
    const blobUrl = await fetchImageForPreview(srcUrl)
    if (blobUrl) {
      proxyBlobUrl.value = blobUrl
      imageLoadError.value = false
    } else {
      imageLoadError.value = true
    }
  } catch {
    imageLoadError.value = true
  } finally {
    isLoadingViaProxy.value = false
  }
}

// 图片预览可见性（用于 a-image preview group）
const visible = ref(false)

const selectedGroupId = ref<string>('')

// 可用的分组列表（排除常用分组）
const availableGroups = computed(() => {
  return emojiStore.groups.filter(g => g.id !== 'favorites')
})

const onEditGroupSelect = (info: { key: string | number }) => {
  selectedGroupId.value = String(info.key)
}

const editSelectedGroupIcon = computed(() => {
  const g = availableGroups.value.find(x => x.id === selectedGroupId.value)
  return g ? g.icon : ''
})

const editSelectedGroupName = computed(() => {
  const g = availableGroups.value.find(x => x.id === selectedGroupId.value)
  return g ? g.name : '选择分组'
})

watch(
  () => props.emoji,
  newEmoji => {
    if (newEmoji) {
      localEmoji.value = { ...newEmoji }
      selectedGroupId.value = newEmoji.groupId || props.groupId || ''
      imageLoadError.value = false // 重置图片错误状态
      isLoadingViaProxy.value = false
      // 释放旧的代理 blob URL
      if (proxyBlobUrl.value) {
        URL.revokeObjectURL(proxyBlobUrl.value)
        proxyBlobUrl.value = null
      }
    }
  },
  { immediate: true }
)

watch(
  () => props.groupId,
  newGroupId => {
    if (newGroupId && !selectedGroupId.value) {
      selectedGroupId.value = newGroupId
    }
  },
  { immediate: true }
)

// 监听 URL 变化，重置图片错误状态
watch(
  () => [localEmoji.value.url, localEmoji.value.displayUrl],
  () => {
    imageLoadError.value = false
    // 释放旧的代理 blob URL
    if (proxyBlobUrl.value) {
      URL.revokeObjectURL(proxyBlobUrl.value)
      proxyBlobUrl.value = null
    }
  }
)

const closeModal = () => {
  emit('update:show', false)
}

const handleSubmit = () => {
  if (
    props.groupId !== undefined &&
    props.index !== undefined &&
    localEmoji.value.name &&
    localEmoji.value.url
  ) {
    const updatedEmoji: Emoji = {
      id: props.emoji?.id || '',
      packet: props.emoji?.packet || Date.now(),
      name: localEmoji.value.name,
      url: localEmoji.value.url,
      short_url: localEmoji.value.short_url || undefined,
      displayUrl: localEmoji.value.displayUrl || undefined,
      customOutput: localEmoji.value.customOutput || undefined,
      groupId: selectedGroupId.value,
      width: localEmoji.value.width,
      height: localEmoji.value.height,
      usageCount: localEmoji.value.usageCount,
      lastUsed: localEmoji.value.lastUsed,
      addedAt: localEmoji.value.addedAt,
      tags: localEmoji.value.tags || [] // 确保包含标签字段
    }

    emit('save', {
      emoji: updatedEmoji,
      groupId: props.groupId,
      index: props.index,
      targetGroupId: selectedGroupId.value !== props.groupId ? selectedGroupId.value : undefined
    })
    closeModal()
  }
}
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 overflow-y-auto"
    aria-labelledby="modal-title"
    role="dialog"
    aria-modal="true"
  >
    <transition name="overlay-fade">
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75" @click="closeModal"></div>
    </transition>

    <div class="flex items-center justify-center min-h-screen p-4">
      <transition name="card-pop" appear>
        <ACard hoverable style="max-width: 90vw; width: 800px; max-height: 90vh; overflow-y: auto">
          <div class="flex flex-col gap-6">
            <!-- 上方编辑区 -->
            <div class="w-full">
              <div class="mb-4">
                <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {{ localEmoji.name || '编辑表情' }}
                </h2>
                <div class="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {{ localEmoji.url || '请填写表情链接' }}
                </div>
              </div>

              <form @submit.prevent="handleSubmit" class="space-y-4">
                <!-- Name field -->
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <label
                      for="emoji-name"
                      class="block text-sm font-medium text-gray-700 dark:text-white"
                    >
                      表情名称
                    </label>
                    <a-button
                      v-if="localEmoji.url?.trim()"
                      size="small"
                      type="link"
                      @click="openGeminiNaming"
                      title="使用 AI 智能命名"
                    >
                      <RobotOutlined />
                      AI 命名
                    </a-button>
                  </div>
                  <input
                    id="emoji-name"
                    v-model="localEmoji.name"
                    type="text"
                    class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-black dark:text-white dark:border-gray-600"
                    placeholder="输入表情名称"
                    required
                    @keydown.enter.prevent="handleSubmit"
                    title="表情名称"
                  />
                </div>

                <!-- Output URL field -->
                <div>
                  <label
                    for="emoji-url"
                    class="block text-sm font-medium text-gray-700 dark:text-white"
                  >
                    输出链接 (必填)
                  </label>
                  <input
                    id="emoji-url"
                    v-model="localEmoji.url"
                    type="url"
                    class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-black dark:text-white dark:border-gray-600"
                    placeholder="https://example.com/emoji.png"
                    required
                    @keydown.enter.prevent="handleSubmit"
                    title="表情输出链接"
                  />
                  <p class="mt-1 text-xs text-gray-500 dark:text-white">插入到编辑器时使用的链接</p>
                </div>

                <!-- Display URL field -->
                <div>
                  <label
                    for="emoji-display-url"
                    class="block text-sm font-medium text-gray-700 dark:text-white"
                  >
                    显示链接 (可选)
                  </label>
                  <input
                    id="emoji-display-url"
                    v-model="localEmoji.displayUrl"
                    type="url"
                    class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-black dark:text-white dark:border-gray-600"
                    placeholder="https://example.com/preview.png"
                    @keydown.enter.prevent="handleSubmit"
                    title="表情显示链接 (可选)"
                  />
                  <p class="mt-1 text-xs text-gray-500 dark:text-white">
                    表情选择器中显示的链接，留空则使用输出链接
                  </p>
                </div>

                <!-- Custom Output field -->
                <div>
                  <label
                    for="emoji-custom-output"
                    class="block text-sm font-medium text-gray-700 dark:text-white"
                  >
                    自定义输出内容 (可选)
                  </label>
                  <textarea
                    id="emoji-custom-output"
                    v-model="localEmoji.customOutput"
                    rows="3"
                    class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-black dark:text-white dark:border-gray-600"
                    placeholder="留空则使用默认的 Markdown/HTML 格式"
                    title="自定义输出内容 (可选)"
                  />
                  <p class="mt-1 text-xs text-gray-500 dark:text-white">
                    点击表情时插入/复制此自定义内容。留空则使用默认的 Markdown 或 HTML 格式输出
                  </p>
                </div>

                <!-- Width and Height fields -->
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      for="emoji-width"
                      class="block text-sm font-medium text-gray-700 dark:text-white"
                    >
                      宽度 (px)
                    </label>
                    <input
                      id="emoji-width"
                      v-model.number="localEmoji.width"
                      type="number"
                      min="1"
                      class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-black dark:text-white dark:border-gray-600"
                      placeholder="可选，像素"
                      @keydown.enter.prevent="handleSubmit"
                      title="表情宽度 (像素)"
                    />
                  </div>
                  <div>
                    <label
                      for="emoji-height"
                      class="block text-sm font-medium text-gray-700 dark:text-white"
                    >
                      高度 (px)
                    </label>
                    <input
                      id="emoji-height"
                      v-model.number="localEmoji.height"
                      type="number"
                      min="1"
                      class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-black dark:text-white dark:border-gray-600"
                      placeholder="可选，像素"
                      @keydown.enter.prevent="handleSubmit"
                      title="表情高度 (像素)"
                    />
                  </div>
                </div>

                <!-- 標籤編輯 -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-white mb-2">
                    <TagOutlined class="mr-1" />
                    表情標籤
                  </label>

                  <!-- 當前標籤顯示 -->
                  <div v-if="currentTags.length > 0" class="flex flex-wrap gap-2 mb-3">
                    <span
                      v-for="tag in currentTags"
                      :key="tag"
                      class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                    >
                      {{ tag }}
                      <button
                        htmlType="button"
                        @click="removeTag(tag)"
                        class="ml-1 text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100"
                        title="移除標籤"
                      >
                        <CloseOutlined class="text-xs" />
                      </button>
                    </span>
                  </div>

                  <!-- 添加新標籤 -->
                  <div class="relative">
                    <div class="flex gap-2">
                      <input
                        v-model="newTag"
                        type="text"
                        class="flex-1 mt-1 block border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-black dark:text-white dark:border-gray-600"
                        placeholder="輸入新標籤..."
                        @focus="showTagSuggestions = true"
                        @blur="hideTagSuggestionsDelayed"
                        @keydown.enter="handleTagInputEnter"
                      />
                      <button
                        htmlType="button"
                        @click="addTag"
                        :disabled="!newTag.trim()"
                        class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <PlusOutlined />
                      </button>
                    </div>

                    <!-- 建議標籤下拉 -->
                    <div
                      v-if="showTagSuggestions && suggestedTags.length > 0"
                      class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-40 overflow-y-auto"
                    >
                      <div class="p-2">
                        <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">建議標籤：</div>
                        <div class="flex flex-wrap gap-2">
                          <button
                            v-for="tag in suggestedTags"
                            :key="tag"
                            htmlType="button"
                            @click="addSuggestedTag(tag)"
                            class="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                          >
                            {{ tag }}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    添加標籤以更好地組織和搜索你的表情
                  </p>
                </div>

                <!-- Group Selection -->
                <div v-if="availableGroups.length > 0">
                  <label
                    for="emoji-group"
                    class="block text-sm font-medium text-gray-700 dark:text-white"
                  >
                    选择分组
                  </label>
                  <a-dropdown>
                    <template #overlay>
                      <a-menu @click="onEditGroupSelect">
                        <a-menu-item
                          v-for="group in availableGroups"
                          :key="group.id"
                          :value="group.id"
                        >
                          <CachedImage
                            v-if="group.icon.startsWith('https://')"
                            :src="group.icon"
                            class="inline-block mr-1"
                            style="max-width: 20px"
                          />
                          <span v-else class="inline-block mr-1">{{ group.icon }}</span>
                          {{ group.name }}
                        </a-menu-item>
                      </a-menu>
                    </template>
                    <a-button class="dark:text-white dark:bg-gray-800" title="选择表情所属分组">
                      <CachedImage
                        v-if="editSelectedGroupIcon.startsWith('https://')"
                        :src="editSelectedGroupIcon"
                        class="inline-block mr-1"
                        style="max-width: 20px"
                      />
                      <span v-else class="inline-block mr-1">{{ editSelectedGroupIcon }}</span>
                      {{ editSelectedGroupName }}
                      <DownOutlined />
                    </a-button>
                  </a-dropdown>
                </div>

                <!-- Buttons -->
                <div class="mt-4 space-y-3">
                  <!-- Upload button (conditional) -->
                  <div v-if="shouldShowUploadButton" class="w-full">
                    <a-button
                      htmlType="button"
                      @click="uploadSingleEmoji(localEmoji)"
                      :disabled="uploadingEmojiIds.has(localEmoji.id || '')"
                      title="上传到linux.do"
                      class="w-full inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-500 text-base font-medium text-white hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-300 disabled:cursor-not-allowed sm:text-sm"
                    >
                      <span v-if="uploadingEmojiIds.has(localEmoji.id || '')" class="mr-2">⏳</span>
                      <span v-else class="mr-2">📤</span>
                      上传到 linux.do
                    </a-button>
                  </div>

                  <!-- Save and Cancel buttons -->
                  <div class="grid grid-cols-2 gap-3">
                    <a-button
                      htmlType="button"
                      @click="handleSubmit"
                      class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm"
                      title="保存表情更改"
                    >
                      保存
                    </a-button>
                    <a-button
                      htmlType="button"
                      @click="closeModal"
                      class="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm dark:bg-black dark:text-white dark:border-gray-600"
                      title="取消编辑表情"
                    >
                      取消
                    </a-button>
                  </div>
                </div>
              </form>
            </div>

            <!-- 下方预览区 -->
            <div class="w-full">
              <div
                class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
              >
                <h4 class="text-sm font-medium text-gray-700 dark:text-white mb-3">图片预览</h4>
                <div class="flex items-center justify-center min-h-48">
                  <!-- 通过代理加载的图片 -->
                  <a-image
                    v-if="proxyBlobUrl"
                    :preview="{ visible: false }"
                    :src="proxyBlobUrl"
                    class="object-contain w-full h-full max-h-96 rounded-lg border cursor-pointer"
                    style="max-width: 500px"
                    @click="visible = true"
                  />

                  <!-- 有 URL 且未出错时显示图片 -->
                  <a-image
                    v-else-if="
                      (localEmoji.displayUrl || localEmoji.url) &&
                      !imageLoadError &&
                      !isLoadingViaProxy
                    "
                    :preview="{ visible: false }"
                    :src="getEmojiImageUrlSync(localEmoji as Emoji)"
                    class="object-contain w-full h-full max-h-96 rounded-lg border cursor-pointer"
                    style="max-width: 500px"
                    @load="handleImageLoad"
                    @click="visible = true"
                    @error="handleImageError"
                  />

                  <!-- URL 为空时的占位符 -->
                  <div
                    v-else-if="!localEmoji.displayUrl && !localEmoji.url"
                    class="flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 h-48 w-full"
                  >
                    <div class="text-center text-gray-500 dark:text-gray-400">
                      <div class="text-4xl mb-2">🖼️</div>
                      <div class="text-sm">请输入图片链接</div>
                    </div>
                  </div>

                  <!-- 正在通过代理加载 -->
                  <div
                    v-else-if="isLoadingViaProxy"
                    class="flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 h-48 w-full"
                  >
                    <div class="text-center text-gray-500 dark:text-gray-400">
                      <div
                        class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"
                      ></div>
                      <div class="text-sm">正在通过代理加载...</div>
                    </div>
                  </div>

                  <!-- 图片加载失败时的占位符 -->
                  <div
                    v-else-if="imageLoadError"
                    class="flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 h-48 w-full"
                  >
                    <div class="text-center text-gray-500 dark:text-gray-400">
                      <div class="text-4xl mb-2">📷</div>
                      <div class="text-sm">图片加载失败</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ACard>
      </transition>
    </div>
    <div style="display: none">
      <a-image-preview-group
        :preview="{ visible, onVisibleChange: (vis: boolean) => (visible = vis) }"
      >
        <a-image :src="getEmojiImageUrlSync(localEmoji as Emoji)" />
      </a-image-preview-group>
    </div>

    <!-- Gemini Naming Modal -->
    <GeminiNamingModal
      :show="showGeminiModal"
      :image-url="localEmoji.url || ''"
      @update:show="showGeminiModal = $event"
      @nameSelected="handleGeminiNameSelected"
    />
  </div>
</template>

<style scoped>
/* overlay fade */
.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}
.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition: opacity 220ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* card pop: fade + slight translate + scale */
.card-pop-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
}
.card-pop-enter-to {
  opacity: 1;
  transform: translateY(0) scale(1);
}
.card-pop-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}
.card-pop-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}
.card-pop-enter-active,
.card-pop-leave-active {
  transition:
    opacity 220ms cubic-bezier(0.4, 0, 0.2, 1),
    transform 220ms cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
