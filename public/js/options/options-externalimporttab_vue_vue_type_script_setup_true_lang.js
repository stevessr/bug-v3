import { d as defineComponent, l as useEmojiStore, r as ref, a as createElementBlock, o as openBlock, b as createBaseVNode, e as createCommentVNode, g as createTextVNode, f as createVNode, w as withCtx, u as unref, B as Button, t as toDisplayString, G as DownOutlined, M as Menu, F as Fragment, i as renderList, j as createBlock, E as Dropdown, h as withDirectives, m as vModelText, n as normalizeClass } from "./options-addemojimodal_vue_vue_type_script_setup_true_lang.js";
import { a as importConfigurationToStore, b as importEmojisToStore } from "./options-importutils.js";
const _hoisted_1 = { class: "space-y-8" };
const _hoisted_2 = { class: "bg-white shadow rounded-lg" };
const _hoisted_3 = { class: "p-6 space-y-6" };
const _hoisted_4 = { class: "border rounded-lg p-4" };
const _hoisted_5 = { class: "flex items-center space-x-3" };
const _hoisted_6 = { class: "border rounded-lg p-4" };
const _hoisted_7 = { class: "space-y-4" };
const _hoisted_8 = { class: "flex items-center space-x-3" };
const _hoisted_9 = {
  key: 0,
  class: "flex items-center space-x-3"
};
const _hoisted_10 = { class: "border rounded-lg p-4" };
const _hoisted_11 = { class: "space-y-4" };
const _hoisted_12 = { class: "flex items-center space-x-3" };
const _hoisted_13 = ["disabled"];
const _hoisted_14 = {
  key: 0,
  class: "border rounded-lg p-4 bg-blue-50"
};
const _hoisted_15 = { class: "flex items-center" };
const _hoisted_16 = { class: "text-sm text-blue-700" };
const _hoisted_17 = { class: "flex items-start" };
const _hoisted_18 = {
  key: 0,
  class: "w-5 h-5 text-green-500 mr-3 mt-0.5",
  fill: "currentColor",
  viewBox: "0 0 20 20"
};
const _hoisted_19 = {
  key: 1,
  class: "w-5 h-5 text-red-500 mr-3 mt-0.5",
  fill: "currentColor",
  viewBox: "0 0 20 20"
};
const _hoisted_20 = { class: "flex-1" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "ExternalImportTab",
  setup(__props) {
    const emojiStore = useEmojiStore();
    const configFileInput = ref();
    const emojiFileInput = ref();
    const showTargetGroupSelector = ref(false);
    const selectedTargetGroup = ref("");
    const selectedTargetGroupForMarkdown = ref("");
    const markdownText = ref("");
    const isImporting = ref(false);
    const importStatus = ref("");
    const importResults = ref(null);
    const onSelectedTargetGroup = (info) => {
      selectedTargetGroup.value = String(info.key);
    };
    const onSelectedTargetGroupForMarkdown = (info) => {
      selectedTargetGroupForMarkdown.value = String(info.key);
    };
    const openImportConfig = () => {
      var _a;
      (_a = configFileInput.value) == null ? void 0 : _a.click();
    };
    const openImportEmojis = () => {
      var _a;
      showTargetGroupSelector.value = true;
      (_a = emojiFileInput.value) == null ? void 0 : _a.click();
    };
    const handleConfigFileSelect = async (event) => {
      var _a, _b;
      const target = event.target;
      const file = (_a = target.files) == null ? void 0 : _a[0];
      if (!file) return;
      isImporting.value = true;
      importStatus.value = "正在读取配置文件...";
      importResults.value = null;
      try {
        const text = await file.text();
        const config = JSON.parse(text);
        importStatus.value = "正在导入配置...";
        await importConfigurationToStore(config);
        importResults.value = {
          success: true,
          message: "配置导入成功",
          details: `已导入 ${((_b = config.groups) == null ? void 0 : _b.length) || 0} 个分组`
        };
      } catch (error) {
        importResults.value = {
          success: false,
          message: "配置导入失败",
          details: error instanceof Error ? error.message : "未知错误"
        };
      } finally {
        isImporting.value = false;
        target.value = "";
      }
    };
    const handleEmojiFileSelect = async (event) => {
      var _a, _b;
      const target = event.target;
      const file = (_a = target.files) == null ? void 0 : _a[0];
      if (!file) return;
      isImporting.value = true;
      importStatus.value = "正在读取表情文件...";
      importResults.value = null;
      try {
        const text = await file.text();
        let data;
        if (file.name.endsWith(".json")) {
          data = JSON.parse(text);
        } else {
          data = text;
        }
        importStatus.value = "正在导入表情...";
        await importEmojisToStore(data, selectedTargetGroup.value || void 0);
        const count = Array.isArray(data) ? data.length : ((_b = data.emojis) == null ? void 0 : _b.length) || "未知数量";
        importResults.value = {
          success: true,
          message: "表情导入成功",
          details: `已导入 ${count} 个表情`
        };
      } catch (error) {
        importResults.value = {
          success: false,
          message: "表情导入失败",
          details: error instanceof Error ? error.message : "未知错误"
        };
      } finally {
        isImporting.value = false;
        showTargetGroupSelector.value = false;
        selectedTargetGroup.value = "";
        target.value = "";
      }
    };
    const importFromMarkdown = async () => {
      if (!markdownText.value.trim()) return;
      isImporting.value = true;
      importStatus.value = "正在解析Markdown文本...";
      importResults.value = null;
      try {
        await importEmojisToStore(markdownText.value, selectedTargetGroupForMarkdown.value || void 0);
        const matches = markdownText.value.match(/!\[([^\]]*)\]\(([^)]+)\)/g);
        const count = (matches == null ? void 0 : matches.length) || 0;
        importResults.value = {
          success: true,
          message: "从文本导入成功",
          details: `已导入 ${count} 个表情`
        };
        markdownText.value = "";
      } catch (error) {
        importResults.value = {
          success: false,
          message: "从文本导入失败",
          details: error instanceof Error ? error.message : "未知错误"
        };
      } finally {
        isImporting.value = false;
        selectedTargetGroupForMarkdown.value = "";
      }
    };
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createBaseVNode("div", _hoisted_2, [
          _cache[16] || (_cache[16] = createBaseVNode("div", { class: "px-6 py-4 border-b border-gray-200" }, [
            createBaseVNode("h3", { class: "text-lg font-medium text-gray-900" }, "外部表情导入"),
            createBaseVNode("p", { class: "mt-1 text-sm text-gray-600" }, "从外部来源导入表情包或配置文件")
          ], -1)),
          createBaseVNode("div", _hoisted_3, [
            createBaseVNode("div", _hoisted_4, [
              _cache[2] || (_cache[2] = createBaseVNode("h4", { class: "text-md font-medium text-gray-900 mb-3" }, "导入配置文件", -1)),
              _cache[3] || (_cache[3] = createBaseVNode("p", { class: "text-sm text-gray-600 mb-4" }, " 导入之前导出的完整配置文件，包含所有分组、表情和设置 ", -1)),
              createBaseVNode("div", _hoisted_5, [
                createBaseVNode("button", {
                  onClick: openImportConfig,
                  class: "inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                }, _cache[1] || (_cache[1] = [
                  createBaseVNode("svg", {
                    class: "w-4 h-4 mr-2",
                    fill: "none",
                    stroke: "currentColor",
                    viewBox: "0 0 24 24"
                  }, [
                    createBaseVNode("path", {
                      "stroke-linecap": "round",
                      "stroke-linejoin": "round",
                      "stroke-width": "2",
                      d: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    })
                  ], -1),
                  createTextVNode(" 选择配置文件 ", -1)
                ])),
                createBaseVNode("input", {
                  ref_key: "configFileInput",
                  ref: configFileInput,
                  type: "file",
                  accept: ".json",
                  class: "hidden",
                  onChange: handleConfigFileSelect
                }, null, 544)
              ])
            ]),
            createBaseVNode("div", _hoisted_6, [
              _cache[7] || (_cache[7] = createBaseVNode("h4", { class: "text-md font-medium text-gray-900 mb-3" }, "导入表情包", -1)),
              _cache[8] || (_cache[8] = createBaseVNode("p", { class: "text-sm text-gray-600 mb-4" }, "导入单个表情包文件或包含多个表情的JSON文件", -1)),
              createBaseVNode("div", _hoisted_7, [
                createBaseVNode("div", _hoisted_8, [
                  createBaseVNode("button", {
                    onClick: openImportEmojis,
                    class: "inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  }, _cache[4] || (_cache[4] = [
                    createBaseVNode("svg", {
                      class: "w-4 h-4 mr-2",
                      fill: "none",
                      stroke: "currentColor",
                      viewBox: "0 0 24 24"
                    }, [
                      createBaseVNode("path", {
                        "stroke-linecap": "round",
                        "stroke-linejoin": "round",
                        "stroke-width": "2",
                        d: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      })
                    ], -1),
                    createTextVNode(" 选择表情文件 ", -1)
                  ])),
                  createBaseVNode("input", {
                    ref_key: "emojiFileInput",
                    ref: emojiFileInput,
                    type: "file",
                    accept: ".json,.txt",
                    class: "hidden",
                    onChange: handleEmojiFileSelect
                  }, null, 544)
                ]),
                showTargetGroupSelector.value ? (openBlock(), createElementBlock("div", _hoisted_9, [
                  _cache[6] || (_cache[6] = createBaseVNode("label", { class: "text-sm font-medium text-gray-700" }, "目标分组:", -1)),
                  createVNode(unref(Dropdown), null, {
                    overlay: withCtx(() => [
                      createVNode(unref(Menu), { onClick: onSelectedTargetGroup }, {
                        default: withCtx(() => [
                          createVNode(unref(Menu).Item, { key: "" }, {
                            default: withCtx(() => _cache[5] || (_cache[5] = [
                              createTextVNode("自动创建分组", -1)
                            ])),
                            _: 1,
                            __: [5]
                          }),
                          (openBlock(true), createElementBlock(Fragment, null, renderList(unref(emojiStore).groups, (group) => {
                            return openBlock(), createBlock(unref(Menu).Item, {
                              key: group.id,
                              value: group.id
                            }, {
                              default: withCtx(() => [
                                createTextVNode(toDisplayString(group.name), 1)
                              ]),
                              _: 2
                            }, 1032, ["value"]);
                          }), 128))
                        ]),
                        _: 1
                      })
                    ]),
                    default: withCtx(() => [
                      createVNode(unref(Button), null, {
                        default: withCtx(() => [
                          createTextVNode(toDisplayString(selectedTargetGroup.value || "自动创建分组") + " ", 1),
                          createVNode(unref(DownOutlined))
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  })
                ])) : createCommentVNode("", true)
              ])
            ]),
            createBaseVNode("div", _hoisted_10, [
              _cache[11] || (_cache[11] = createBaseVNode("h4", { class: "text-md font-medium text-gray-900 mb-3" }, "从文本导入", -1)),
              _cache[12] || (_cache[12] = createBaseVNode("p", { class: "text-sm text-gray-600 mb-4" }, " 从Markdown格式文本导入表情，支持 ![名称](URL) 格式 ", -1)),
              createBaseVNode("div", _hoisted_11, [
                withDirectives(createBaseVNode("textarea", {
                  "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => markdownText.value = $event),
                  placeholder: "粘贴包含 ![表情名](表情URL) 格式的文本...",
                  class: "w-full h-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                }, null, 512), [
                  [vModelText, markdownText.value]
                ]),
                createBaseVNode("div", _hoisted_12, [
                  createBaseVNode("button", {
                    onClick: importFromMarkdown,
                    disabled: !markdownText.value.trim(),
                    class: "inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  }, _cache[9] || (_cache[9] = [
                    createBaseVNode("svg", {
                      class: "w-4 h-4 mr-2",
                      fill: "none",
                      stroke: "currentColor",
                      viewBox: "0 0 24 24"
                    }, [
                      createBaseVNode("path", {
                        "stroke-linecap": "round",
                        "stroke-linejoin": "round",
                        "stroke-width": "2",
                        d: "M12 6v6m0 0v6m0-6h6m-6 0H6"
                      })
                    ], -1),
                    createTextVNode(" 导入文本中的表情 ", -1)
                  ]), 8, _hoisted_13),
                  createVNode(unref(Dropdown), null, {
                    overlay: withCtx(() => [
                      createVNode(unref(Menu), { onClick: onSelectedTargetGroupForMarkdown }, {
                        default: withCtx(() => [
                          createVNode(unref(Menu).Item, { key: "" }, {
                            default: withCtx(() => _cache[10] || (_cache[10] = [
                              createTextVNode("自动创建分组", -1)
                            ])),
                            _: 1,
                            __: [10]
                          }),
                          (openBlock(true), createElementBlock(Fragment, null, renderList(unref(emojiStore).groups, (group) => {
                            return openBlock(), createBlock(unref(Menu).Item, {
                              key: group.id,
                              value: group.id
                            }, {
                              default: withCtx(() => [
                                createTextVNode(toDisplayString(group.name), 1)
                              ]),
                              _: 2
                            }, 1032, ["value"]);
                          }), 128))
                        ]),
                        _: 1
                      })
                    ]),
                    default: withCtx(() => [
                      createVNode(unref(Button), null, {
                        default: withCtx(() => [
                          createTextVNode(toDisplayString(selectedTargetGroupForMarkdown.value || "自动创建分组") + " ", 1),
                          createVNode(unref(DownOutlined))
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  })
                ])
              ])
            ]),
            isImporting.value ? (openBlock(), createElementBlock("div", _hoisted_14, [
              createBaseVNode("div", _hoisted_15, [
                _cache[13] || (_cache[13] = createBaseVNode("div", { class: "animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-3" }, null, -1)),
                createBaseVNode("span", _hoisted_16, toDisplayString(importStatus.value), 1)
              ])
            ])) : createCommentVNode("", true),
            importResults.value ? (openBlock(), createElementBlock("div", {
              key: 1,
              class: normalizeClass(["border rounded-lg p-4", importResults.value.success ? "bg-green-50" : "bg-red-50"])
            }, [
              createBaseVNode("div", _hoisted_17, [
                importResults.value.success ? (openBlock(), createElementBlock("svg", _hoisted_18, _cache[14] || (_cache[14] = [
                  createBaseVNode("path", {
                    "fill-rule": "evenodd",
                    d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",
                    "clip-rule": "evenodd"
                  }, null, -1)
                ]))) : (openBlock(), createElementBlock("svg", _hoisted_19, _cache[15] || (_cache[15] = [
                  createBaseVNode("path", {
                    "fill-rule": "evenodd",
                    d: "M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z",
                    "clip-rule": "evenodd"
                  }, null, -1)
                ]))),
                createBaseVNode("div", _hoisted_20, [
                  createBaseVNode("p", {
                    class: normalizeClass([importResults.value.success ? "text-green-700" : "text-red-700", "text-sm font-medium"])
                  }, toDisplayString(importResults.value.message), 3),
                  importResults.value.details ? (openBlock(), createElementBlock("p", {
                    key: 0,
                    class: normalizeClass([importResults.value.success ? "text-green-600" : "text-red-600", "text-sm mt-1"])
                  }, toDisplayString(importResults.value.details), 3)) : createCommentVNode("", true)
                ])
              ])
            ], 2)) : createCommentVNode("", true)
          ])
        ])
      ]);
    };
  }
});
export {
  _sfc_main as _
};
