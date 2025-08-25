import { createApp, h } from 'vue'

import ImageEditorTab from './components/ImageEditorTab.vue'

const app = createApp({
  render: () => h(ImageEditorTab, { activeTab: 'image-editor' })
})

app.mount('#app')
