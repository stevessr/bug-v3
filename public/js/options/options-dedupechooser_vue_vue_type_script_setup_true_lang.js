import { d as defineComponent, a as createElementBlock, e as createCommentVNode, o as openBlock, b as createBaseVNode, f as createVNode, k as withModifiers, y as __unplugin_components_0, w as withCtx } from "./options-addemojimodal_vue_vue_type_script_setup_true_lang.js";
const _hoisted_1 = {
  key: 0,
  class: "fixed inset-0 flex items-center justify-center",
  style: { "z-index": "1000" }
};
const _hoisted_2 = {
  class: "bg-white p-4 rounded shadow-lg w-80",
  style: { "z-index": "1010", "pointer-events": "auto" }
};
const _hoisted_3 = { class: "flex gap-2 justify-end" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "DedupeChooser",
  props: {
    // visible holds the groupId when the chooser should be shown
    visible: { type: String, required: false },
    previewByNameCount: { type: Number, required: false },
    previewByUrlCount: { type: Number, required: false }
  },
  emits: ["update:visible", "confirm"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const close = () => emit("update:visible", null);
    const confirmName = () => {
      emit("confirm", props.visible ?? null, "name");
      emit("update:visible", null);
    };
    const confirmUrl = () => {
      emit("confirm", props.visible ?? null, "url");
      emit("update:visible", null);
    };
    return (_ctx, _cache) => {
      const _component_a_popconfirm = __unplugin_components_0;
      return __props.visible ? (openBlock(), createElementBlock("div", _hoisted_1, [
        createBaseVNode("div", {
          class: "bg-black/40 absolute inset-0",
          style: { "z-index": "1000" },
          onClick: close
        }),
        createBaseVNode("div", _hoisted_2, [
          _cache[2] || (_cache[2] = createBaseVNode("h3", { class: "font-medium mb-2" }, "去重方式", -1)),
          _cache[3] || (_cache[3] = createBaseVNode("p", { class: "text-sm text-gray-600 mb-4" }, "请选择按名称还是按 URL 去重", -1)),
          createBaseVNode("div", _hoisted_3, [
            createBaseVNode("button", {
              class: "px-3 py-1 border rounded",
              onClick: withModifiers(close, ["prevent"])
            }, "取消"),
            createVNode(_component_a_popconfirm, {
              placement: "top",
              title: `确认按名称去重吗？将删除 ${__props.previewByNameCount ?? 0} 个重复表情。此操作不可撤销。`,
              "ok-text": "确定",
              "cancel-text": "取消",
              onConfirm: confirmName
            }, {
              default: withCtx(() => _cache[0] || (_cache[0] = [
                createBaseVNode("button", { class: "px-3 py-1 bg-blue-600 text-white rounded" }, "按名称", -1)
              ])),
              _: 1,
              __: [0]
            }, 8, ["title"]),
            createVNode(_component_a_popconfirm, {
              placement: "top",
              title: `确认按 URL 去重吗？将删除 ${__props.previewByUrlCount ?? 0} 个重复表情。此操作不可撤销。`,
              "ok-text": "确定",
              "cancel-text": "取消",
              onConfirm: confirmUrl
            }, {
              default: withCtx(() => _cache[1] || (_cache[1] = [
                createBaseVNode("button", { class: "px-3 py-1 bg-green-600 text-white rounded" }, "按 URL", -1)
              ])),
              _: 1,
              __: [1]
            }, 8, ["title"])
          ])
        ])
      ])) : createCommentVNode("", true);
    };
  }
});
export {
  _sfc_main as _
};
