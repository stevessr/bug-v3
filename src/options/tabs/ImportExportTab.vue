<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue'

import store from '../../data/store/main'
import MonacoEditor from '../components/MonacoEditor.vue'

export default defineComponent({
  components: {
    MonacoEditor,
  },
  setup() {
    const exportJson = ref('')
    const text = ref('')

    function refresh() {
      exportJson.value = store.exportPayload()
    }
    function download() {
      refresh()
      const blob = new Blob([exportJson.value], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'bugcopilot-config.json'
      a.click()
      URL.revokeObjectURL(url)
    }
    async function copy() {
      refresh()
      try {
        await navigator.clipboard.writeText(exportJson.value)
      } catch (_) {}
    }
    function clear() {
      text.value = ''
    }
    function doImport() {
      try {
        const parsed = JSON.parse(text.value)
        store.importPayload(parsed)
        refresh()
        // eslint-disable-next-line no-console
        console.log('imported')
      } catch (e) {
        window.alert('导入失败: JSON 格式不正确')
      }
    }
    onMounted(refresh)
    return { exportJson, text, refresh, download, copy, clear, doImport }
  },
})
</script>

<template>
  <div>
    <a-card title="导出当前配置" style="margin-bottom: 16px">
      <MonacoEditor :model-value="exportJson" readonly language="json" />
      <div style="margin-top: 8px; display: flex; gap: 8px">
        <a-button @click="refresh">刷新</a-button>
        <a-button type="primary" @click="download">下载配置</a-button>
        <a-button @click="copy">复制到剪贴板</a-button>
      </div>
    </a-card>

    <a-card title="导入配置">
      <MonacoEditor v-model="text" language="json" />
      <div style="margin-top: 8px; display: flex; gap: 8px">
        <a-button type="primary" @click="doImport">导入</a-button>
        <a-button @click="clear">清空</a-button>
      </div>
    </a-card>
  </div>
</template>
