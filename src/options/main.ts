import { createApp } from 'vue'
import { createPinia } from 'pinia'

import Options from './Options.vue'
import '../styles/main.css'

// Import specific Ant Design components instead of the entire library
import {
  Button,
  Input,
  InputNumber,
  Select,
  SelectOption,
  Textarea,
  Checkbox,
  Slider,
  Progress,
  Tag,
  Card,
  message
} from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'

const pinia = createPinia()
const app = createApp(Options)

app.use(pinia)

// Register specific Ant Design components
app.component('AButton', Button)
app.component('AInput', Input)
app.component('AInputNumber', InputNumber)
app.component('ASelect', Select)
app.component('ASelectOption', SelectOption)
app.component('ATextarea', Textarea)
app.component('ACheckbox', Checkbox)
app.component('ASlider', Slider)
app.component('AProgress', Progress)
app.component('ATag', Tag)
app.component('ACard', Card)

// Make message available globally
app.config.globalProperties.$message = message

app.mount('#app')

// Initialize store data
import { useEmojiStore } from '../stores/emojiStore'

const store = useEmojiStore(pinia)
store.loadData()
