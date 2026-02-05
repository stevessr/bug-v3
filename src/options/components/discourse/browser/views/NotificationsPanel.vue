<script setup lang="ts">
import type { BrowserTab } from '../../types'
import NotificationsView from '../../notifications/NotificationsView'
import Sidebar from '../../layout/Sidebar'

type Props = {
  activeTab: BrowserTab
  baseUrl: string
}

defineProps<Props>()

defineEmits(['changeFilter', 'openNotification', 'categoryClick', 'openUser', 'changeTopicListType', 'navigate'])
</script>

<template>
  <div class="flex gap-4">
    <div class="flex-1 min-w-0">
      <h3 class="text-lg font-semibold mb-3 dark:text-white">通知</h3>
      <NotificationsView
        :notifications="activeTab.notifications"
        :filter="activeTab.notificationsFilter"
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
