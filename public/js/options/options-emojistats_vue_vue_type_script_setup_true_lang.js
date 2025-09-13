import { d as defineComponent, l as useEmojiStore, c as computed, a as createElementBlock, o as openBlock, b as createBaseVNode, t as toDisplayString } from "./options-addemojimodal_vue_vue_type_script_setup_true_lang.js";
const _hoisted_1 = { class: "bg-white rounded-lg shadow-sm border" };
const _hoisted_2 = { class: "p-6" };
const _hoisted_3 = { class: "grid grid-cols-1 md:grid-cols-3 gap-6" };
const _hoisted_4 = { class: "bg-blue-50 rounded-lg p-4" };
const _hoisted_5 = { class: "text-2xl font-bold text-blue-600" };
const _hoisted_6 = { class: "bg-green-50 rounded-lg p-4" };
const _hoisted_7 = { class: "text-2xl font-bold text-green-600" };
const _hoisted_8 = { class: "bg-purple-50 rounded-lg p-4" };
const _hoisted_9 = { class: "text-2xl font-bold text-purple-600" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "EmojiStats",
  setup(__props) {
    const emojiStore = useEmojiStore();
    const groupCount = computed(() => emojiStore.sortedGroups.length);
    const totalEmojis = computed(
      () => emojiStore.sortedGroups.reduce((sum, g) => {
        var _a;
        return sum + (((_a = g.emojis) == null ? void 0 : _a.length) || 0);
      }, 0)
    );
    const favoritesCount = computed(() => {
      var _a;
      const fav = emojiStore.sortedGroups.find((g) => g.id === "favorites");
      return ((_a = fav == null ? void 0 : fav.emojis) == null ? void 0 : _a.length) || 0;
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        _cache[3] || (_cache[3] = createBaseVNode("div", { class: "px-6 py-4 border-b border-gray-200" }, [
          createBaseVNode("h2", { class: "text-lg font-semibold text-gray-900" }, "使用统计")
        ], -1)),
        createBaseVNode("div", _hoisted_2, [
          createBaseVNode("div", _hoisted_3, [
            createBaseVNode("div", _hoisted_4, [
              createBaseVNode("div", _hoisted_5, toDisplayString(groupCount.value), 1),
              _cache[0] || (_cache[0] = createBaseVNode("div", { class: "text-sm text-blue-800" }, "表情分组", -1))
            ]),
            createBaseVNode("div", _hoisted_6, [
              createBaseVNode("div", _hoisted_7, toDisplayString(totalEmojis.value), 1),
              _cache[1] || (_cache[1] = createBaseVNode("div", { class: "text-sm text-green-800" }, "总表情数", -1))
            ]),
            createBaseVNode("div", _hoisted_8, [
              createBaseVNode("div", _hoisted_9, toDisplayString(favoritesCount.value), 1),
              _cache[2] || (_cache[2] = createBaseVNode("div", { class: "text-sm text-purple-800" }, "收藏表情", -1))
            ])
          ])
        ])
      ]);
    };
  }
});
export {
  _sfc_main as _
};
