import { createApp, h } from 'vue'
import { ConfigProvider as AConfigProvider } from 'ant-design-vue'

import DiscourseBrowser from './options/components/DiscourseBrowser.vue'

import './styles/main.ts'
import './styles/discourse.css'

const App = {
  name: 'DiscourseStandalone',
  render() {
    return h(AConfigProvider, { theme: { token: {} } }, () =>
      h('div', { class: 'discourse-standalone' }, [
        h(DiscourseBrowser, { class: 'discourse-standalone__browser' })
      ])
    )
  }
}

createApp(App).mount('#app')
