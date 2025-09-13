import { d as defineComponent, a as createElementBlock, o as openBlock, b as createBaseVNode } from "./options-addemojimodal_vue_vue_type_script_setup_true_lang.js";
const _hoisted_1 = { class: "flex gap-3 flex-wrap" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "HeaderControls",
  emits: [
    "openImport",
    "openImportEmojis",
    "resetSettings",
    "syncToChrome",
    "forceLocalToExtension",
    "exportConfiguration"
  ],
  setup(__props) {
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createBaseVNode("button", {
          onClick: _cache[0] || (_cache[0] = ($event) => _ctx.$emit("openImport")),
          class: "px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
        }, " 导入配置 "),
        createBaseVNode("button", {
          onClick: _cache[1] || (_cache[1] = ($event) => _ctx.$emit("openImportEmojis")),
          class: "px-4 py-2 text-sm bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors"
        }, " 导入表情 "),
        _cache[6] || (_cache[6] = createBaseVNode("a", {
          href: "/tenor.html",
          target: "_blank",
          class: "px-4 py-2 text-sm bg-pink-100 text-pink-700 rounded-md hover:bg-pink-200 transition-colors inline-block"
        }, " 🎬 Tenor GIF ", -1)),
        _cache[7] || (_cache[7] = createBaseVNode("a", {
          href: "/waline.html",
          target: "_blank",
          class: "px-4 py-2 text-sm bg-cyan-100 text-cyan-700 rounded-md hover:bg-cyan-200 transition-colors inline-block"
        }, " 📦 Waline 导入 ", -1)),
        createBaseVNode("button", {
          onClick: _cache[2] || (_cache[2] = ($event) => _ctx.$emit("resetSettings")),
          class: "px-4 py-2 text-sm bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 transition-colors"
        }, " 重置设置 "),
        createBaseVNode("button", {
          onClick: _cache[3] || (_cache[3] = ($event) => _ctx.$emit("syncToChrome")),
          class: "px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
        }, " 上传到Chrome同步 "),
        createBaseVNode("button", {
          onClick: _cache[4] || (_cache[4] = ($event) => _ctx.$emit("forceLocalToExtension")),
          class: "px-4 py-2 text-sm bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors"
        }, " 强制本地同步到扩展存储 "),
        createBaseVNode("button", {
          onClick: _cache[5] || (_cache[5] = ($event) => _ctx.$emit("exportConfiguration")),
          class: "px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        }, " 导出配置 ")
      ]);
    };
  }
});
export {
  _sfc_main as _
};
