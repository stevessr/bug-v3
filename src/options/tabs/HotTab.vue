<template>
  <a-card title="常用表情">
    <div v-if="items.length === 0">暂无常用表情</div>
    <div v-else>
      <a-collapse bordered>
        <a-collapse-panel header="常用表情列表" key="1">
          <a-list bordered>
            <a-list-item v-for="e in items" :key="e.UUID">
              <a-list-item-meta :title="e.displayName" :description="'使用次数: ' + (e.usageCount || 0)" />
            </a-list-item>
          </a-list>
        </a-collapse-panel>
      </a-collapse>

      <div style="margin-top:12px; border-top:1px dashed var(--ant-divider); padding-top:12px">
        <div style="display:flex; gap:16px">
          <div>分组数量: <strong>{{ stats.groupCount }}</strong></div>
          <div>表情数量: <strong>{{ stats.emojiCount }}</strong></div>
          <div>总热度: <strong>{{ stats.totalHotness }}</strong></div>
        </div>
      </div>
    </div>
  </a-card>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue'
import store from '../../data/store/main'

export default defineComponent({
  setup() {
    const items = ref<any[]>([])
    const stats = ref({ groupCount: 0, emojiCount: 0, totalHotness: 0 })
    function load() {
      items.value = store.getHot()
      // compute stats
      const groups = store.getGroups()
      let emojiCount = 0
      let totalHot = 0
      for (const g of groups) {
        if (Array.isArray(g.emojis)) {
          emojiCount += g.emojis.length
          for (const e of g.emojis) {
            totalHot += ((e as any).usageCount || 0)
          }
        }
      }
      stats.value = { groupCount: groups.length, emojiCount, totalHotness: totalHot }
    }
    onMounted(load)
    return { items, stats }
  },
})
</script>
