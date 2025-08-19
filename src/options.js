import { createApp, h } from 'vue';
import { create, NDialogProvider, NMessageProvider } from 'naive-ui';
import Options from './Options.vue';

const naive = create();

const AppRoot = {
	render() {
		return h(NMessageProvider, null, {
			default: () => h(NDialogProvider, null, { default: () => h(Options) })
		});
	}
};

const app = createApp(AppRoot);
app.use(naive);
app.mount('#app');