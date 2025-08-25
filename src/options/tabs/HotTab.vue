<template>
  <a-card title="常用表情">
    <div v-if="items.length === 0">暂无常用表情</div>
    <a-list bordered v-else>
      <a-list-item v-for="e in items" :key="e.UUID">
        <a-list-item-meta
          :title="e.displayName"
          :description="'使用次数: ' + (e.usageCount || 0)"
        />
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
      items.value = store.getHot()
    }
    onMounted(load)
    return { items }
  },
})
</script>
