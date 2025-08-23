import { createApp } from 'vue';
import ImageGeneratorMain from './components/ImageGenerator/ImageGeneratorMainNew.vue';
import './styles/main.css';

const app = createApp({
  components: {
    ImageGeneratorMain
  },
  template: '<ImageGeneratorMain />'
});

app.mount('#app');