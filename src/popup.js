import { createApp, h } from 'vue';
import Popup from './Popup.vue';
import { createDiscreteApi } from 'naive-ui';

const app = createApp({ render: () => h(Popup) });
app.mount('#app');
