<template>
  <a-modal v-model:open="visible" title="导入冲突处理" @ok="onOk" @cancel="close" width="800">
    <div v-if="conflicts.length === 0">没有冲突。</div>
    <a-list v-else :dataSource="conflicts" bordered>
      <a-list-item v-for="(c, idx) in conflicts" :key="c.key">
        <a-list-item-meta :title="c.displayName || c.realUrl" :description="c.key" />
        <template #actions>
          <div style="display: flex; gap: 8px; align-items: center">
            <a-radio-group v-model:value="decisions[idx]">
              <a-radio value="skip">跳过</a-radio>
              <a-radio value="overwrite">覆盖</a-radio>
            </a-radio-group>
            <div style="margin-left: 12px; text-align: right">
              <img
                :src="c.existing.displayUrl || c.existing.realUrl"
                style="width: 64px; height: 64px; object-fit: cover; border-radius: 4px"
              />
              <div style="font-size: 12px; color: var(--ant-text-color-secondary)">现有</div>
            </div>
            <div style="margin-left: 8px; text-align: right">
              <img
                :src="c.incoming.displayUrl || c.incoming.realUrl"
                style="width: 64px; height: 64px; object-fit: cover; border-radius: 4px"
              />
              <div style="font-size: 12px; color: var(--ant-text-color-secondary)">导入</div>
            </div>
          </div>
        </template>
      </a-list-item>
    </a-list>
  </a-modal>
</template>

<script lang="ts">
import { defineComponent, ref, watch } from 'vue'
import type { PropType } from 'vue'

export default defineComponent({
  props: {
    modelValue: { type: Boolean as PropType<boolean>, required: true },
    conflicts: { type: Array as PropType<any[]>, required: true },
  },
  emits: ['update:modelValue', 'resolved'],
  setup(props, { emit }) {
    const visible = ref(!!props.modelValue)
    const decisions = ref<string[]>([])

    watch(
      () => props.modelValue,
      (v) => (visible.value = !!v),
    )

    watch(
      () => props.conflicts,
      (v) => {
        decisions.value = (v || []).map(() => 'skip')
      },
      { immediate: true },
    )

    function close() {
      emit('update:modelValue', false)
    }

    function onOk() {
      const result = (props.conflicts || []).map((c: any, i: number) => ({
        key: c.key,
        decision: decisions.value[i] || 'skip',
        incoming: c.incoming,
      }))
      emit('resolved', result)
      close()
    }

    return { visible, decisions, close, onOk }
  },
})
</script>
