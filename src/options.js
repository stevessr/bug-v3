import { createApp } from 'vue';
import { create } from 'naive-ui';
import Options from './Options.vue';

const naive = create();

const app = createApp(Options);
app.use(naive);
app.mount('#app');