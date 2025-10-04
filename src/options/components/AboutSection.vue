<script setup lang="ts">
import { ref } from 'vue'

// 从 package.json 读取版本信息
const version = '1.1.6'
const extensionName = 'Emoji Extension'

// 功能统计
const stats = ref([
  { label: '支持网站', value: '10+', icon: '🌐' },
  { label: '表情管理', value: '无限制', icon: '😀' },
  { label: '分组支持', value: '自定义', icon: '📁' },
  { label: '存储方式', value: '本地 + 云端', icon: '☁️' }
])

const features = ref([
  {
    title: '🎯 精准插入',
    desc: '一键插入表情到任意输入框，支持多种插入模式'
  },
  {
    title: '📚 分组管理',
    desc: '智能分组管理，支持拖拽排序和批量操作'
  },
  {
    title: '🔄 数据同步',
    desc: 'Chrome 账户同步，多设备无缝体验'
  },
  {
    title: '🎨 自定义界面',
    desc: '响应式设计，支持深色模式和触屏操作'
  },
  {
    title: '🔍 智能搜索',
    desc: '实时搜索过滤，快速找到所需表情'
  },
  {
    title: '📤 云端存储',
    desc: '支持上传到 linux.do，永久保存表情链接'
  }
])

const supportedSites = ref([
  'Discord',
  'Reddit',
  'Twitter/X',
  'Pixiv',
  'Linux.do',
  'Bilibili',
  '小红书',
  'Waline 评论系统',
  'Discourse 论坛',
  '以及更多网站...'
])
</script>

<template>
  <div class="space-y-6">
    <!-- 扩展信息卡片 -->
    <div class="bg-white rounded-lg shadow-sm border dark:border-gray-700 dark:bg-gray-800">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center gap-3">
          <div class="text-2xl">😀</div>
          <div>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ extensionName }}</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">版本 {{ version }}</p>
          </div>
        </div>
      </div>
      <div class="p-6">
        <p class="text-gray-600 dark:text-gray-300 leading-relaxed">
          一个功能强大的浏览器扩展，让您能够在任何网站上轻松插入和管理自定义表情。
          支持多平台同步，智能分组管理，让表情使用更加便捷高效。
        </p>
      </div>
    </div>

    <!-- 功能统计 -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="bg-white rounded-lg shadow-sm border dark:border-gray-700 dark:bg-gray-800 p-4 text-center"
      >
        <div class="text-2xl mb-2">{{ stat.icon }}</div>
        <div class="text-lg font-semibold text-gray-900 dark:text-white">{{ stat.value }}</div>
        <div class="text-sm text-gray-500 dark:text-gray-400">{{ stat.label }}</div>
      </div>
    </div>

    <!-- 主要功能 -->
    <div class="bg-white rounded-lg shadow-sm border dark:border-gray-700 dark:bg-gray-800">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">🌟 主要功能</h3>
      </div>
      <div class="p-6">
        <div class="grid md:grid-cols-2 gap-4">
          <div
            v-for="feature in features"
            :key="feature.title"
            class="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50"
          >
            <h4 class="font-medium text-gray-900 dark:text-white mb-2">{{ feature.title }}</h4>
            <p class="text-sm text-gray-600 dark:text-gray-300">{{ feature.desc }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 支持网站 -->
    <div class="bg-white rounded-lg shadow-sm border dark:border-gray-700 dark:bg-gray-800">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">🌐 支持网站</h3>
      </div>
      <div class="p-6">
        <div class="flex flex-wrap gap-2">
          <span
            v-for="site in supportedSites"
            :key="site"
            class="px-3 py-1 text-sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full"
          >
            {{ site }}
          </span>
        </div>
      </div>
    </div>

    <!-- 技术信息 -->
    <div class="bg-white rounded-lg shadow-sm border dark:border-gray-700 dark:bg-gray-800">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">🛠️ 技术信息</h3>
      </div>
      <div class="p-6 space-y-4">
        <div class="grid md:grid-cols-2 gap-6">
          <div>
            <h4 class="font-medium text-gray-900 dark:text-white mb-3">开发技术</h4>
            <ul class="text-sm text-gray-600 dark:text-gray-300 space-y-1">
              <li>• Vue 3 + TypeScript</li>
              <li>• Ant Design Vue</li>
              <li>• Tailwind CSS</li>
              <li>• Chrome Extension APIs</li>
              <li>• Vite 构建工具</li>
            </ul>
          </div>
          <div>
            <h4 class="font-medium text-gray-900 dark:text-white mb-3">存储 & 同步</h4>
            <ul class="text-sm text-gray-600 dark:text-gray-300 space-y-1">
              <li>• Chrome Storage API</li>
              <li>• 账户同步支持</li>
              <li>• Linux.do 云端存储</li>
              <li>• 本地缓存优化</li>
              <li>• 数据导入导出</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- 更新日志 -->
    <div class="bg-white rounded-lg shadow-sm border dark:border-gray-700 dark:bg-gray-800">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">📝 更新日志</h3>
      </div>
      <div class="p-6 space-y-4">
        <div class="border-l-4 border-blue-500 pl-4">
          <div class="flex items-center gap-2 mb-1">
            <span class="font-medium text-gray-900 dark:text-white">v{{ version }}</span>
            <span
              class="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded"
            >
              当前版本
            </span>
          </div>
          <ul class="text-sm text-gray-600 dark:text-gray-300 space-y-1">
            <li>• 新增左右布局模态框设计</li>
            <li>• 优化图片预览和错误处理</li>
            <li>• 支持未分组表情管理</li>
            <li>• 改进上传到 linux.do 功能</li>
            <li>• 增强 UI 响应性和用户体验</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 保持样式由父级 Tailwind 提供，如需覆写可在此添加 */
</style>
