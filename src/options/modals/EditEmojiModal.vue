<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { DownOutlined } from '@ant-design/icons-vue'

import { useEmojiStore } from '../../stores/emojiStore'
import type { Emoji } from '../../types/emoji'
import { emojiPreviewUploader } from '../../utils/emojiPreviewUploader'

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
  displayUrl: ''
})

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
        emojiStore.updateEmoji(emoji.id, { url: resp.url })
      }
    } finally {
      // Show upload progress dialog regardless
      emojiPreviewUploader.showProgressDialog()
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('表情上传失败:', error)
    alert(`表情 "${emoji.name}" 上传失败: ${error.message || '未知错误'}`)
  } finally {
    uploadingEmojiIds.value.delete(emoji.id)
  }
}

// 图片宽高比与布局
const imageRatio = ref(1) // 宽/高
const isVertical = ref(false)

function handleImageLoad(e: Event) {
  const img = e.target as HTMLImageElement
  if (img && img.naturalWidth && img.naturalHeight) {
    imageRatio.value = img.naturalWidth / img.naturalHeight
    isVertical.value = imageRatio.value < 1
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
      displayUrl: localEmoji.value.displayUrl || undefined,
      groupId: selectedGroupId.value,
      width: localEmoji.value.width,
      height: localEmoji.value.height,
      usageCount: localEmoji.value.usageCount,
      lastUsed: localEmoji.value.lastUsed,
      addedAt: localEmoji.value.addedAt
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
        <ACard hoverable style="max-width: 80vw; width: 640px">
          <div :class="isVertical ? 'flex flex-row' : 'flex flex-col'">
            <!-- 图片区 -->
            <div
              v-if="isVertical"
              class="flex-shrink-0 flex items-center justify-center"
              style="width: 180px; min-width: 120px; max-width: 50%; height: 320px"
            >
              <a-image
                :preview="{ visible: false }"
                :src="localEmoji.displayUrl || localEmoji.url"
                class="object-contain w-full h-full"
                @load="handleImageLoad"
                @click="visible = true"
                @error="$emit('imageError', $event)"
              />
            </div>
            <div v-else class="w-full flex items-center justify-center">
              <a-image
                :preview="{ visible: false }"
                :src="localEmoji.displayUrl || localEmoji.url"
                class="object-contain max-h-full max-w-full"
                @load="handleImageLoad"
                @click="visible = true"
                @error="$emit('imageError', $event)"
              />
            </div>

            <!-- 内容区 -->
            <div class="flex-1 px-4 py-2">
              <a-card-meta :title="localEmoji.name || '编辑表情'">
                <template #description>
                  <div class="text-sm text-gray-500 dark:text-white truncate">
                    {{ localEmoji.url }}
                  </div>
                </template>
              </a-card-meta>

              <form @submit.prevent="handleSubmit" class="mt-4 space-y-4">
                <!-- Name field -->
                <div>
                  <label
                    for="emoji-name"
                    class="block text-sm font-medium text-gray-700 dark:text-white"
                  >
                    表情名称
                  </label>
                  <input
                    id="emoji-name"
                    v-model="localEmoji.name"
                    type="text"
                    class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-black dark:text-white dark:border-gray-600"
                    placeholder="输入表情名称"
                    required
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
                  />
                  <p class="mt-1 text-xs text-gray-500 dark:text-white">
                    表情选择器中显示的链接，留空则使用输出链接
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
                    />
                  </div>
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
                          <a-image
                            v-if="group.icon.startsWith('https://')"
                            :src="group.icon"
                            class="inline-block mr-1"
                            style="max-width: 10px"
                          />
                          <span v-else class="inline-block mr-1">{{ group.icon }}</span>
                          {{ group.name }}
                        </a-menu-item>
                      </a-menu>
                    </template>
                    <AButton class="dark:text-white dark:bg-gray-800">
                      <a-image
                        v-if="editSelectedGroupIcon.startsWith('https://')"
                        :src="editSelectedGroupIcon"
                        class="inline-block mr-1"
                        style="max-width: 10px"
                      />
                      <span v-else class="inline-block mr-1">{{ editSelectedGroupIcon }}</span>
                      {{ editSelectedGroupName }}
                      <DownOutlined />
                    </AButton>
                  </a-dropdown>
                </div>

                <!-- Buttons -->
                <div class="mt-4 space-y-3">
                  <!-- Upload button (conditional) -->
                  <div v-if="shouldShowUploadButton" class="w-full">
                    <button
                      type="button"
                      @click="uploadSingleEmoji(localEmoji)"
                      :disabled="uploadingEmojiIds.has(localEmoji.id || '')"
                      title="上传到linux.do"
                      class="w-full inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-500 text-base font-medium text-white hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-300 disabled:cursor-not-allowed sm:text-sm"
                    >
                      <span v-if="uploadingEmojiIds.has(localEmoji.id || '')" class="mr-2">⏳</span>
                      <span v-else class="mr-2">📤</span>
                      上传到linux.do
                    </button>
                  </div>

                  <!-- Save and Cancel buttons -->
                  <div class="grid grid-cols-2 gap-3">
                    <button
                      type="submit"
                      class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm"
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      @click="closeModal"
                      class="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm dark:bg-black dark:text-white dark:border-gray-600"
                    >
                      取消
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </ACard>
      </transition>
    </div>
    <div style="display: none">
      <a-image-preview-group
        :preview="{ visible, onVisibleChange: (vis: boolean) => (visible = vis) }"
      >
        <a-image :src="localEmoji.displayUrl || localEmoji.url" />
      </a-image-preview-group>
    </div>
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
