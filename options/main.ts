import { createApp, defineAsyncComponent } from 'vue';
import { createPinia } from 'pinia';

const Options = defineAsyncComponent(() => import('./Options.vue'));

const pinia = createPinia();
const app = createApp(Options);

app.use(pinia);
app.mount('#app');
