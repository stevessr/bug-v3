<template>
  <a-select :value="current" style="width: 100%" @change="onChange">
    <a-select-option v-for="g in groups" :key="g.UUID" :value="g.UUID">
      <span style="display: flex; align-items: center">
        <template v-if="g.icon">
          <img
            v-if="isLikelyUrl(g.icon)"
            :src="g.icon"
            style="width: 20px; height: 20px; margin-right: 8px; object-fit:cover; border-radius:4px"
          />
          <span
            v-else
            style="display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; margin-right:8px; font-size:12px; border-radius:4px; background:var(--ant-bg-base)">
            {{ g.icon }}
          </span>
        </template>
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

    function isLikelyUrl(val: string | undefined) {
      if (!val) return false
      return /^(data:image\/|https?:\/\/|\/|\.\/|\.\.\/)/i.test(val)
    }

  return { current, groups, onChange, isLikelyUrl }
  },
})
</script>
