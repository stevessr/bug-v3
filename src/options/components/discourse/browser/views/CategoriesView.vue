<script setup lang="ts">
import type { BrowserTab, DiscourseCategory } from '../../types'
import CategoryGrid from '../../layout/CategoryGrid'
import Sidebar from '../../layout/Sidebar'

type Props = {
  activeTab: BrowserTab
  baseUrl: string
}

defineProps<Props>()

defineEmits(['categoryClick', 'topicClick', 'openUser', 'changeTopicListType', 'navigate'])
</script>

<template>
  <div class="discourse-list-view">
    <div class="discourse-list-view__main">
      <header class="browser-view-heading">
        <span class="browser-view-heading__eyebrow">探索社区</span>
        <h2 class="browser-view-heading__title">分类目录</h2>
        <p class="browser-view-heading__description">按主题浏览板块，快速找到感兴趣的讨论。</p>
      </header>
      <CategoryGrid
        :categories="activeTab.categories"
        :baseUrl="baseUrl"
        title=""
        layout="directory"
        @click="$emit('categoryClick', $event as DiscourseCategory)"
        @topicClick="$emit('topicClick', $event)"
      />
    </div>
    <div class="discourse-list-view__side">
      <Sidebar
        :categories="activeTab.categories"
        :users="activeTab.activeUsers"
        :baseUrl="baseUrl"
        :topicListType="activeTab.topicListType"
        @clickCategory="$emit('categoryClick', $event)"
        @clickUser="$emit('openUser', $event)"
        @changeTopicListType="$emit('changeTopicListType', $event)"
        @navigateTo="$emit('navigate', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.discourse-list-view {
  display: flex;
  gap: 20px;
}

.discourse-list-view__main {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 16px;
}

.browser-view-heading {
  display: grid;
  gap: 4px;
  padding: 20px 22px;
  border-radius: var(--d-shape-xl, 28px);
  background: var(--primary-container, var(--theme-primary-container));
  color: var(--on-primary-container, var(--theme-on-primary-container));
}

.browser-view-heading__eyebrow {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.browser-view-heading__title {
  margin: 0;
  font-size: clamp(22px, 3vw, 30px);
  font-weight: 720;
  letter-spacing: -0.025em;
  line-height: 1.2;
}

.browser-view-heading__description {
  max-width: 560px;
  margin: 2px 0 0;
  color: color-mix(in oklab, currentColor 78%, transparent);
  font-size: 13px;
}

.discourse-list-view__side {
  width: 256px;
  flex-shrink: 0;
  display: none;
}

@media (min-width: 1024px) {
  .discourse-list-view__side {
    display: block;
  }
}

@media (max-width: 560px) {
  .browser-view-heading {
    padding: 18px;
    border-radius: var(--d-shape-lg, 16px);
  }
}
</style>
