import { createApp } from 'vue';
import { createPinia } from 'pinia';
import Options from './Options.vue';
import '../styles/main.css';

const pinia = createPinia();
const app = createApp(Options);

app.use(pinia);
app.mount('#app');
