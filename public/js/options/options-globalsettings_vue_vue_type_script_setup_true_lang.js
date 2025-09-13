import { d as defineComponent, r as ref, z as watch, H as isRef, a as createElementBlock, o as openBlock, b as createBaseVNode, e as createCommentVNode, f as createVNode, u as unref, J as ASlider, t as toDisplayString, K as renderSlot, E as Dropdown, w as withCtx, B as Button, g as createTextVNode, G as DownOutlined, M as Menu } from "./options-addemojimodal_vue_vue_type_script_setup_true_lang.js";
const _hoisted_1 = { class: "bg-white rounded-lg shadow-sm border" };
const _hoisted_2 = { class: "p-6 space-y-6" };
const _hoisted_3 = { class: "flex items-center justify-between" };
const _hoisted_4 = { class: "flex items-center gap-3" };
const _hoisted_5 = { class: "text-sm text-gray-600 w-12" };
const _hoisted_6 = { class: "flex items-center justify-between" };
const _hoisted_7 = { class: "flex items-center justify-between" };
const _hoisted_8 = { class: "relative inline-flex items-center cursor-pointer" };
const _hoisted_9 = ["checked"];
const _hoisted_10 = { class: "flex items-center justify-between" };
const _hoisted_11 = { class: "flex items-center justify-between" };
const _hoisted_12 = { class: "relative inline-flex items-center cursor-pointer" };
const _hoisted_13 = ["checked"];
const _hoisted_17 = { class: "flex items-center justify-between" };
const _hoisted_18 = { class: "relative inline-flex items-center cursor-pointer" };
const _hoisted_19 = ["checked"];
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "GlobalSettings",
  props: {
    settings: {}
  },
  emits: [
    "update:imageScale",
    "update:showSearchBar",
    "update:outputFormat",
    "update:forceMobileMode",
    "update:enableLinuxDoInjection",
    "update:enableXcomExtraSelectors"
  ],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const settings = props.settings;
    const emit = __emit;
    const getOutputFormat = () => {
      try {
        if (isRef(settings)) return settings.value && settings.value.outputFormat || "markdown";
        return settings && settings.outputFormat || "markdown";
      } catch {
        return "markdown";
      }
    };
    const localOutputFormat = ref(getOutputFormat());
    watch(
      () => getOutputFormat(),
      (val) => {
        localOutputFormat.value = val || "markdown";
      }
    );
    const localImageScale = ref(
      (isRef(settings) ? settings.value.imageScale : settings.imageScale) || 30
    );
    watch(
      () => isRef(settings) ? settings.value.imageScale : settings.imageScale,
      (newValue) => {
        if (newValue !== localImageScale.value) {
          localImageScale.value = newValue || 30;
        }
      }
    );
    const handleOutputFormatSelect = (key) => {
      localOutputFormat.value = key;
      emit("update:outputFormat", key);
    };
    const handleOutputFormatSelectInfo = (info) => {
      handleOutputFormatSelect(String(info.key));
    };
    const handleImageScaleChange = (value) => {
      const num = Array.isArray(value) ? value[0] : value;
      setTimeout(() => emit("update:imageScale", num), 0);
    };
    const handleShowSearchBarChange = (e) => {
      const target = e.target;
      emit("update:showSearchBar", target.checked);
    };
    const handleForceMobileModeChange = (e) => {
      const target = e.target;
      emit("update:forceMobileMode", target.checked);
    };
    const handleXcomExtraSelectorsChange = (e) => {
      const target = e.target;
      emit("update:enableXcomExtraSelectors", target.checked);
    };
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        _cache[14] || (_cache[14] = createBaseVNode("div", { class: "px-6 py-4 border-b border-gray-200" }, [
          createBaseVNode("h2", { class: "text-lg font-semibold text-gray-900" }, "全局设置")
        ], -1)),
        createBaseVNode("div", _hoisted_2, [
          createBaseVNode("div", _hoisted_3, [
            _cache[1] || (_cache[1] = createBaseVNode("div", null, [
              createBaseVNode("label", { class: "text-sm font-medium text-gray-900" }, "默认图片缩放"),
              createBaseVNode("p", { class: "text-sm text-gray-500" }, "控制插入表情的默认尺寸")
            ], -1)),
            createBaseVNode("div", _hoisted_4, [
              createVNode(unref(ASlider), {
                id: "imageScaleSlider",
                value: localImageScale.value,
                "onUpdate:value": _cache[0] || (_cache[0] = ($event) => localImageScale.value = $event),
                min: 5,
                max: 150,
                step: 5,
                class: "w-32",
                onChange: handleImageScaleChange
              }, null, 8, ["value"]),
              createBaseVNode("span", _hoisted_5, toDisplayString(localImageScale.value) + "%", 1)
            ])
          ]),
          createBaseVNode("div", _hoisted_6, [
            _cache[2] || (_cache[2] = createBaseVNode("div", null, [
              createBaseVNode("label", { class: "text-sm font-medium text-gray-900" }, "网格列数"),
              createBaseVNode("p", { class: "text-sm text-gray-500" }, "表情选择器中的列数")
            ], -1)),
            renderSlot(_ctx.$slots, "grid-selector")
          ]),
          createBaseVNode("div", _hoisted_7, [
            _cache[4] || (_cache[4] = createBaseVNode("div", null, [
              createBaseVNode("label", { class: "text-sm font-medium text-gray-900" }, "显示搜索栏"),
              createBaseVNode("p", { class: "text-sm text-gray-500" }, "在表情选择器中显示搜索功能")
            ], -1)),
            createBaseVNode("label", _hoisted_8, [
              createBaseVNode("input", {
                type: "checkbox",
                checked: unref(settings).showSearchBar,
                onChange: handleShowSearchBarChange,
                class: "sr-only peer"
              }, null, 40, _hoisted_9),
              _cache[3] || (_cache[3] = createBaseVNode("div", { class: "relative w-11 h-6 bg-gray-200 rounded-full transition-colors peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-5 after:h-5 after:bg-white after:rounded-full after:transition-all after:border after:border-gray-300 peer-checked:after:translate-x-[20px]" }, null, -1))
            ])
          ]),
          createBaseVNode("div", _hoisted_10, [
            _cache[7] || (_cache[7] = createBaseVNode("div", null, [
              createBaseVNode("label", { class: "text-sm font-medium text-gray-900" }, "输出格式"),
              createBaseVNode("p", { class: "text-sm text-gray-500" }, "插入表情时使用的格式")
            ], -1)),
            createVNode(unref(Dropdown), null, {
              overlay: withCtx(() => [
                createVNode(unref(Menu), { onClick: handleOutputFormatSelectInfo }, {
                  default: withCtx(() => [
                    createVNode(unref(Menu).Item, { key: "markdown" }, {
                      default: withCtx(() => _cache[5] || (_cache[5] = [
                        createTextVNode("Markdown 格式", -1)
                      ])),
                      _: 1,
                      __: [5]
                    }),
                    createVNode(unref(Menu).Item, { key: "html" }, {
                      default: withCtx(() => _cache[6] || (_cache[6] = [
                        createTextVNode("HTML 格式", -1)
                      ])),
                      _: 1,
                      __: [6]
                    })
                  ]),
                  _: 1
                })
              ]),
              default: withCtx(() => [
                createVNode(unref(Button), null, {
                  default: withCtx(() => [
                    createTextVNode(toDisplayString(localOutputFormat.value === "markdown" ? "Markdown 格式" : "HTML 格式") + " ", 1),
                    createVNode(unref(DownOutlined))
                  ]),
                  _: 1
                })
              ]),
              _: 1
            })
          ]),
          createBaseVNode("div", _hoisted_11, [
            _cache[9] || (_cache[9] = createBaseVNode("div", null, [
              createBaseVNode("label", { class: "text-sm font-medium text-gray-900" }, "强制移动模式"),
              createBaseVNode("p", { class: "text-sm text-gray-500" }, "在桌面端强制使用移动端样式")
            ], -1)),
            createBaseVNode("label", _hoisted_12, [
              createBaseVNode("input", {
                type: "checkbox",
                checked: unref(settings).forceMobileMode,
                onChange: handleForceMobileModeChange,
                class: "sr-only peer"
              }, null, 40, _hoisted_13),
              _cache[8] || (_cache[8] = createBaseVNode("div", { class: "relative w-11 h-6 bg-gray-200 rounded-full transition-colors peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-5 after:h-5 after:bg-white after:rounded-full after:transition-all after:border after:border-gray-300 peer-checked:after:translate-x-[20px]" }, null, -1))
            ])
          ]),
          createCommentVNode("", true),
          createBaseVNode("div", _hoisted_17, [
            _cache[13] || (_cache[13] = createBaseVNode("div", null, [
              createBaseVNode("label", { class: "text-sm font-medium text-gray-900" }, "启用X.com额外选择器"),
              createBaseVNode("p", { class: "text-sm text-gray-500" }, "在X.com(Twitter)启用额外的选择器控制")
            ], -1)),
            createBaseVNode("label", _hoisted_18, [
              createBaseVNode("input", {
                type: "checkbox",
                checked: unref(settings).enableXcomExtraSelectors,
                onChange: handleXcomExtraSelectorsChange,
                class: "sr-only peer"
              }, null, 40, _hoisted_19),
              _cache[12] || (_cache[12] = createBaseVNode("div", { class: "relative w-11 h-6 bg-gray-200 rounded-full transition-colors peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-5 after:h-5 after:bg-white after:rounded-full after:transition-all after:border after:border-gray-300 peer-checked:after:translate-x-[20px]" }, null, -1))
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
