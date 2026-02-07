import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
import { ConfigProvider as AConfigProvider } from 'ant-design-vue'

import DiscourseBrowser from './options/components/DiscourseBrowser.vue'

import './styles/main.ts'
import './styles/discourse.css'

const App = {
  name: 'DiscourseStandalone',
  render() {
    return h(AConfigProvider, null, () =>
      h('div', { class: 'discourse-standalone' }, [
        h(DiscourseBrowser, { class: 'discourse-standalone__browser' })
      ])
    )
  }
}

const pinia = createPinia()
const app = createApp(App)
app.use(pinia)
app.mount('#app')
