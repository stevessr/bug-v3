import { Q as createPinia, R as createApp, l as useEmojiStore } from "./options-addemojimodal_vue_vue_type_script_setup_true_lang.js";
import { _ as _sfc_main } from "./options-options_vue_vue_type_script_setup_true_lang.js";
const pinia = createPinia();
const app = createApp(_sfc_main);
app.use(pinia);
app.mount("#app");
const store = useEmojiStore(pinia);
store.loadData();
