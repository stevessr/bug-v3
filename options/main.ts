import { createApp } from 'vue';
import Options from './Options.vue';
import Antd from 'ant-design-vue';

const app = createApp(Options);
app.use(Antd);
app.mount('#app');
