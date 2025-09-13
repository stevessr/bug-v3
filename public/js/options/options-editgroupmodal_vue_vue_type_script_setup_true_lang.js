import { d as defineComponent, r as ref, z as watch, a as createElementBlock, e as createCommentVNode, o as openBlock, b as createBaseVNode, h as withDirectives, m as vModelText, u as unref, q as normalizeImageUrl, k as withModifiers } from "./options-addemojimodal_vue_vue_type_script_setup_true_lang.js";
const _hoisted_1 = { class: "space-y-4" };
const _hoisted_2 = {
  key: 0,
  class: "mt-2 text-center"
};
const _hoisted_3 = ["src"];
const _hoisted_4 = { class: "flex justify-end gap-3 mt-6" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "EditGroupModal",
  props: {
    show: { type: Boolean, required: true },
    editingGroupId: { type: String, required: true },
    initialName: { type: String, required: true },
    initialIcon: { type: String, required: true },
    isImageUrl: { type: Function }
  },
  emits: ["update:show", "save", "imageError"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emits = __emit;
    const localName = ref(props.initialName || "");
    const localIcon = ref(props.initialIcon || "");
    watch(
      () => props.initialName,
      (v) => localName.value = v || ""
    );
    watch(
      () => props.initialIcon,
      (v) => localIcon.value = v || ""
    );
    const save = () => {
      emits("save", {
        id: props.editingGroupId,
        name: localName.value.trim(),
        icon: localIcon.value || "📁"
      });
      emits("update:show", false);
    };
    return (_ctx, _cache) => {
      return __props.show ? (openBlock(), createElementBlock("div", {
        key: 0,
        class: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50",
        onClick: _cache[5] || (_cache[5] = ($event) => _ctx.$emit("update:show", false))
      }, [
        createBaseVNode("div", {
          class: "bg-white rounded-lg p-6 w-full max-w-md",
          onClick: _cache[4] || (_cache[4] = withModifiers(() => {
          }, ["stop"]))
        }, [
          _cache[8] || (_cache[8] = createBaseVNode("h3", { class: "text-lg font-semibold mb-4" }, "编辑分组", -1)),
          createBaseVNode("div", _hoisted_1, [
            createBaseVNode("div", null, [
              _cache[6] || (_cache[6] = createBaseVNode("label", { class: "block text-sm font-medium text-gray-700 mb-1" }, "分组名称", -1)),
              withDirectives(createBaseVNode("input", {
                "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => localName.value = $event),
                type: "text",
                class: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              }, null, 512), [
                [vModelText, localName.value]
              ])
            ]),
            createBaseVNode("div", null, [
              _cache[7] || (_cache[7] = createBaseVNode("label", { class: "block text-sm font-medium text-gray-700 mb-1" }, "分组图标/图片链接", -1)),
              withDirectives(createBaseVNode("input", {
                "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => localIcon.value = $event),
                type: "text",
                placeholder: "例如：😀 或 https://...",
                class: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              }, null, 512), [
                [vModelText, localIcon.value]
              ]),
              __props.isImageUrl && __props.isImageUrl(unref(normalizeImageUrl)(localIcon.value)) ? (openBlock(), createElementBlock("div", _hoisted_2, [
                createBaseVNode("img", {
                  src: unref(normalizeImageUrl)(localIcon.value),
                  alt: "预览",
                  class: "w-10 h-10 object-contain mx-auto border border-gray-200 rounded",
                  onError: _cache[2] || (_cache[2] = ($event) => _ctx.$emit("imageError", $event))
                }, null, 40, _hoisted_3)
              ])) : createCommentVNode("", true)
            ])
          ]),
          createBaseVNode("div", _hoisted_4, [
            createBaseVNode("button", {
              onClick: _cache[3] || (_cache[3] = ($event) => _ctx.$emit("update:show", false)),
              class: "px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
            }, " 取消 "),
            createBaseVNode("button", {
              onClick: save,
              class: "px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            }, " 保存 ")
          ])
        ])
      ])) : createCommentVNode("", true);
    };
  }
});
export {
  _sfc_main as _
};
