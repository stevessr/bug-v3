<template>
  <a-card title="常用表情">
    <div v-if="items.length === 0">暂无常用表情</div>
    <div v-else>
      <a-collapse bordered default-active-key="1">
        <a-collapse-panel header="常用表情列表" key="1">
          <div v-if="items.length === 0">暂无常用表情</div>
          <div v-else>
            <div class="emoji-grid" :class="['grid', gridColsClass, 'gap-2']">
              <a-card v-for="e in items" :key="e.UUID" hoverable size="small" style="width: 100%">
                <template #cover>
                  <img
                    :src="e.displayUrl || e.realUrl"
                    style="width: 100%; aspect-ratio: 1/1; object-fit: cover; border-radius: 4px"
                  />
                </template>
                <a-card-meta :title="e.displayName">
                  <template #description>使用次数: {{ e.usageCount || 0 }}</template>
                </a-card-meta>
              </a-card>
            </div>
          </div>
        </a-collapse-panel>
      </a-collapse>

      <div style="margin-top: 16px">
        <a-row :gutter="16">
          <a-col :span="8">
            <a-card size="small" style="text-align: center">
              <div style="font-size: 24px; font-weight: bold; color: var(--ant-primary-color)">
                {{ stats.groupCount }}
              </div>
              <div style="font-size: 14px; color: var(--ant-text-color-secondary)">分组数量</div>
            </a-card>
          </a-col>
          <a-col :span="8">
            <a-card size="small" style="text-align: center">
              <div style="font-size: 24px; font-weight: bold; color: var(--ant-success-color)">
                {{ stats.emojiCount }}
              </div>
              <div style="font-size: 14px; color: var(--ant-text-color-secondary)">表情数量</div>
            </a-card>
          </a-col>
          <a-col :span="8">
            <a-card size="small" style="text-align: center">
              <div style="font-size: 24px; font-weight: bold; color: var(--ant-warning-color)">
                {{ stats.totalHotness }}
              </div>
              <div style="font-size: 14px; color: var(--ant-text-color-secondary)">总热度</div>
            </a-card>
          </a-col>
        </a-row>
      </div>
    </div>
  </a-card>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, reactive, computed } from 'vue'
import store from '../../data/store/main'

export default defineComponent({
  setup() {
    const items = ref<any[]>([])
    const stats = ref({ groupCount: 0, emojiCount: 0, totalHotness: 0 })
    const settings = reactive({ ...store.getSettings() })
    const gridColsClass = computed(() => `grid-cols-${(settings as any).gridColumns || 4}`)
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
            totalHot += (e as any).usageCount || 0
          }
        }
      }
      stats.value = { groupCount: groups.length, emojiCount, totalHotness: totalHot }
    }
    onMounted(load)
    return { items, stats, gridColsClass }
  },
})
</script>
