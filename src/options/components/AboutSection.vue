<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import TypeIt from 'typeit'

// 从 package.json 读取版本信息（相对路径从当前文件到项目根）
import pkg from '../../../package.json'
const changelogMarkdown = `
## [1.2.9-patch-4] - 2026-10-07
### 更新
- 新增可搜索的分组快捷表情选择与常用表情引用统计
- 增加后台 Discourse 原生上传器选项与 429 自动等待重试
- 优化分组、Telegram 导入和浏览器侧栏的显示与主题适配
`

const version = pkg?.version || 'dev'
const extensionName = pkg?.name || 'Emoji Extension'

type ChangelogEntry = {
  version: string
  date: string
  notes: string[]
}

const CHANGELOG_HEADING_RE = /^##\s+\[?([^\]\s]+)\]?\s*-\s*(.+)$/
const CHANGELOG_SECTION_RE = /^###\s+(.+)$/
const CHANGELOG_NOTE_RE = /^[-*]\s+(.+)$/

function parseChangelog(markdown: string, maxEntries = 8): ChangelogEntry[] {
  const entries: ChangelogEntry[] = []
  let current: ChangelogEntry | null = null
  let currentSection = ''

  const flushCurrent = () => {
    if (current && current.notes.length > 0) {
      entries.push(current)
    }
  }

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) {
      continue
    }

    const headingMatch = line.match(CHANGELOG_HEADING_RE)
    if (headingMatch) {
      flushCurrent()
      const [, entryVersion, entryDate] = headingMatch
      current = {
        version: entryVersion.trim(),
        date: entryDate.trim(),
        notes: []
      }
      currentSection = ''
      continue
    }

    if (!current) {
      continue
    }

    const sectionMatch = line.match(CHANGELOG_SECTION_RE)
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim()
      continue
    }

    const noteMatch = line.match(CHANGELOG_NOTE_RE)
    if (noteMatch) {
      const noteText = noteMatch[1].trim()
      if (!noteText) {
        continue
      }
      current.notes.push(currentSection ? `${currentSection}: ${noteText}` : noteText)
    }
  }

  flushCurrent()

  return entries.slice(0, maxEntries)
}

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

// 更新日志（从仓库 CHANGELOG.md 自动解析）
const parsedChangelog = parseChangelog(changelogMarkdown)
const changelog = ref<ChangelogEntry[]>(
  parsedChangelog.length > 0
    ? parsedChangelog
    : [
        {
          version,
          date: new Date().toISOString().slice(0, 10),
          notes: ['暂无可解析的更新日志，请查看仓库根目录 CHANGELOG.md。']
        }
      ]
)

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
  '一个功能强大的浏览器扩展，让您能够在任何网站上轻松插入和管理自定义表情。支持多平台同步，智能分组管理，让表情使用更加便捷高效。'
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
  // 清理 changelog 的 TypeIt 实例
  changelogTypeIts.value.forEach(inst => {
    if (inst && typeof inst.destroy === 'function') {
      inst.destroy()
    }
  })
  changelogTypeIts.value = []
  // 清理排队的定时器
  if (changelogTimers && changelogTimers.length) {
    changelogTimers.forEach(t => clearTimeout(t))
    changelogTimers = []
  }
})

// changelog entries typing
const changelogEls = ref<Array<HTMLElement | null>>([])

function setChangelogEl(el: any, idx: number) {
  // 模板 ref 回调可能传入 Element 或组件实例，使用 any 并断言为 HTMLElement 或 null
  changelogEls.value[idx] = (el as HTMLElement) || null
}

const changelogTypeIts = ref<Array<any>>([])
let changelogTimers: Array<ReturnType<typeof setTimeout>> = []

// 从旧到新排序的日志，用于渲染和顺序打字
const sortedChangelog = computed(() => {
  return [...changelog.value].slice().reverse()
})

onMounted(() => {
  // 顺序初始化每条 changelog 的 TypeIt（串行启动，基于字符数计算延迟）
  const baseDelay = 600 // 等待主描述先开始
  const charSpeed = 20 // ms per char (和 TypeIt 配置保持一致)
  let acc = baseDelay

  sortedChangelog.value.forEach((entry, i) => {
    const notesText = entry.notes.join('\n  •  ')
    const estDuration = Math.max(200, notesText.length * charSpeed)

    const t = setTimeout(() => {
      const targetEl = changelogEls.value[i]
      if (targetEl) {
        const inst = new TypeIt(targetEl, {
          lifeLike: true,
          speed: charSpeed,
          cursor: true,
          waitUntilVisible: true,
          breakLines: false
        })
          .type(notesText)
          .go()
        changelogTypeIts.value[i] = inst
      }
    }, acc)

    changelogTimers.push(t)
    acc += estDuration + 200 // 每条之间加点间隔
  })
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

    <!-- 更新日志 -->
    <div class="bg-white rounded-lg shadow-sm border dark:border-gray-700 dark:bg-gray-800">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">📝 更新日志</h3>
      </div>
      <div class="p-6 space-y-4">
        <div
          v-for="(entry, idx) in sortedChangelog"
          :key="entry.version"
          class="border-l-4 border-blue-500 pl-4"
        >
          <div class="flex items-center gap-2 mb-1">
            <span class="font-medium text-gray-900 dark:text-white">v{{ entry.version }}</span>
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ entry.date }}</span>
            <span
              v-if="entry.version === version"
              class="ml-2 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded"
            >
              当前版本
            </span>
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-300 space-y-1">
            <!-- TypeIt will render the notes text into this span -->
            <span class="block" :ref="el => setChangelogEl(el, idx)"></span>
          </div>
        </div>
      </div>
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
