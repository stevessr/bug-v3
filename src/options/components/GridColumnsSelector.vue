<script setup lang="ts">
import { computed } from 'vue'
import { DownOutlined } from '@ant-design/icons-vue'

const props = defineProps<{
  modelValue: number
  min?: number
  max?: number
  step?: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

const options = computed(() => {
  const min = Number(props.min ?? 2)
  const max = Number(props.max ?? 8)
  const step = Number(props.step ?? 1)
  const arr: number[] = []
  for (let i = min; i <= max; i += step) arr.push(i)
  return arr
})

const onMenuClick = (key: string) => {
  emit('update:modelValue', Number(key))
}
</script>

<template>
  <a-dropdown>
    <template #overlay>
      <a-menu @click="(info: { key: any }) => onMenuClick(String(info.key))">
        <a-menu-item v-for="col in options" :key="col" :value="col">{{ col }} 列</a-menu-item>
      </a-menu>
    </template>
    <AButton>
      {{ modelValue }} 列
      <DownOutlined />
    </AButton>
  </a-dropdown>
</template>

<style scoped>
/* keep style minimal; parent can override */
</style>
