<template>
  <a-card title="表情统计">
    <a-list :dataSource="stats" bordered>
      <a-list-item v-for="s in stats" :key="s.UUID">
        <a-list-item-meta :title="s.displayName" :description="`使用次数: ${s.usageCount || 0}`" />
      </a-list-item>
    </a-list>
  </a-card>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue'
import store from '../../data/store/main'

export default defineComponent({
  setup() {
    const stats = ref<any[]>([])
    function load() {
      stats.value = store.getHot()
    }
    onMounted(load)
    return { stats }
  },
})
</script>
