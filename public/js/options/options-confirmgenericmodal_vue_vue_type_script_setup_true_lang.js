import { d as defineComponent, j as createBlock, o as openBlock, w as withCtx, a as createElementBlock, e as createCommentVNode, b as createBaseVNode, k as withModifiers, t as toDisplayString, T as Transition } from "./options-addemojimodal_vue_vue_type_script_setup_true_lang.js";
const _hoisted_1 = { class: "text-lg font-semibold mb-4" };
const _hoisted_2 = { class: "text-gray-600 mb-6" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "ConfirmGenericModal",
  props: {
    show: { type: Boolean },
    title: {},
    message: {}
  },
  emits: ["update:show", "confirm", "cancel"],
  setup(__props, { emit: __emit }) {
    const emit = __emit;
    const close = () => {
      emit("update:show", false);
      emit("cancel");
    };
    const confirm = () => emit("confirm");
    return (_ctx, _cache) => {
      return openBlock(), createBlock(Transition, {
        name: "modal",
        appear: ""
      }, {
        default: withCtx(() => [
          _ctx.show ? (openBlock(), createElementBlock("div", {
            key: 0,
            class: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50",
            onClick: close
          }, [
            createBaseVNode("div", {
              class: "bg-white rounded-lg p-6 w-full max-w-md",
              onClick: _cache[0] || (_cache[0] = withModifiers(() => {
              }, ["stop"]))
            }, [
              createBaseVNode("h3", _hoisted_1, toDisplayString(_ctx.title || "确认"), 1),
              createBaseVNode("p", _hoisted_2, toDisplayString(_ctx.message || "确定要继续此操作吗？"), 1),
              createBaseVNode("div", { class: "flex justify-end gap-3" }, [
                createBaseVNode("button", {
                  onClick: close,
                  class: "px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
                }, " 取消 "),
                createBaseVNode("button", {
                  onClick: confirm,
                  class: "px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                }, " 确定 ")
              ])
            ])
          ])) : createCommentVNode("", true)
        ]),
        _: 1
      });
    };
  }
});
export {
  _sfc_main as _
};
