<script setup lang="ts">
import type { BrowserTab } from '../../types'
import NotificationsView from '../../notifications/NotificationsView'
import Sidebar from '../../layout/Sidebar'

type Props = {
  activeTab: BrowserTab
  baseUrl: string
  currentUsername: string
  blockedUsernames: string[]
  exemptUsername?: string | null
}

defineProps<Props>()

defineEmits([
  'changeFilter',
  'openNotification',
  'categoryClick',
  'openUser',
  'changeTopicListType',
  'navigate',
  'markAll',
  'markRead'
])
</script>

<template>
  <div class="notifications-panel-root">
    <div class="notifications-panel-main">
      <header class="notifications-page-heading">
        <div>
          <span class="notifications-page-heading__eyebrow">收件箱</span>
          <h2 class="notifications-page-heading__title">通知</h2>
          <p class="notifications-page-heading__description">
            集中查看提及、回复、点赞和私信动态。
          </p>
        </div>
        <span
          v-if="activeTab.unreadNotificationsCount > 0"
          class="notifications-page-heading__badge"
          :aria-label="`${activeTab.unreadNotificationsCount} 条未读通知`"
        >
          {{ activeTab.unreadNotificationsCount }} 未读
        </span>
      </header>
      <NotificationsView
        :notifications="activeTab.notifications"
        :filter="activeTab.notificationsFilter"
        :baseUrl="baseUrl"
        :currentUsername="currentUsername"
        :blockedUsernames="blockedUsernames"
        :exemptUsername="exemptUsername"
        @changeFilter="$emit('changeFilter', $event)"
        @open="$emit('openNotification', $event)"
        @markAll="$emit('markAll')"
        @markRead="$emit('markRead', $event)"
      />
    </div>
    <div class="notifications-panel-side">
      <Sidebar
        :categories="[]"
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
.notifications-panel-root {
  display: flex;
  gap: 20px;
  min-height: 0;
}

.notifications-panel-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 16px;
}

.notifications-page-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 22px;
  border-radius: var(--d-shape-xl, 28px);
  background: var(--secondary-container, var(--theme-secondary-container));
  color: var(--on-secondary-container, var(--theme-on-secondary-container));
}

.notifications-page-heading__eyebrow {
  font-size: 11px;
  font-weight: 720;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.notifications-page-heading__title {
  margin: 2px 0 0;
  font-size: clamp(22px, 3vw, 30px);
  font-weight: 720;
  letter-spacing: -0.025em;
  line-height: 1.2;
}

.notifications-page-heading__description {
  margin: 4px 0 0;
  color: color-mix(in oklab, currentColor 76%, transparent);
  font-size: 13px;
}

.notifications-page-heading__badge {
  min-height: 34px;
  padding: 7px 13px;
  border-radius: var(--d-shape-full, 999px);
  background: var(--d-surface, var(--theme-surface));
  color: var(--primary, var(--theme-primary));
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.notifications-panel-side {
  width: 256px;
  flex-shrink: 0;
  display: none;
}

@media (min-width: 1024px) {
  .notifications-panel-side {
    display: block;
  }
}

@media (max-width: 560px) {
  .notifications-page-heading {
    align-items: flex-start;
    flex-direction: column;
    padding: 18px;
    border-radius: var(--d-shape-lg, 16px);
  }
}
</style>
