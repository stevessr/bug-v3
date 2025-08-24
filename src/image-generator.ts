import { createApp } from 'vue';
import { ImageGeneratorMain } from '@/components/ImageGenerator';

// Create and mount the Vue application
const app = createApp({
  components: {
    ImageGeneratorMain
  },
  template: '<ImageGeneratorMain />'
});

app.mount('#app');