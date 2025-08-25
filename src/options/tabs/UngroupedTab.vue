<template>
  <a-card title="未分组表情">
    <div v-if="items.length === 0">当前没有未分组表情</div>
    <a-list bordered v-else>
      <a-list-item v-for="e in items" :key="e.UUID">
        <a-list-item-meta :title="e.displayName" :description="e.UUID" />
      </a-list-item>
    </a-list>
  </a-card>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue'
import store from '../../data/store/main'

export default defineComponent({
  setup() {
    const items = ref<any[]>([])
    function load() {
      items.value = store.getUngrouped()
    }
    onMounted(load)
    return { items }
  },
})
</script>
