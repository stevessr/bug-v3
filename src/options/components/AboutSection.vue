<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import TypeIt from 'typeit'

// 从 package.json 读取版本信息（相对路径从当前文件到项目根）
import pkg from '../../../package.json'
const version = computed(() => {
  try {
    return chrome.runtime.getManifest().version || pkg?.version || 'dev'
  } catch {
    return pkg?.version || 'dev'
  }
})
const extensionName = pkg?.name || 'Emoji Extension'

type CommitEntry = {
  hash: string
  date: string
  subject: string
}
const recentCommits: CommitEntry[] = __APP_GIT_HISTORY__

// 功能统计
const stats = ref([
  { label: '支持网站', value: '10+', icon: '🌐' },
  { label: '表情管理', value: '无限制', icon: '😀' },
  { label: '分组支持', value: '自定义', icon: '📁' },
  { label: '数据安全', value: '本地优先', icon: '🔒' }
])

const features = ref([
  {
    title: '🎯 随处使用',
    desc: '通过弹出页、侧边栏和论坛编辑器快速查找并插入自定义表情'
  },
  {
    title: '📚 分组管理',
    desc: '创建、排序、归档和整理表情分组；常用表情按使用次数关联来源分组'
  },
  {
    title: '🔄 灵活同步',
    desc: '可配置 Cloudflare Worker、WebDAV 或 Amazon S3 同步自己的表情数据'
  },
  {
    title: '🎨 主题与界面',
    desc: '弹出页、设置页和侧边栏适配深色主题与不同窗口尺寸'
  },
  {
    title: '🔍 快速搜索',
    desc: '按名称、标签或分组筛选表情；Discourse 可选启用斜杠快捷选择'
  },
  {
    title: '📦 导入与上传',
    desc: '支持表情包导入、浏览器内媒体转换及 Discourse 上传；可选使用论坛原生上传器'
  }
])

const supportedSites = ref([
  'Discord',
  'Reddit',
  'Twitter/X',
  'Pixiv',
  'Linux.do',
  '小红书',
  'Discourse 论坛',
  '以及更多网站...'
])
// 使用 TypeIt 实现打字机效果
const fullText =
  'emoji-extension 是一款以本地数据为主的自定义表情管理扩展。你可以导入、整理表情分组，并在支持的网站中快速搜索和插入；同步与论坛上传服务均由你自行配置。'
const typeEl = ref<HTMLElement | null>(null)
let typeItInstance: any = null

onMounted(() => {
  if (typeEl.value) {
    typeItInstance = new TypeIt(typeEl.value, {
      lifeLike: true,
      speed: 30,
      cursor: true,
      waitUntilVisible: true,
      breakLines: false
    })
      .type(fullText)
      .go()
  }
})

onBeforeUnmount(() => {
  if (typeItInstance && typeof typeItInstance.destroy === 'function') {
    typeItInstance.destroy()
    typeItInstance = null
  }
})
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
          <span aria-live="polite" ref="typeEl"></span>
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

    <!-- 动态 Git 提交历史 -->
    <div class="bg-white rounded-lg shadow-sm border dark:border-gray-700 dark:bg-gray-800">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">📝 最近更新</h3>
      </div>
      <div v-if="recentCommits.length" class="divide-y divide-gray-200 dark:divide-gray-700">
        <div
          v-for="entry in recentCommits"
          :key="entry.hash"
          class="flex items-start gap-3 px-6 py-3"
        >
          <a
            class="shrink-0 rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            :href="`https://github.com/stevessr/bug-v3/commit/${entry.hash}`"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="`查看提交 ${entry.hash}`"
          >
            {{ entry.hash }}
          </a>
          <div class="min-w-0 flex-1">
            <div class="text-sm text-gray-900 dark:text-white">{{ entry.subject }}</div>
            <time class="text-xs text-gray-500 dark:text-gray-400" :datetime="entry.date">
              {{ entry.date }}
            </time>
          </div>
        </div>
      </div>
      <p v-else class="p-6 text-sm text-gray-500 dark:text-gray-400">暂无 Git 提交历史</p>
    </div>
  </div>
</template>

<style scoped>
/* 保持样式由父级 Tailwind 提供，如需覆写可在此添加 */
.cursor {
  display: inline-block;
  width: 1px;
  margin-left: 6px;
  background-color: currentColor;
  vertical-align: bottom;
  animation: blink 1s steps(1) infinite;
  height: 1em;
}

@keyframes blink {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
</style>
