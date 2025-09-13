<script setup lang="ts">
import { computed } from 'vue'
import { Dropdown as ADropdown, Menu as AMenu, Button as AButton } from 'ant-design-vue'
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
  <ADropdown>
    <template #overlay>
      <AMenu @click="info => onMenuClick(String(info.key))">
        <AMenu.Item v-for="col in options" :key="col" :value="col">{{ col }} 列</AMenu.Item>
      </AMenu>
    </template>
    <AButton>
      {{ modelValue }} 列
      <DownOutlined />
    </AButton>
  </ADropdown>
</template>

<style scoped>
/* keep style minimal; parent can override */
</style>
