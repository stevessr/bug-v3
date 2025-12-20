<script setup lang="ts">
import { ref, inject } from 'vue'

import type { OptionsInject } from '../types'
import BilibiliEmoteModal from '../modals/BilibiliEmoteModal.vue'

const options = inject<OptionsInject>('options')!
const { emojiStore } = options

const showBilibiliModal = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')

const handleBilibiliImport = async (data: any) => {
  try {
    isLoading.value = true
    errorMessage.value = ''

    // 调用composable中的导入方法
    if (typeof options.handleEmojisImported === 'function') {
      await options.handleEmojisImported(data)
    }

    showBilibiliModal.value = false
  } catch (error) {
    console.error('导入bilibili表情失败:', error)
    errorMessage.value = error instanceof Error ? error.message : '导入失败'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="p-6">
    <div class="max-w-4xl mx-auto">
      <!-- 页面标题 -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Bilibili 表情导入</h1>
        <p class="text-gray-600 dark:text-gray-400">通过表情包ID从Bilibili导入表情包到插件中</p>
      </div>

      <!-- 错误信息 -->
      <div
        v-if="errorMessage"
        class="mb-6 p-4 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-md"
      >
        <p class="text-red-800 dark:text-red-200">{{ errorMessage }}</p>
      </div>

      <!-- 主要内容区域 -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <!-- 功能说明 -->
        <div class="mb-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">功能说明</h2>
          <ul class="space-y-2 text-gray-600 dark:text-gray-400">
            <li class="flex items-start">
              <span class="text-pink-500 mr-2">•</span>
              <span>通过表情包ID导入特定的Bilibili表情包</span>
            </li>
            <li class="flex items-start">
              <span class="text-pink-500 mr-2">•</span>
              <span>支持导入任意有效的Bilibili表情包</span>
            </li>
            <li class="flex items-start">
              <span class="text-pink-500 mr-2">•</span>
              <span>可连续导入多个表情包</span>
            </li>
            <li class="flex items-start">
              <span class="text-pink-500 mr-2">•</span>
              <span>支持自定义分组或按表情包名称创建新分组</span>
            </li>
            <li class="flex items-start">
              <span class="text-pink-500 mr-2">•</span>
              <span>无需登录Bilibili账号即可使用</span>
            </li>
          </ul>
        </div>

        <!-- 导入按钮 -->
        <div class="text-center">
          <button
            @click="showBilibiliModal = true"
            :disabled="isLoading"
            class="inline-flex items-center gap-2 px-6 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.906c0-.356.124-.658.373-.907l.027-.027c.267-.249.573-.373.92-.373.347 0 .653.124.92.373L9.653 4.44c.071.071.134.142.187.213h4.267a.836.836 0 0 1 .16-.213l2.853-2.747c.267-.249.573-.373.92-.373.347 0 .662.151.929.4.267.249.391.551.391.907 0 .355-.124.657-.373.906zM5.333 7.24c-.746.018-1.373.276-1.88.773-.506.498-.769 1.13-.789 1.894v7.52c.02.765.283 1.395.789 1.893.507.498 1.134.756 1.88.773h13.334c.746-.017 1.373-.275 1.88-.773.506-.498.769-1.128.789-1.893v-7.52c-.02-.765-.283-1.396-.789-1.894-.507-.497-1.134-.755-1.88-.773zM8 11.107c.373 0 .684.124.933.373.249.249.383.569.4.96v1.173c-.017.391-.151.711-.4.96-.249.249-.56.373-.933.373s-.684-.124-.933-.373a1.303 1.303 0 0 1-.4-.96V12.44c.017-.391.151-.711.4-.96.249-.249.56-.373.933-.373zm8 0c.373 0 .684.124.933.373.249.249.383.569.4.96v1.173c-.017.391-.151.711-.4.96-.249.249-.56.373-.933.373s-.684-.124-.933-.373a1.303 1.303 0 0 1-.4-.96V12.44c.017-.391.151-.711.4-.96.249-.249.56-.373.933-.373z"
              />
            </svg>
            <span v-if="isLoading">导入中...</span>
            <span v-else>开始导入 Bilibili 表情</span>
          </button>
        </div>

        <!-- 使用提示 -->
        <div
          class="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md"
        >
          <h3 class="font-medium text-blue-900 dark:text-blue-100 mb-2">💡 使用提示</h3>
          <ul class="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• 点击上方按钮打开 Bilibili 表情包导入界面</li>
            <li>• 在输入框中输入要导入的表情包ID</li>
            <li>• 点击"导入"按钮或按回车键导入表情包</li>
            <li>• 可以连续导入多个表情包</li>
            <li>• 可以选择目标分组或创建新分组</li>
            <li>• 导入完成后表情将出现在对应的分组中</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Bilibili表情导入模态框 -->
    <BilibiliEmoteModal v-model="showBilibiliModal" @imported="handleBilibiliImport" />
  </div>
</template>
