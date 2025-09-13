import { d as defineComponent, r as ref, l as useEmojiStore, a as createElementBlock, e as createCommentVNode, o as openBlock, b as createBaseVNode, h as withDirectives, m as vModelText, u as unref, p as isImageUrl, q as normalizeImageUrl, F as Fragment, i as renderList, k as withModifiers, s as flushBuffer, x as normalizeStyle, n as normalizeClass } from "./options-addemojimodal_vue_vue_type_script_setup_true_lang.js";
const _hoisted_1 = { class: "space-y-4" };
const _hoisted_2 = {
  key: 0,
  class: "mt-2 text-center"
};
const _hoisted_3 = ["src"];
const _hoisted_4 = { class: "flex gap-2" };
const _hoisted_5 = ["onClick"];
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "CreateGroupModal",
  props: {
    show: { type: Boolean }
  },
  emits: ["update:show", "created"],
  setup(__props, { emit: __emit }) {
    const emits = __emit;
    const name = ref("");
    const icon = ref("📁");
    const selectedColor = ref("#3B82F6");
    const colorOptions = [
      "#3B82F6",
      "#10B981",
      "#F59E0B",
      "#EF4444",
      "#8B5CF6",
      "#F97316",
      "#06B6D4",
      "#84CC16"
    ];
    const emojiStore = useEmojiStore();
    const handleImageError = (event) => {
      const target = event.target;
      target.src = "";
    };
    const close = () => {
      emits("update:show", false);
    };
    const selectColor = (color) => {
      selectedColor.value = color;
    };
    const create = () => {
      if (!name.value.trim()) return;
      emojiStore.createGroup(name.value.trim(), icon.value || "📁");
      void flushBuffer(true);
      name.value = "";
      icon.value = "📁";
      selectedColor.value = "#3B82F6";
      emits("created");
      emits("update:show", false);
    };
    return (_ctx, _cache) => {
      return _ctx.show ? (openBlock(), createElementBlock("div", {
        key: 0,
        class: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50",
        onClick: close
      }, [
        createBaseVNode("div", {
          class: "bg-white rounded-lg p-6 w-full max-w-md",
          onClick: _cache[2] || (_cache[2] = withModifiers(() => {
          }, ["stop"]))
        }, [
          _cache[6] || (_cache[6] = createBaseVNode("h3", { class: "text-lg font-semibold mb-4" }, "新建分组", -1)),
          createBaseVNode("div", _hoisted_1, [
            createBaseVNode("div", null, [
              _cache[3] || (_cache[3] = createBaseVNode("label", { class: "block text-sm font-medium text-gray-700 mb-1" }, "分组名称", -1)),
              withDirectives(createBaseVNode("input", {
                "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => name.value = $event),
                type: "text",
                class: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                placeholder: "输入分组名称"
              }, null, 512), [
                [vModelText, name.value]
              ])
            ]),
            createBaseVNode("div", null, [
              _cache[4] || (_cache[4] = createBaseVNode("label", { class: "block text-sm font-medium text-gray-700 mb-1" }, "分组图标 / 图片链接", -1)),
              withDirectives(createBaseVNode("input", {
                "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => icon.value = $event),
                type: "text",
                class: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                placeholder: "例如：😀 或 https://..."
              }, null, 512), [
                [vModelText, icon.value]
              ]),
              unref(isImageUrl) && unref(isImageUrl)(unref(normalizeImageUrl)(icon.value)) ? (openBlock(), createElementBlock("div", _hoisted_2, [
                createBaseVNode("img", {
                  src: unref(normalizeImageUrl)(icon.value),
                  alt: "预览",
                  class: "w-10 h-10 object-contain mx-auto border border-gray-200 rounded",
                  onError: handleImageError
                }, null, 40, _hoisted_3)
              ])) : createCommentVNode("", true)
            ]),
            createBaseVNode("div", null, [
              _cache[5] || (_cache[5] = createBaseVNode("label", { class: "block text-sm font-medium text-gray-700 mb-1" }, "分组颜色", -1)),
              createBaseVNode("div", _hoisted_4, [
                (openBlock(), createElementBlock(Fragment, null, renderList(colorOptions, (color) => {
                  return createBaseVNode("div", {
                    key: color,
                    class: normalizeClass(["w-8 h-8 rounded cursor-pointer border-2", [selectedColor.value === color ? "border-gray-900" : "border-gray-300"]]),
                    style: normalizeStyle({ backgroundColor: color }),
                    onClick: ($event) => selectColor(color)
                  }, null, 14, _hoisted_5);
                }), 64))
              ])
            ])
          ]),
          createBaseVNode("div", { class: "flex justify-end gap-3 mt-6" }, [
            createBaseVNode("button", {
              onClick: close,
              class: "px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
            }, " 取消 "),
            createBaseVNode("button", {
              onClick: create,
              class: "px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            }, " 创建 ")
          ])
        ])
      ])) : createCommentVNode("", true);
    };
  }
});
export {
  _sfc_main as _
};
