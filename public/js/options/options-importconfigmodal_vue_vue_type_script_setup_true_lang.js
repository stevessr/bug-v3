import { d as defineComponent, r as ref, a as createElementBlock, e as createCommentVNode, o as openBlock, b as createBaseVNode, h as withDirectives, m as vModelText, k as withModifiers } from "./options-addemojimodal_vue_vue_type_script_setup_true_lang.js";
const _hoisted_1 = { class: "space-y-4" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "ImportConfigModal",
  props: {
    modelValue: { type: Boolean }
  },
  emits: ["update:modelValue", "imported"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    void props.modelValue;
    const emit = __emit;
    const text = ref("");
    const fileInput = ref(null);
    const close = () => emit("update:modelValue", false);
    const handleFile = (event) => {
      var _a;
      const target = event.target;
      const file = (_a = target.files) == null ? void 0 : _a[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          var _a2;
          text.value = (_a2 = e.target) == null ? void 0 : _a2.result;
        };
        reader.readAsText(file);
      }
    };
    const doImport = () => {
      try {
        const parsed = JSON.parse(text.value);
        emit("imported", parsed);
        text.value = "";
        close();
      } catch (err) {
        emit("imported", null);
      }
    };
    return (_ctx, _cache) => {
      return _ctx.modelValue ? (openBlock(), createElementBlock("div", {
        key: 0,
        class: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50",
        onClick: close
      }, [
        createBaseVNode("div", {
          class: "bg-white rounded-lg p-6 w-full max-w-lg",
          onClick: _cache[1] || (_cache[1] = withModifiers(() => {
          }, ["stop"]))
        }, [
          _cache[4] || (_cache[4] = createBaseVNode("h3", { class: "text-lg font-semibold mb-4" }, "导入配置", -1)),
          createBaseVNode("div", _hoisted_1, [
            createBaseVNode("div", null, [
              _cache[2] || (_cache[2] = createBaseVNode("label", { class: "block text-sm font-medium text-gray-700 mb-1" }, "配置文件", -1)),
              createBaseVNode("input", {
                ref_key: "fileInput",
                ref: fileInput,
                type: "file",
                accept: ".json",
                onChange: handleFile,
                class: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              }, null, 544)
            ]),
            createBaseVNode("div", null, [
              _cache[3] || (_cache[3] = createBaseVNode("label", { class: "block text-sm font-medium text-gray-700 mb-1" }, "或粘贴JSON配置", -1)),
              withDirectives(createBaseVNode("textarea", {
                "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => text.value = $event),
                rows: "6",
                class: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                placeholder: "粘贴JSON配置内容..."
              }, null, 512), [
                [vModelText, text.value]
              ])
            ])
          ]),
          createBaseVNode("div", { class: "flex justify-end gap-3 mt-6" }, [
            createBaseVNode("button", {
              onClick: close,
              class: "px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
            }, " 取消 "),
            createBaseVNode("button", {
              onClick: doImport,
              class: "px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            }, " 导入 ")
          ])
        ])
      ])) : createCommentVNode("", true);
    };
  }
});
export {
  _sfc_main as _
};
