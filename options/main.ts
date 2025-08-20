import { createApp } from 'vue';
import { createPinia } from 'pinia';
import Options from './Options.vue';
import Antd from 'ant-design-vue';

const pinia = createPinia();
const app = createApp(Options);

app.use(Antd);
app.use(pinia);
app.mount('#app');
