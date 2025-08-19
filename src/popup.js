import { createApp, h } from 'vue';
import Popup from './Popup.vue';

// Popup.vue uses auto-imported composables/components, mount directly.
const app = createApp({ render: () => h(Popup) });
app.mount('#app');
