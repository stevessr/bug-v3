import { d as defineComponent, a as createElementBlock, o as openBlock, f as createVNode, T as Transition, w as withCtx, e as createCommentVNode, b as createBaseVNode, t as toDisplayString } from "./options-addemojimodal_vue_vue_type_script_setup_true_lang.js";
const _hoisted_1 = {
  key: 0,
  class: "toast success fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50",
  role: "status"
};
const _hoisted_2 = { class: "flex items-center gap-3" };
const _hoisted_3 = { class: "flex-1" };
const _hoisted_4 = {
  key: 0,
  class: "toast error fixed bottom-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50",
  role: "alert"
};
const _hoisted_5 = { class: "flex items-center gap-3" };
const _hoisted_6 = { class: "flex-1" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "NotificationToasts",
  props: {
    showSuccess: { type: Boolean },
    successMessage: {},
    showError: { type: Boolean },
    errorMessage: {}
  },
  emits: ["update:showSuccess", "update:showError"],
  setup(__props, { emit: __emit }) {
    const emit = __emit;
    const closeSuccess = () => emit("update:showSuccess", false);
    const closeError = () => emit("update:showError", false);
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", null, [
        createVNode(Transition, {
          name: "toast",
          appear: ""
        }, {
          default: withCtx(() => [
            _ctx.showSuccess ? (openBlock(), createElementBlock("div", _hoisted_1, [
              createBaseVNode("div", _hoisted_2, [
                createBaseVNode("div", _hoisted_3, toDisplayString(_ctx.successMessage), 1),
                createBaseVNode("button", {
                  onClick: closeSuccess,
                  class: "text-white/90"
                }, "✕")
              ])
            ])) : createCommentVNode("", true)
          ]),
          _: 1
        }),
        createVNode(Transition, {
          name: "toast",
          appear: ""
        }, {
          default: withCtx(() => [
            _ctx.showError ? (openBlock(), createElementBlock("div", _hoisted_4, [
              createBaseVNode("div", _hoisted_5, [
                createBaseVNode("div", _hoisted_6, toDisplayString(_ctx.errorMessage), 1),
                createBaseVNode("button", {
                  onClick: closeError,
                  class: "text-white/90"
                }, "✕")
              ])
            ])) : createCommentVNode("", true)
          ]),
          _: 1
        })
      ]);
    };
  }
});
export {
  _sfc_main as _
};
