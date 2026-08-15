<script setup lang="ts">
import { computed } from 'vue'
import { BellOutlined, DownOutlined, EditOutlined, RightOutlined } from '@ant-design/icons-vue'

import type {
  BrowserTab,
  DiscourseCategory,
  DiscourseTopic,
  SuggestedTopic,
  TopicListType
} from '../../types'
import { resolveDiscourseHttpUrl } from '../../navigation'
import CategoryGrid from '../../layout/CategoryGrid'
import { getDiscourseIconHref } from '../../layout/iconSprite'
import TopicList from '../../topic/TopicList'
import '../../css/BrowserTopicListView.css'

type TopicSortKey = 'replies' | 'views' | 'activity' | null

type TopicSortOrder = 'asc' | 'desc'

type Props = {
  activeTab: BrowserTab
  baseUrl: string
  sortedTopics: Array<DiscourseTopic | SuggestedTopic>
  topicSortKey: TopicSortKey
  topicSortOrder: TopicSortOrder
  isLoadingMore: boolean
  composerMode: 'reply' | 'topic' | 'edit' | null
  blockedUsernames: string[]
  exemptUsername?: string | null
  notificationLevel: number
  notificationSaving: boolean
}

const props = defineProps<Props>()
const emit = defineEmits([
  'toggleComposer',
  'changeNotificationLevel',
  'applyPendingTopics',
  'topicSort',
  'topicClick',
  'topicMiddleClick',
  'openUser',
  'openTag',
  'categoryClick',
  'navigate'
])

const categoryTabs: Array<{ value: TopicListType; label: string }> = [
  { value: 'latest', label: '最新' },
  { value: 'new', label: '新' },
  { value: 'unread', label: '未读' },
  { value: 'hot', label: '热门' },
  { value: 'top', label: '排行榜' },
  { value: 'posted', label: '我的帖子' },
  { value: 'read', label: '已读' },
  { value: 'bookmarks', label: '书签' }
]

const currentCategory = computed<DiscourseCategory | null>(() => {
  if (props.activeTab.currentCategory) return props.activeTab.currentCategory
  if (!props.activeTab.currentCategoryId) return null

  return {
    id: props.activeTab.currentCategoryId,
    name: props.activeTab.currentCategoryName || '当前分类',
    slug: props.activeTab.currentCategorySlug || String(props.activeTab.currentCategoryId),
    color: '3AB54A',
    text_color: 'FFFFFF',
    topic_count: 0
  }
})

const categoryAccent = computed(() => {
  const color = currentCategory.value?.color?.replace(/^#/, '') || '3AB54A'
  return `#${color}`
})

const categoryDescription = computed(() => {
  const category = currentCategory.value
  if (!category) return '浏览这个分类中的讨论、子分类与最新话题。'
  return (
    category.description_excerpt ||
    category.description ||
    `浏览“${category.name}”中的讨论、子分类与最新话题。`
  )
})

const categoryLogoUrl = computed(() => {
  const category = currentCategory.value
  const logo = category?.uploaded_logo?.url || category?.uploaded_logo_dark?.url || ''
  return logo ? resolveDiscourseHttpUrl(logo, props.baseUrl) || '' : ''
})

const categoryRouteBase = computed(() => {
  const category = currentCategory.value
  const slug = (props.activeTab.currentCategorySlug || category?.slug || '')
    .split('/')
    .filter(Boolean)
    .map(segment => encodeURIComponent(segment))
    .join('/')
  const id = props.activeTab.currentCategoryId || category?.id || null
  const base = props.baseUrl.replace(/\/+$/, '')
  return slug ? `${base}/c/${slug}${id ? `/${id}` : ''}` : base
})

const isRestrictedCategory = (category: DiscourseCategory) =>
  Boolean(category.read_restricted) || Number(category.minimum_required_trust_level) > 0

function navigateCategoryTab(type: TopicListType) {
  const base = categoryRouteBase.value
  emit('navigate', type === 'latest' ? base : `${base}/l/${type}`)
}

function openCategoryTags() {
  emit('navigate', `${props.baseUrl.replace(/\/+$/, '')}/tags`)
}
</script>

<template>
  <div
    class="discourse-list-view topic-collection-view category-collection-view"
    :style="{ '--category-accent': categoryAccent }"
  >
    <div class="discourse-list-view__main">
      <section class="category-page-hero" aria-labelledby="category-page-title">
        <div class="category-page-hero__identity">
          <span class="category-page-hero__logo" :style="{ color: categoryAccent }">
            <img
              v-if="categoryLogoUrl"
              :src="categoryLogoUrl"
              :alt="currentCategory?.name || '分类图标'"
            />
            <span
              v-else-if="currentCategory?.emoji"
              class="category-page-hero__emoji"
              aria-hidden="true"
            >
              {{ currentCategory.emoji }}
            </span>
            <svg
              v-else-if="currentCategory?.icon"
              class="category-page-hero__icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <use :href="getDiscourseIconHref(currentCategory.icon)" />
            </svg>
            <span v-else class="category-page-hero__dot" aria-hidden="true" />
          </span>
          <div class="category-page-hero__copy">
            <h2 id="category-page-title">
              {{ currentCategory?.name || activeTab.currentCategoryName || '当前分类' }}
            </h2>
            <p>{{ categoryDescription }}</p>
          </div>
        </div>
      </section>

      <nav class="category-page-navigation" aria-label="分类浏览导航">
        <div class="category-page-context">
          <button
            type="button"
            class="category-page-context__chip category-page-context__chip--current"
            :aria-label="`查看 ${currentCategory?.name || activeTab.currentCategoryName || '当前分类'} 的最新话题`"
            @click="navigateCategoryTab('latest')"
          >
            <span class="category-page-context__accent" aria-hidden="true" />
            <span>{{ currentCategory?.name || activeTab.currentCategoryName || '当前分类' }}</span>
            <RightOutlined aria-hidden="true" />
          </button>

          <details v-if="activeTab.categories.length > 0" class="category-page-subcategory-menu">
            <summary class="category-page-context__chip">
              <span>子类别</span>
              <DownOutlined aria-hidden="true" />
            </summary>
            <div class="category-page-subcategory-menu__panel" aria-label="子类别">
              <button
                v-for="category in activeTab.categories"
                :key="category.id"
                type="button"
                class="category-page-subcategory-menu__item"
                @click="emit('categoryClick', category)"
              >
                <span
                  class="category-page-subcategory-menu__color"
                  :style="{ backgroundColor: `#${category.color}` }"
                />
                <span>{{ category.name }}</span>
                <span
                  v-if="isRestrictedCategory(category)"
                  class="category-page-subcategory-menu__lock"
                >
                  🔒
                </span>
              </button>
            </div>
          </details>

          <button
            type="button"
            class="category-page-context__chip"
            aria-label="浏览论坛标签"
            @click="openCategoryTags"
          >
            <span>标签</span>
            <RightOutlined aria-hidden="true" />
          </button>
        </div>

        <div class="category-page-navigation__lower">
          <div class="category-page-tabs" role="tablist" aria-label="话题筛选">
            <button
              v-for="tab in categoryTabs"
              :key="tab.value"
              type="button"
              class="category-page-tabs__item"
              :class="{ active: activeTab.topicListType === tab.value }"
              :aria-current="activeTab.topicListType === tab.value ? 'page' : undefined"
              @click="navigateCategoryTab(tab.value)"
            >
              {{ tab.label }}
            </button>
          </div>

          <div class="category-page-actions">
            <a-button
              type="primary"
              class="category-page-actions__new-topic"
              @click="emit('toggleComposer')"
            >
              <template #icon><EditOutlined /></template>
              {{ composerMode === 'topic' ? '收起编辑器' : '新建话题' }}
            </a-button>

            <label class="category-page-notification">
              <BellOutlined aria-hidden="true" />
              <span class="sr-only">分类通知等级</span>
              <a-select
                class="notification-select category-page-notification__select"
                :value="notificationLevel"
                :loading="notificationSaving"
                :disabled="notificationSaving"
                aria-label="分类通知等级"
                @change="emit('changeNotificationLevel', Number($event))"
              >
                <a-select-option :value="0">忽略</a-select-option>
                <a-select-option :value="1">常规</a-select-option>
                <a-select-option :value="2">追踪</a-select-option>
                <a-select-option :value="3">关注</a-select-option>
                <a-select-option :value="4">仅关注首帖</a-select-option>
              </a-select>
            </label>
          </div>
        </div>
      </nav>

      <CategoryGrid
        v-if="activeTab.categories.length > 0"
        class="category-page-subcategory-grid"
        :categories="activeTab.categories"
        :baseUrl="baseUrl"
        title=""
        :show-topic-count="false"
        @click="emit('categoryClick', $event as DiscourseCategory)"
      />

      <div v-if="activeTab.pendingTopicsCount" class="pending-topics">
        <a-button type="primary" class="pending-topics__button" @click="emit('applyPendingTopics')">
          发现 {{ activeTab.pendingTopicsCount }} 条新话题，点击刷新
        </a-button>
      </div>

      <section class="category-page-topic-section" aria-label="分类话题">
        <div class="category-page-topic-section__heading">
          <h3>话题</h3>
          <span>{{ activeTab.topics.length }} 个话题</span>
        </div>
        <TopicList
          :topics="sortedTopics"
          :baseUrl="baseUrl"
          :categories="activeTab.categories"
          :users="activeTab.activeUsers"
          :blockedUsernames="blockedUsernames"
          :exemptUsername="exemptUsername"
          :sortKey="topicSortKey"
          :sortOrder="topicSortOrder"
          @sort="emit('topicSort', $event)"
          @click="emit('topicClick', $event)"
          @middleClick="emit('topicMiddleClick', $event)"
          @openUser="emit('openUser', $event)"
          @openTag="emit('openTag', $event)"
          @openCategory="emit('categoryClick', $event)"
        />
      </section>

      <div v-if="isLoadingMore" class="discourse-list-view__loading">
        <a-spin />
        <span>加载更多话题...</span>
      </div>

      <div
        v-if="!activeTab.hasMoreTopics && !isLoadingMore && activeTab.topics.length > 0"
        class="discourse-list-view__end"
      >
        已加载全部话题
      </div>
    </div>
  </div>
</template>
