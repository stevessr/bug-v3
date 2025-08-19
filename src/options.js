import { createApp } from 'vue';
import Options from './Options.vue';

// Mount the Options.vue root which already renders providers in template.
const app = createApp(Options);
app.mount('#app');