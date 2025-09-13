import { d as defineComponent, a as createElementBlock, o as openBlock, f as createVNode, E as Dropdown, w as withCtx, B as Button, g as createTextVNode, M as Menu, L as __unplugin_components_1, k as withModifiers, y as __unplugin_components_0, b as createBaseVNode } from "./options-addemojimodal_vue_vue_type_script_setup_true_lang.js";
const _hoisted_1 = { class: "relative" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "GroupActionsDropdown",
  props: {
    group: {}
  },
  emits: ["edit", "export", "exportZip", "dedupe", "confirmDelete"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const onEdit = () => emit("edit", props.group);
    const onExport = () => emit("export", props.group);
    const onExportZip = () => emit("exportZip", props.group);
    const onDedupe = () => emit("dedupe", props.group);
    const onConfirmDelete = () => emit("confirmDelete", props.group);
    return (_ctx, _cache) => {
      const _component_a_button = Button;
      const _component_a_menu_item = __unplugin_components_1;
      const _component_a_popconfirm = __unplugin_components_0;
      const _component_a_menu = Menu;
      const _component_a_dropdown = Dropdown;
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createVNode(_component_a_dropdown, { placement: "bottomRight" }, {
          overlay: withCtx(() => [
            createVNode(_component_a_menu, null, {
              default: withCtx(() => [
                createVNode(_component_a_menu_item, {
                  onClick: withModifiers(onEdit, ["prevent"])
                }, {
                  default: withCtx(() => _cache[1] || (_cache[1] = [
                    createTextVNode("编辑", -1)
                  ])),
                  _: 1,
                  __: [1]
                }),
                createVNode(_component_a_menu_item, {
                  onClick: withModifiers(onExport, ["prevent"])
                }, {
                  default: withCtx(() => _cache[2] || (_cache[2] = [
                    createTextVNode("导出", -1)
                  ])),
                  _: 1,
                  __: [2]
                }),
                createVNode(_component_a_popconfirm, {
                  placement: "top",
                  title: "确认要打包下载此分组吗？",
                  "ok-text": "确定",
                  "cancel-text": "取消",
                  onConfirm: onExportZip
                }, {
                  default: withCtx(() => [
                    createVNode(_component_a_menu_item, null, {
                      default: withCtx(() => _cache[3] || (_cache[3] = [
                        createTextVNode("打包下载", -1)
                      ])),
                      _: 1,
                      __: [3]
                    })
                  ]),
                  _: 1
                }),
                createVNode(_component_a_menu_item, {
                  onClick: withModifiers(onDedupe, ["prevent"])
                }, {
                  default: withCtx(() => _cache[4] || (_cache[4] = [
                    createTextVNode("去重", -1)
                  ])),
                  _: 1,
                  __: [4]
                }),
                createVNode(_component_a_menu_item, {
                  onClick: withModifiers(onConfirmDelete, ["prevent"])
                }, {
                  default: withCtx(() => _cache[5] || (_cache[5] = [
                    createBaseVNode("span", { style: { "color": "#e11d48" } }, "删除", -1)
                  ])),
                  _: 1,
                  __: [5]
                })
              ]),
              _: 1
            })
          ]),
          default: withCtx(() => [
            createVNode(_component_a_button, { class: "px-3 py-1 text-sm rounded border bg-white" }, {
              default: withCtx(() => _cache[0] || (_cache[0] = [
                createTextVNode("更多操作", -1)
              ])),
              _: 1,
              __: [0]
            })
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
