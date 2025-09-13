import { d as defineComponent, l as useEmojiStore, c as computed, a as createElementBlock, o as openBlock, b as createBaseVNode, x as normalizeStyle, u as unref, F as Fragment, i as renderList, t as toDisplayString } from "./options-addemojimodal_vue_vue_type_script_setup_true_lang.js";
const _hoisted_1 = { class: "space-y-8" };
const _hoisted_2 = { class: "bg-white rounded-lg shadow-sm border" };
const _hoisted_3 = { class: "p-6" };
const _hoisted_4 = { class: "aspect-square bg-gray-50 rounded-lg overflow-hidden" };
const _hoisted_5 = ["src", "alt"];
const _hoisted_6 = {
  key: 0,
  class: "absolute top-1 left-1 bg-blue-500 text-white text-xs rounded-full px-1.5 py-0.5 font-semibold min-w-[20px] text-center"
};
const _hoisted_7 = {
  key: 1,
  class: "absolute top-1 left-1 bg-yellow-500 text-white text-xs rounded-full px-1 py-0.5",
  title: "收藏的表情"
};
const _hoisted_8 = { class: "absolute top-1 right-1 flex gap-1" };
const _hoisted_9 = ["onClick"];
const _hoisted_10 = ["onClick"];
const _hoisted_11 = { class: "text-xs text-center text-gray-600 mt-1 truncate" };
const _hoisted_12 = {
  key: 1,
  class: "text-sm text-gray-500"
};
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "FavoritesTab",
  emits: ["remove", "edit"],
  setup(__props) {
    const emojiStore = useEmojiStore();
    const favoritesGroup = computed(() => {
      return emojiStore.sortedGroups.find((g) => g.id === "favorites");
    });
    return (_ctx, _cache) => {
      var _a;
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createBaseVNode("div", _hoisted_2, [
          _cache[0] || (_cache[0] = createBaseVNode("div", { class: "px-6 py-4 border-b border-gray-200" }, [
            createBaseVNode("div", { class: "flex justify-between items-center" }, [
              createBaseVNode("h2", { class: "text-lg font-semibold text-gray-900" }, "常用表情")
            ])
          ], -1)),
          createBaseVNode("div", _hoisted_3, [
            favoritesGroup.value && ((_a = favoritesGroup.value.emojis) == null ? void 0 : _a.length) ? (openBlock(), createElementBlock("div", {
              key: 0,
              class: "grid gap-3",
              style: normalizeStyle({
                gridTemplateColumns: `repeat(${unref(emojiStore).settings.gridColumns}, minmax(0, 1fr))`
              })
            }, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(favoritesGroup.value.emojis, (emoji, idx) => {
                return openBlock(), createElementBlock("div", {
                  key: `fav-${emoji.id || idx}`,
                  class: "emoji-item relative"
                }, [
                  createBaseVNode("div", _hoisted_4, [
                    createBaseVNode("img", {
                      src: emoji.displayUrl || emoji.url,
                      alt: emoji.name,
                      class: "w-full h-full object-cover"
                    }, null, 8, _hoisted_5)
                  ]),
                  emoji.usageCount && emoji.usageCount > 0 ? (openBlock(), createElementBlock("div", _hoisted_6, toDisplayString(emoji.usageCount > 99 ? "99+" : emoji.usageCount), 1)) : (openBlock(), createElementBlock("div", _hoisted_7, " ⭐ ")),
                  createBaseVNode("div", _hoisted_8, [
                    createBaseVNode("button", {
                      onClick: ($event) => _ctx.$emit("edit", emoji, "favorites", idx),
                      title: "编辑",
                      class: "text-xs px-1 py-0.5 bg-white bg-opacity-80 rounded hover:bg-opacity-100"
                    }, " 编辑 ", 8, _hoisted_9),
                    createBaseVNode("button", {
                      onClick: ($event) => _ctx.$emit("remove", "favorites", idx),
                      title: "移除",
                      class: "text-xs px-1 py-0.5 bg-white bg-opacity-80 rounded hover:bg-opacity-100"
                    }, " 移除 ", 8, _hoisted_10)
                  ]),
                  createBaseVNode("div", _hoisted_11, toDisplayString(emoji.name), 1)
                ]);
              }), 128))
            ], 4)) : (openBlock(), createElementBlock("div", _hoisted_12, "尚无常用表情，使用表情后会自动添加到常用。"))
          ])
        ])
      ]);
    };
  }
});
export {
  _sfc_main as _
};
