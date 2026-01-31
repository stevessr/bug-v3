<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  PlusOutlined,
  CloseOutlined,
  ReloadOutlined,
  HomeOutlined,
  LeftOutlined,
  RightOutlined,
  LoadingOutlined
} from '@ant-design/icons-vue'

// Tab 数据结构
interface BrowserTab {
  id: string
  title: string
  url: string
  loading: boolean
  content: string
  history: string[]
  historyIndex: number
  scrollTop: number
}

// Discourse Topic 数据结构
interface DiscourseTopic {
  id: number
  title: string
  fancy_title: string
  slug: string
  posts_count: number
  reply_count: number
  views: number
  like_count: number
  created_at: string
  last_posted_at: string
  bumped_at: string
  posters: Array<{
    user_id: number
    extras?: string
    description: string
  }>
}

interface DiscourseCategory {
  id: number
  name: string
  slug: string
  color: string
  text_color: string
  topic_count: number
  description?: string
}

interface DiscourseUser {
  id: number
  username: string
  name?: string
  avatar_template: string
}

interface DiscoursePost {
  id: number
  username: string
  avatar_template: string
  created_at: string
  cooked: string
  post_number: number
  reply_count: number
  like_count: number
  name?: string
}

interface DiscourseTopicDetail {
  id: number
  title: string
  fancy_title: string
  posts_count: number
  views: number
  like_count: number
  created_at: string
  post_stream: {
    posts: DiscoursePost[]
    stream: number[]
  }
  details: {
    created_by: DiscourseUser
    participants: DiscourseUser[]
  }
}

// 默认论坛地址
const baseUrl = ref('https://linux.do')
const urlInput = ref('https://linux.do')

// Tab 管理
const tabs = ref<BrowserTab[]>([])
const activeTabId = ref<string>('')

// 当前活动 tab
const activeTab = computed(() => tabs.value.find(t => t.id === activeTabId.value))

// 视图状态
type ViewType = 'home' | 'category' | 'topic' | 'user' | 'error'
const currentView = ref<ViewType>('home')

// 数据
const categories = ref<DiscourseCategory[]>([])
const topics = ref<DiscourseTopic[]>([])
const currentTopic = ref<DiscourseTopicDetail | null>(null)
const users = ref<Map<number, DiscourseUser>>(new Map())
const errorMessage = ref('')

// 生成唯一 ID
const generateId = () => `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

// 页面代理请求
async function pageFetch<T>(
  url: string,
  options?: { method?: string; headers?: Record<string, string>; body?: string },
  responseType: 'json' | 'text' = 'json'
): Promise<{ status: number; ok: boolean; data: T | null }> {
  const chromeAPI = (globalThis as any).chrome
  if (!chromeAPI?.runtime?.sendMessage) {
    throw new Error('Page fetch unavailable: chrome.runtime is not accessible')
  }

  return await new Promise((resolve, reject) => {
    chromeAPI.runtime.sendMessage(
      {
        type: 'LINUX_DO_PAGE_FETCH',
        options: {
          url,
          method: options?.method || 'GET',
          headers: options?.headers,
          body: options?.body,
          responseType
        }
      },
      (resp: { success: boolean; status?: number; ok?: boolean; data?: T; error?: string }) => {
        if (resp?.success) {
          resolve({
            status: resp.status || 200,
            ok: resp.ok !== false,
            data: resp.data ?? null
          })
          return
        }
        reject(new Error(resp?.error || `Page fetch failed: ${resp?.status || 'unknown'}`))
      }
    )
  })
}

// 创建新 Tab
const createTab = (url?: string) => {
  const id = generateId()
  const newTab: BrowserTab = {
    id,
    title: '新标签页',
    url: url || baseUrl.value,
    loading: false,
    content: '',
    history: [url || baseUrl.value],
    historyIndex: 0,
    scrollTop: 0
  }
  tabs.value.push(newTab)
  activeTabId.value = id
  navigateTo(url || baseUrl.value)
}

// 关闭 Tab
const closeTab = (id: string) => {
  const index = tabs.value.findIndex(t => t.id === id)
  if (index === -1) return

  tabs.value.splice(index, 1)

  if (tabs.value.length === 0) {
    createTab()
  } else if (activeTabId.value === id) {
    activeTabId.value = tabs.value[Math.min(index, tabs.value.length - 1)].id
  }
}

// 切换 Tab
const switchTab = (id: string) => {
  activeTabId.value = id
}

// 导航到 URL
const navigateTo = async (url: string, addToHistory = true) => {
  const tab = activeTab.value
  if (!tab) return

  tab.loading = true
  tab.url = url
  errorMessage.value = ''

  try {
    // 解析 URL 类型
    const urlObj = new URL(url)
    const pathname = urlObj.pathname

    if (pathname === '/' || pathname === '') {
      // 首页 - 获取分类和最新话题
      await loadHome()
      tab.title = '首页 - ' + urlObj.hostname
      currentView.value = 'home'
    } else if (pathname.startsWith('/c/')) {
      // 分类页面 - 格式：/c/{slug}/{id} 或 /c/{slug}
      const parts = pathname.replace('/c/', '').split('/').filter(Boolean)
      const categorySlug = parts[0]
      const categoryId = parts[1] ? parseInt(parts[1]) : null
      await loadCategory(categorySlug, categoryId)
      tab.title = `分类：${categorySlug}`
      currentView.value = 'category'
    } else if (pathname.startsWith('/t/')) {
      // 话题详情
      const parts = pathname.replace('/t/', '').split('/')
      const topicId = parseInt(parts[parts.length - 1]) || parseInt(parts[0])
      await loadTopic(topicId)
      currentView.value = 'topic'
    } else if (pathname.startsWith('/u/')) {
      // 用户页面
      const username = pathname.replace('/u/', '').split('/')[0]
      tab.title = `用户：${username}`
      currentView.value = 'user'
    } else {
      // 尝试作为首页加载
      await loadHome()
      tab.title = urlObj.hostname
      currentView.value = 'home'
    }

    // 添加到历史记录
    if (addToHistory) {
      tab.history = tab.history.slice(0, tab.historyIndex + 1)
      tab.history.push(url)
      tab.historyIndex = tab.history.length - 1
    }
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : String(e)
    currentView.value = 'error'
    tab.title = '加载失败'
  } finally {
    tab.loading = false
  }
}

// 加载首页
const loadHome = async () => {
  try {
    const [catResult, topicResult] = await Promise.all([
      pageFetch<any>(`${baseUrl.value}/categories.json`),
      pageFetch<any>(`${baseUrl.value}/latest.json`)
    ])

    console.log('[DiscourseBrowser] Raw catResult:', catResult)
    console.log('[DiscourseBrowser] Raw topicResult:', topicResult)

    // 提取实际数据 - 处理可能的嵌套
    const extractData = (result: any) => {
      if (!result) return null
      // 如果 result.data 存在且是对象，使用它
      if (result.data && typeof result.data === 'object') {
        // 检查是否有二次嵌套 (result.data.data)
        if (result.data.data && typeof result.data.data === 'object') {
          return result.data.data
        }
        return result.data
      }
      return result
    }

    const catData = extractData(catResult)
    const topicData = extractData(topicResult)

    console.log('[DiscourseBrowser] Extracted catData:', catData)
    console.log('[DiscourseBrowser] Extracted topicData:', topicData)

    // 获取 categories
    if (catData?.category_list?.categories) {
      categories.value = catData.category_list.categories
      console.log('[DiscourseBrowser] Found categories:', categories.value.length)
    } else if (catData?.categories) {
      categories.value = catData.categories
      console.log('[DiscourseBrowser] Found categories (alt):', categories.value.length)
    } else {
      console.warn('[DiscourseBrowser] No categories found')
      categories.value = []
    }

    // 获取 topics
    if (topicData?.topic_list?.topics) {
      topics.value = topicData.topic_list.topics.slice(0, 30)
      console.log('[DiscourseBrowser] Found topics:', topics.value.length)
    } else {
      console.warn('[DiscourseBrowser] No topics found')
      topics.value = []
    }

    // 缓存用户信息
    if (topicData?.users) {
      topicData.users.forEach((u: DiscourseUser) => users.value.set(u.id, u))
    }
  } catch (e) {
    console.error('[DiscourseBrowser] loadHome error:', e)
    throw e
  }
}

// 加载分类
const loadCategory = async (slug: string, categoryId: number | null = null) => {
  // 使用正确的 URL 格式：/c/{slug}/{id}.json
  const url = categoryId
    ? `${baseUrl.value}/c/${slug}/${categoryId}.json`
    : `${baseUrl.value}/c/${slug}.json`

  console.log('[DiscourseBrowser] Loading category:', url)

  const result = await pageFetch<any>(url)

  // 提取实际数据
  const extractData = (res: any) => {
    if (!res) return null
    if (res.data && typeof res.data === 'object') {
      if (res.data.data && typeof res.data.data === 'object') {
        return res.data.data
      }
      return res.data
    }
    return res
  }

  const data = extractData(result)
  console.log('[DiscourseBrowser] Category data:', data)

  if (data?.topic_list?.topics) {
    topics.value = data.topic_list.topics.slice(0, 30)
    console.log('[DiscourseBrowser] Found category topics:', topics.value.length)
  } else {
    console.warn('[DiscourseBrowser] No topics found in category')
    topics.value = []
  }

  if (data?.users) {
    data.users.forEach((u: DiscourseUser) => users.value.set(u.id, u))
  }
}

// 加载话题详情
const loadTopic = async (topicId: number) => {
  console.log('[DiscourseBrowser] Loading topic:', topicId)

  const result = await pageFetch<any>(`${baseUrl.value}/t/${topicId}.json`)

  // 提取实际数据
  const extractData = (res: any) => {
    if (!res) return null
    if (res.data && typeof res.data === 'object') {
      if (res.data.data && typeof res.data.data === 'object') {
        return res.data.data
      }
      return res.data
    }
    return res
  }

  const data = extractData(result)
  console.log('[DiscourseBrowser] Topic data:', data)

  if (data) {
    currentTopic.value = data
    const tab = activeTab.value
    if (tab && data.title) {
      tab.title = data.title
    }
  } else {
    console.warn('[DiscourseBrowser] No topic data found')
    currentTopic.value = null
  }
}

// 后退
const goBack = () => {
  const tab = activeTab.value
  if (!tab || tab.historyIndex <= 0) return
  tab.historyIndex--
  navigateTo(tab.history[tab.historyIndex], false)
}

// 前进
const goForward = () => {
  const tab = activeTab.value
  if (!tab || tab.historyIndex >= tab.history.length - 1) return
  tab.historyIndex++
  navigateTo(tab.history[tab.historyIndex], false)
}

// 刷新
const refresh = () => {
  const tab = activeTab.value
  if (tab) {
    navigateTo(tab.url, false)
  }
}

// 回到首页
const goHome = () => {
  navigateTo(baseUrl.value)
}

// 更新基础 URL
const updateBaseUrl = () => {
  try {
    const url = new URL(urlInput.value)
    baseUrl.value = url.origin
    navigateTo(baseUrl.value)
  } catch {
    errorMessage.value = '无效的 URL'
  }
}

// 打开话题
const openTopic = (topic: DiscourseTopic) => {
  navigateTo(`${baseUrl.value}/t/${topic.slug}/${topic.id}`)
}

// 打开分类
const openCategory = (category: DiscourseCategory) => {
  navigateTo(`${baseUrl.value}/c/${category.slug}/${category.id}`)
}

// 在新标签页打开
const openInNewTab = (url: string) => {
  createTab(url)
}

// 获取头像 URL
const getAvatarUrl = (template: string, size = 45) => {
  if (!template) return ''
  const url = template.replace('{size}', String(size))
  return url.startsWith('http') ? url : `${baseUrl.value}${url}`
}

// 格式化时间
const formatTime = (dateStr: string) => {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 30) return `${days} 天前`
  return date.toLocaleDateString('zh-CN')
}

// 初始化
onMounted(() => {
  createTab()
})
</script>

<template>
  <div
    class="discourse-browser flex flex-col h-[700px] border dark:border-gray-700 rounded-lg overflow-hidden"
  >
    <!-- 工具栏 -->
    <div
      class="toolbar bg-gray-100 dark:bg-gray-800 border-b dark:border-gray-700 p-2 flex items-center gap-2"
    >
      <!-- 导航按钮 -->
      <div class="flex items-center gap-1">
        <a-button
          size="small"
          :disabled="!activeTab || activeTab.historyIndex <= 0"
          @click="goBack"
        >
          <template #icon><LeftOutlined /></template>
        </a-button>
        <a-button
          size="small"
          :disabled="!activeTab || activeTab.historyIndex >= activeTab.history.length - 1"
          @click="goForward"
        >
          <template #icon><RightOutlined /></template>
        </a-button>
        <a-button size="small" @click="refresh" :loading="activeTab?.loading">
          <template #icon><ReloadOutlined /></template>
        </a-button>
        <a-button size="small" @click="goHome">
          <template #icon><HomeOutlined /></template>
        </a-button>
      </div>

      <!-- 地址栏 -->
      <div class="flex-1 flex items-center gap-2">
        <a-input
          v-model:value="urlInput"
          placeholder="输入 Discourse 论坛地址"
          size="small"
          class="flex-1"
          @press-enter="updateBaseUrl"
        />
        <a-button type="primary" size="small" @click="updateBaseUrl">访问</a-button>
      </div>
    </div>

    <!-- Tab 栏 -->
    <div
      class="tab-bar bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700 flex items-center overflow-x-auto"
    >
      <div
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-item flex items-center gap-2 px-3 py-2 border-r dark:border-gray-700 cursor-pointer min-w-[120px] max-w-[200px] hover:bg-gray-100 dark:hover:bg-gray-800"
        :class="{
          'bg-white dark:bg-gray-800': tab.id === activeTabId,
          'bg-gray-50 dark:bg-gray-900': tab.id !== activeTabId
        }"
        @click="switchTab(tab.id)"
      >
        <LoadingOutlined v-if="tab.loading" class="text-blue-500" />
        <span class="flex-1 truncate text-sm dark:text-white">{{ tab.title }}</span>
        <CloseOutlined
          class="text-gray-400 hover:text-red-500 text-xs"
          @click.stop="closeTab(tab.id)"
        />
      </div>
      <a-button type="text" size="small" class="ml-1" @click="createTab()">
        <template #icon><PlusOutlined /></template>
      </a-button>
    </div>

    <!-- 内容区域 -->
    <div class="content-area flex-1 overflow-y-auto bg-white dark:bg-gray-900 p-4">
      <!-- 加载中 -->
      <div v-if="activeTab?.loading" class="flex items-center justify-center h-full">
        <a-spin size="large" />
      </div>

      <!-- 错误页面 -->
      <div
        v-else-if="currentView === 'error'"
        class="flex flex-col items-center justify-center h-full text-gray-500"
      >
        <div class="text-6xl mb-4">:(</div>
        <div class="text-lg mb-2">加载失败</div>
        <div class="text-sm text-red-500">{{ errorMessage }}</div>
        <a-button type="primary" class="mt-4" @click="refresh">重试</a-button>
      </div>

      <!-- 首页视图 -->
      <div v-else-if="currentView === 'home'" class="space-y-6">
        <!-- 分类列表 -->
        <div v-if="categories.length > 0">
          <h3 class="text-lg font-semibold mb-3 dark:text-white">分类</h3>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <div
              v-for="cat in categories.slice(0, 8)"
              :key="cat.id"
              class="p-3 rounded-lg border dark:border-gray-700 cursor-pointer hover:shadow-md transition-shadow"
              :style="{ borderLeftColor: `#${cat.color}`, borderLeftWidth: '4px' }"
              @click="openCategory(cat)"
            >
              <div class="font-medium dark:text-white">{{ cat.name }}</div>
              <div class="text-xs text-gray-500">{{ cat.topic_count }} 话题</div>
            </div>
          </div>
        </div>

        <!-- 最新话题 -->
        <div v-if="topics.length > 0">
          <h3 class="text-lg font-semibold mb-3 dark:text-white">最新话题</h3>
          <div class="space-y-2">
            <div
              v-for="topic in topics"
              :key="topic.id"
              class="topic-item p-3 rounded-lg border dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              @click="openTopic(topic)"
              @click.middle="openInNewTab(`${baseUrl}/t/${topic.slug}/${topic.id}`)"
            >
              <div class="flex items-start gap-3">
                <div class="flex-1 min-w-0">
                  <div
                    class="font-medium dark:text-white truncate"
                    v-html="topic.fancy_title || topic.title"
                  />
                  <div class="flex items-center gap-4 mt-1 text-xs text-gray-500">
                    <span>{{ topic.posts_count }} 回复</span>
                    <span>{{ topic.views }} 浏览</span>
                    <span>{{ topic.like_count }} 赞</span>
                    <span>{{ formatTime(topic.last_posted_at || topic.created_at) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 分类视图 -->
      <div v-else-if="currentView === 'category'" class="space-y-2">
        <div
          v-for="topic in topics"
          :key="topic.id"
          class="topic-item p-3 rounded-lg border dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          @click="openTopic(topic)"
        >
          <div class="font-medium dark:text-white" v-html="topic.fancy_title || topic.title" />
          <div class="flex items-center gap-4 mt-1 text-xs text-gray-500">
            <span>{{ topic.posts_count }} 回复</span>
            <span>{{ topic.views }} 浏览</span>
            <span>{{ formatTime(topic.last_posted_at || topic.created_at) }}</span>
          </div>
        </div>
      </div>

      <!-- 话题详情视图 -->
      <div v-else-if="currentView === 'topic' && currentTopic" class="space-y-4">
        <!-- 话题标题 -->
        <div class="border-b dark:border-gray-700 pb-4">
          <h1
            class="text-xl font-bold dark:text-white"
            v-html="currentTopic.fancy_title || currentTopic.title"
          />
          <div class="flex items-center gap-4 mt-2 text-sm text-gray-500">
            <span>{{ currentTopic.posts_count }} 回复</span>
            <span>{{ currentTopic.views }} 浏览</span>
            <span>{{ currentTopic.like_count }} 赞</span>
            <span>创建于 {{ formatTime(currentTopic.created_at) }}</span>
          </div>
        </div>

        <!-- 帖子列表 -->
        <div v-if="currentTopic.post_stream?.posts" class="posts-list space-y-4">
          <div
            v-for="post in currentTopic.post_stream.posts"
            :key="post.id"
            class="post-item p-4 rounded-lg border dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
          >
            <!-- 帖子头部 -->
            <div class="flex items-center gap-3 mb-3">
              <img
                :src="getAvatarUrl(post.avatar_template)"
                :alt="post.username"
                class="w-10 h-10 rounded-full"
              />
              <div>
                <div class="font-medium dark:text-white">{{ post.name || post.username }}</div>
                <div class="text-xs text-gray-500">
                  @{{ post.username }} · #{{ post.post_number }} · {{ formatTime(post.created_at) }}
                </div>
              </div>
            </div>

            <!-- 帖子内容 -->
            <div
              class="post-content prose dark:prose-invert max-w-none text-sm"
              v-html="post.cooked"
            />

            <!-- 帖子底部 -->
            <div class="flex items-center gap-4 mt-3 text-xs text-gray-500">
              <span v-if="post.like_count > 0">{{ post.like_count }} 赞</span>
              <span v-if="post.reply_count > 0">{{ post.reply_count }} 回复</span>
            </div>
          </div>
        </div>
        <div v-else class="text-center text-gray-500 py-8">加载帖子中...</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.discourse-browser {
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
}

.tab-item {
  transition: background-color 0.15s;
}

.post-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
}

.post-content :deep(a) {
  color: #3b82f6;
  text-decoration: none;
}

.post-content :deep(a:hover) {
  text-decoration: underline;
}

.post-content :deep(pre) {
  background: #1f2937;
  color: #e5e7eb;
  padding: 1rem;
  border-radius: 4px;
  overflow-x: auto;
}

.post-content :deep(code) {
  background: #374151;
  padding: 0.125rem 0.25rem;
  border-radius: 2px;
  font-size: 0.875em;
}

.post-content :deep(blockquote) {
  border-left: 3px solid #3b82f6;
  padding-left: 1rem;
  margin-left: 0;
  color: #6b7280;
}

.post-content :deep(.emoji) {
  width: 1.25em;
  height: 1.25em;
  vertical-align: middle;
}
</style>
