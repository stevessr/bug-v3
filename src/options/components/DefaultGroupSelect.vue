<template>
  <a-select :value="current" style="width: 100%" @change="onChange">
    <a-select-option v-for="g in groups" :key="g.UUID" :value="g.UUID">
      <span style="display: flex; align-items: center">
        <img v-if="g.icon" :src="g.icon" style="width: 20px; height: 20px; margin-right: 8px" />
        <span>{{ g.displayName }} ({{ g.UUID }})</span>
      </span>
    </a-select-option>
  </a-select>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, watch } from 'vue'
import store from '../../data/store/main'

export default defineComponent({
  props: { modelValue: { type: String as any, required: false } },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const current = ref(props.modelValue || '')
    const groups = ref<any[]>([])
    function load() {
      groups.value = store.getGroups()
    }
    onMounted(load)

    watch(
      () => props.modelValue,
      (v) => {
        current.value = v || ''
      },
    )

    function onChange(v: string) {
      current.value = v
      emit('update:modelValue', v)
    }

    return { current, groups, onChange }
  },
})
</script>
