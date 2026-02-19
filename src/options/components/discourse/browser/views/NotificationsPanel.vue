<script setup lang="ts">
import type { BrowserTab } from '../../types'
import NotificationsView from '../../notifications/NotificationsView'
import Sidebar from '../../layout/Sidebar'

type Props = {
  activeTab: BrowserTab
  baseUrl: string
  currentUsername: string
}

defineProps<Props>()

defineEmits([
  'changeFilter',
  'openNotification',
  'categoryClick',
  'openUser',
  'changeTopicListType',
  'navigate'
])
</script>

<template>
  <div class="notifications-panel-root">
    <div class="notifications-panel-main">
      <NotificationsView
        :notifications="activeTab.notifications"
        :filter="activeTab.notificationsFilter"
        :baseUrl="baseUrl"
        :currentUsername="currentUsername"
        @changeFilter="$emit('changeFilter', $event)"
        @open="$emit('openNotification', $event)"
      />
    </div>
    <div class="w-64 flex-shrink-0 hidden lg:block">
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
  gap: 1rem;
  height: 100%;
  min-height: 0;
}

.notifications-panel-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
</style>
