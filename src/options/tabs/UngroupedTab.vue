<template>
  <a-card title="未分组表情">
    <div v-if="items.length === 0">当前没有未分组表情</div>
    <div v-else>
      <div style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center">
        <a-select v-model:value="targetGroup" style="min-width: 220px" placeholder="选择目标分组">
          <a-select-option v-for="g in groups" :key="g.UUID" :value="g.UUID"
            >{{ g.displayName }} ({{ g.UUID }})</a-select-option
          >
        </a-select>
        <a-button
          type="primary"
          :disabled="!targetGroup || selected.length === 0"
          @click="moveSelected"
          >移动到分组</a-button
        >
        <a-button @click="selectAll">全选</a-button>
        <a-button @click="clearSelection">清空</a-button>
      </div>
      <a-list bordered>
        <a-list-item v-for="e in items" :key="e.UUID">
          <a-space
            style="width: 100%; display: flex; justify-content: space-between; align-items: center"
          >
            <div style="display: flex; gap: 8px; align-items: center">
              <a-checkbox v-model:checked="selectedMap[e.UUID]" @change="onCheck(e)" />
              <img
                :src="e.displayUrl || e.realUrl"
                style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px"
              />
              <div>
                <div>{{ e.displayName || '（无名）' }}</div>
                <div style="font-size: 12px; color: var(--ant-text-color-secondary)">
                  {{ e.UUID }}
                </div>
              </div>
            </div>
            <div>
              <a-button size="small" @click="moveSingle(e)">移动</a-button>
            </div>
          </a-space>
        </a-list-item>
      </a-list>
    </div>
  </a-card>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, computed } from 'vue'
import store from '../../data/store/main'
import { Modal } from 'ant-design-vue'

export default defineComponent({
  setup() {
    const items = ref<any[]>([])
    const groups = ref<any[]>([])
    const selectedMap: any = ref({})
    const targetGroup = ref<string | null>(null)

    const selected = computed(() =>
      Object.keys(selectedMap.value).filter((k) => selectedMap.value[k]),
    )
    function load() {
      items.value = store.getUngrouped()
      groups.value = store.getGroups()
    }

    function selectAll() {
      items.value.forEach((i: any) => (selectedMap.value[i.UUID] = true))
    }

    function clearSelection() {
      selectedMap.value = {}
    }

    function onCheck(e: any) {
      // ensure reactive
      selectedMap.value = { ...selectedMap.value }
    }

    function moveSelected() {
      const uuids = selected.value
      if (!uuids.length || !targetGroup.value) return
      const res = store.moveUngroupedToGroup(uuids, targetGroup.value)
      try {
        Modal.info({ title: '移动完成', content: `已移动 ${res.moved || 0} 项到分组。` })
      } catch (_) {}
      clearSelection()
      load()
    }

    function moveSingle(e: any) {
      if (!targetGroup.value) {
        try {
          Modal.info({ title: '请选择目标分组', content: '请先在顶部选择一个目标分组。' })
        } catch (_) {}
        return
      }
      const res = store.moveUngroupedToGroup([e.UUID], targetGroup.value)
      try {
        Modal.info({ title: '移动完成', content: `已移动 ${res.moved || 0} 项到分组。` })
      } catch (_) {}
      load()
    }

    onMounted(load)
    return {
      items,
      groups,
      selectedMap,
      targetGroup,
      selected,
      selectAll,
      clearSelection,
      onCheck,
      moveSelected,
      moveSingle,
    }
  },
})
</script>
