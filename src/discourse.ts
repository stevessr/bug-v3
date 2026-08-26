import { createApp, defineAsyncComponent, h } from 'vue'
import { createPinia } from 'pinia'
import { ConfigProvider as AConfigProvider } from 'ant-design-vue'

import './styles/main.ts'
import './styles/discourse.css'

const DiscourseBrowser = defineAsyncComponent(
  () => import('./options/components/DiscourseBrowser.vue')
)

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
