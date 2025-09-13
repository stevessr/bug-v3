import { d as defineComponent, l as useEmojiStore, r as ref, N as onMounted, a as createElementBlock, o as openBlock, S as createStaticVNode, b as createBaseVNode, e as createCommentVNode, g as createTextVNode, h as withDirectives, m as vModelText, t as toDisplayString, F as Fragment, i as renderList, n as normalizeClass, R as createApp, Q as createPinia } from "./options/options-addemojimodal_vue_vue_type_script_setup_true_lang.js";
import "./options/options-main.js";
import "./options/options-options_vue_vue_type_script_setup_true_lang.js";
import "./options/options-dedupechooser.js";
import "./options/options-dedupechooser_vue_vue_type_script_setup_true_lang.js";
/* empty css                                                                              */
import "./options/options-headercontrols_vue_vue_type_script_setup_true_lang.js";
import "./options/options-globalsettings_vue_vue_type_script_setup_true_lang.js";
import "./options/options-importconfigmodal_vue_vue_type_script_setup_true_lang.js";
import "./options/options-importemojismodal_vue_vue_type_script_setup_true_lang.js";
import "./options/options-creategroupmodal_vue_vue_type_script_setup_true_lang.js";
import "./options/options-confirmgenericmodal_vue_vue_type_script_setup_true_lang.js";
import "./options/options-notificationtoasts.js";
import "./options/options-notificationtoasts_vue_vue_type_script_setup_true_lang.js";
/* empty css                                                                                   */
import "./options/options-editemojimodal.js";
import "./options/options-editemojimodal_vue_vue_type_script_setup_true_lang.js";
/* empty css                                                                               */
import "./options/options-editgroupmodal_vue_vue_type_script_setup_true_lang.js";
import "./options/options-useoptions.js";
import "./options/options-importutils.js";
import "./options/options-exportutils.js";
const _hoisted_1 = { class: "min-h-screen bg-gray-50" };
const _hoisted_2 = { class: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" };
const _hoisted_3 = { class: "grid grid-cols-1 lg:grid-cols-2 gap-8" };
const _hoisted_4 = { class: "bg-white rounded-lg shadow-sm border p-6" };
const _hoisted_5 = { class: "space-y-4" };
const _hoisted_6 = ["disabled"];
const _hoisted_7 = { class: "bg-white rounded-lg shadow-sm border p-6" };
const _hoisted_8 = { class: "space-y-4" };
const _hoisted_9 = ["disabled"];
const _hoisted_10 = { class: "mt-8 bg-white rounded-lg shadow-sm border p-6" };
const _hoisted_11 = { class: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" };
const _hoisted_12 = { class: "flex items-center gap-3 mb-2" };
const _hoisted_13 = { class: "text-2xl" };
const _hoisted_14 = { class: "font-medium text-gray-900" };
const _hoisted_15 = { class: "text-xs text-gray-500" };
const _hoisted_16 = ["onClick", "disabled"];
const _hoisted_17 = {
  key: 0,
  class: "mt-8 bg-white rounded-lg shadow-sm border p-6"
};
const _hoisted_18 = { class: "space-y-3" };
const _hoisted_19 = { class: "flex items-center gap-3" };
const _hoisted_20 = { class: "font-medium text-gray-900" };
const _hoisted_21 = { class: "text-sm text-gray-600" };
const _hoisted_22 = ["onClick"];
const _hoisted_23 = { class: "p-4" };
const _hoisted_24 = { class: "flex" };
const _hoisted_25 = { class: "flex-shrink-0" };
const _hoisted_26 = { class: "ml-3" };
const _hoisted_27 = { class: "ml-auto pl-3" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "Waline",
  setup(__props) {
    const emojiStore = useEmojiStore();
    const urlInput = ref("");
    const urlGroupName = ref("");
    const jsonInput = ref("");
    const jsonGroupName = ref("");
    const isImportingUrl = ref(false);
    const isImportingJson = ref(false);
    const isImportingSource = ref("");
    const importResults = ref([]);
    const message = ref({ text: "", type: "success" });
    const popularSources = [
      {
        name: "QQ 表情",
        icon: "🐧",
        description: "QQ 经典表情包",
        url: "https://raw.githubusercontent.com/walinejs/emojis/main/qq/info.json"
      },
      {
        name: "微信表情",
        icon: "💬",
        description: "微信默认表情",
        url: "https://raw.githubusercontent.com/walinejs/emojis/main/weibo/info.json"
      },
      {
        name: "Bilibili",
        icon: "📺",
        description: "B站小电视表情",
        url: "https://raw.githubusercontent.com/walinejs/emojis/main/bilibili/info.json"
      },
      {
        name: "Tieba",
        icon: "🗣️",
        description: "百度贴吧表情",
        url: "https://raw.githubusercontent.com/walinejs/emojis/main/tieba/info.json"
      },
      {
        name: "hoyoverse-hi3",
        icon: "🌟",
        description: "崩坏三表情包",
        url: "https://raw.githubusercontent.com/walinejs/emojis/main/hoyoverse-hi3/info.json"
      },
      {
        name: "coolapk",
        icon: "😊",
        description: "coolapk 表情包",
        url: "https://raw.githubusercontent.com/walinejs/emojis/main/coolapk/info.json"
      }
    ];
    onMounted(async () => {
      await emojiStore.loadData();
    });
    const parseWalineConfig = (data) => {
      var _a;
      const emojis = [];
      try {
        if (typeof data === "object" && data !== null) {
          if (Array.isArray(data.items) && data.prefix && data.type) {
            const prefix = data.prefix || "";
            const type = data.type || "png";
            const baseUrl = data.baseUrl || "https://cdn.jsdelivr.net/gh/walinejs/emojis/";
            for (const item of data.items) {
              if (typeof item === "string") {
                const name = item;
                const url = `${baseUrl}${((_a = data.name) == null ? void 0 : _a.toLowerCase()) || "weibo"}/${prefix}${item}.${type}`;
                emojis.push({ name, url });
              }
            }
          } else {
            for (const categoryKey in data) {
              const category = data[categoryKey];
              if (category && typeof category === "object") {
                if (Array.isArray(category.container)) {
                  for (const item of category.container) {
                    if (item && typeof item === "object") {
                      const name = item.text || item.name || item.title || `emoji-${emojis.length}`;
                      const url = item.src || item.url || item.icon;
                      if (url && typeof url === "string") {
                        emojis.push({ name, url });
                      }
                    }
                  }
                } else if (category.src || category.url) {
                  const name = category.text || category.name || `emoji-${emojis.length}`;
                  const url = category.src || category.url;
                  emojis.push({ name, url });
                } else {
                  for (const itemKey in category) {
                    const item = category[itemKey];
                    if (item && typeof item === "object" && (item.src || item.url)) {
                      const name = item.text || item.name || itemKey;
                      const url = item.src || item.url;
                      emojis.push({ name, url });
                    }
                  }
                }
              }
            }
          }
          if (Array.isArray(data)) {
            for (const item of data) {
              if (item && typeof item === "object") {
                const name = item.text || item.name || item.title || `emoji-${emojis.length}`;
                const url = item.src || item.url || item.icon;
                if (url && typeof url === "string") {
                  emojis.push({ name, url });
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Error parsing Waline config:", error);
      }
      return emojis;
    };
    const importFromUrl = async () => {
      if (!urlInput.value.trim()) return;
      isImportingUrl.value = true;
      const resultId = Date.now().toString();
      try {
        const response = await fetch(urlInput.value.trim());
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        const emojis = parseWalineConfig(data);
        if (emojis.length === 0) {
          throw new Error("未找到有效的表情数据");
        }
        const groupName = urlGroupName.value.trim() || "Waline 表情包";
        const group = await emojiStore.createGroup(groupName, "🌐");
        for (const emoji of emojis) {
          emojiStore.addEmojiWithoutSave(group.id, {
            ...emoji,
            packet: Date.now() + Math.floor(Math.random() * 1e3)
          });
        }
        await emojiStore.saveData();
        importResults.value.unshift({
          id: resultId,
          groupName,
          groupId: group.id,
          success: true,
          count: emojis.length
        });
        showMessage(`成功导入 ${emojis.length} 个表情到分组 "${groupName}"`, "success");
        urlInput.value = "";
        urlGroupName.value = "";
      } catch (error) {
        console.error("Import from URL failed:", error);
        const errorMessage = error instanceof Error ? error.message : "导入失败";
        importResults.value.unshift({
          id: resultId,
          groupName: urlGroupName.value.trim() || "Waline 表情包",
          success: false,
          error: errorMessage
        });
        showMessage(`导入失败: ${errorMessage}`, "error");
      } finally {
        isImportingUrl.value = false;
      }
    };
    const importFromJson = async () => {
      if (!jsonInput.value.trim()) return;
      isImportingJson.value = true;
      const resultId = Date.now().toString();
      try {
        const data = JSON.parse(jsonInput.value.trim());
        const emojis = parseWalineConfig(data);
        if (emojis.length === 0) {
          throw new Error("未找到有效的表情数据");
        }
        const groupName = jsonGroupName.value.trim() || "Waline 表情包";
        const group = await emojiStore.createGroup(groupName, "📝");
        for (const emoji of emojis) {
          emojiStore.addEmojiWithoutSave(group.id, {
            ...emoji,
            packet: Date.now() + Math.floor(Math.random() * 1e3)
          });
        }
        await emojiStore.saveData();
        importResults.value.unshift({
          id: resultId,
          groupName,
          groupId: group.id,
          success: true,
          count: emojis.length
        });
        showMessage(`成功导入 ${emojis.length} 个表情到分组 "${groupName}"`, "success");
        jsonInput.value = "";
        jsonGroupName.value = "";
      } catch (error) {
        console.error("Import from JSON failed:", error);
        const errorMessage = error instanceof Error ? error.message : "导入失败";
        importResults.value.unshift({
          id: resultId,
          groupName: jsonGroupName.value.trim() || "Waline 表情包",
          success: false,
          error: errorMessage
        });
        showMessage(`JSON 格式错误: ${errorMessage}`, "error");
      } finally {
        isImportingJson.value = false;
      }
    };
    const importFromSource = async (source) => {
      isImportingSource.value = source.name;
      const resultId = Date.now().toString();
      try {
        const response = await fetch(source.url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        const emojis = parseWalineConfig(data);
        if (emojis.length === 0) {
          throw new Error("未找到有效的表情数据");
        }
        const group = await emojiStore.createGroup(source.name, source.icon);
        for (const emoji of emojis) {
          emojiStore.addEmojiWithoutSave(group.id, {
            ...emoji,
            packet: Date.now() + Math.floor(Math.random() * 1e3)
          });
        }
        await emojiStore.saveData();
        importResults.value.unshift({
          id: resultId,
          groupName: source.name,
          groupId: group.id,
          success: true,
          count: emojis.length
        });
        showMessage(`成功导入 ${source.name} (${emojis.length} 个表情)`, "success");
      } catch (error) {
        console.error("Import from source failed:", error);
        const errorMessage = error instanceof Error ? error.message : "导入失败";
        importResults.value.unshift({
          id: resultId,
          groupName: source.name,
          success: false,
          error: errorMessage
        });
        showMessage(`导入 ${source.name} 失败: ${errorMessage}`, "error");
      } finally {
        isImportingSource.value = "";
      }
    };
    const viewGroup = (groupId) => {
      if (groupId) {
        window.open(`/options.html#groups=${groupId}`, "_blank");
      }
    };
    const clearResults = () => {
      importResults.value = [];
    };
    const showMessage = (text, type = "success") => {
      message.value = { text, type };
      setTimeout(() => {
        message.value.text = "";
      }, 3e3);
    };
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        _cache[17] || (_cache[17] = createStaticVNode('<header class="bg-white shadow-sm border-b"><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div class="flex justify-between items-center py-6"><div><h1 class="text-2xl font-bold text-gray-900">Waline 表情导入</h1><p class="text-sm text-gray-600">从 GitHub 仓库批量导入 Waline 风格的表情包</p></div></div></div></header>', 1)),
        createBaseVNode("main", _hoisted_2, [
          createBaseVNode("div", _hoisted_3, [
            createBaseVNode("div", _hoisted_4, [
              _cache[7] || (_cache[7] = createBaseVNode("h2", { class: "text-lg font-semibold text-gray-900 mb-4" }, "从 URL 导入", -1)),
              _cache[8] || (_cache[8] = createBaseVNode("p", { class: "text-sm text-gray-600 mb-4" }, [
                createTextVNode(" 输入 Waline 表情配置的 JSON URL 或 GitHub raw 文件链接 "),
                createBaseVNode("br"),
                createBaseVNode("span", { class: "text-xs text-gray-500" }, "支持标准 Waline 格式和 Weibo 风格格式")
              ], -1)),
              createBaseVNode("div", _hoisted_5, [
                createBaseVNode("div", null, [
                  _cache[5] || (_cache[5] = createBaseVNode("label", {
                    for: "url-input",
                    class: "block text-sm font-medium text-gray-700"
                  }, " 表情配置 URL ", -1)),
                  withDirectives(createBaseVNode("input", {
                    id: "url-input",
                    "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => urlInput.value = $event),
                    type: "url",
                    class: "mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm",
                    placeholder: "https://raw.githubusercontent.com/user/repo/main/emoji.json"
                  }, null, 512), [
                    [vModelText, urlInput.value]
                  ])
                ]),
                createBaseVNode("div", null, [
                  _cache[6] || (_cache[6] = createBaseVNode("label", {
                    for: "url-group-name",
                    class: "block text-sm font-medium text-gray-700"
                  }, " 分组名称 ", -1)),
                  withDirectives(createBaseVNode("input", {
                    id: "url-group-name",
                    "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => urlGroupName.value = $event),
                    type: "text",
                    class: "mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm",
                    placeholder: "Waline 表情包"
                  }, null, 512), [
                    [vModelText, urlGroupName.value]
                  ])
                ]),
                createBaseVNode("button", {
                  onClick: importFromUrl,
                  disabled: !urlInput.value.trim() || isImportingUrl.value,
                  class: "w-full px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                }, toDisplayString(isImportingUrl.value ? "导入中..." : "从 URL 导入"), 9, _hoisted_6)
              ])
            ]),
            createBaseVNode("div", _hoisted_7, [
              _cache[11] || (_cache[11] = createBaseVNode("h2", { class: "text-lg font-semibold text-gray-900 mb-4" }, "从 JSON 文本导入", -1)),
              _cache[12] || (_cache[12] = createBaseVNode("p", { class: "text-sm text-gray-600 mb-4" }, [
                createTextVNode(" 直接粘贴 Waline 表情配置的 JSON 内容 "),
                createBaseVNode("br"),
                createBaseVNode("span", { class: "text-xs text-gray-500" }, " 支持标准 Waline 格式和 Weibo 风格格式 (包含 name, prefix, type, items 的配置) ")
              ], -1)),
              createBaseVNode("div", _hoisted_8, [
                createBaseVNode("div", null, [
                  _cache[9] || (_cache[9] = createBaseVNode("label", {
                    for: "json-input",
                    class: "block text-sm font-medium text-gray-700"
                  }, " JSON 配置 ", -1)),
                  withDirectives(createBaseVNode("textarea", {
                    id: "json-input",
                    "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => jsonInput.value = $event),
                    rows: "8",
                    class: "mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono text-xs",
                    placeholder: '示例格式1: { "表情包名": { "type": "image", "container": [{ "icon": "😀", "text": "表情名", "src": "图片链接" }] } }\n示例格式2: { "name": "Weibo", "prefix": "weibo_", "type": "png", "items": ["smile", "lovely"] }'
                  }, null, 512), [
                    [vModelText, jsonInput.value]
                  ])
                ]),
                createBaseVNode("div", null, [
                  _cache[10] || (_cache[10] = createBaseVNode("label", {
                    for: "json-group-name",
                    class: "block text-sm font-medium text-gray-700"
                  }, " 分组名称 ", -1)),
                  withDirectives(createBaseVNode("input", {
                    id: "json-group-name",
                    "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => jsonGroupName.value = $event),
                    type: "text",
                    class: "mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm",
                    placeholder: "Waline 表情包"
                  }, null, 512), [
                    [vModelText, jsonGroupName.value]
                  ])
                ]),
                createBaseVNode("button", {
                  onClick: importFromJson,
                  disabled: !jsonInput.value.trim() || isImportingJson.value,
                  class: "w-full px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                }, toDisplayString(isImportingJson.value ? "导入中..." : "从 JSON 导入"), 9, _hoisted_9)
              ])
            ])
          ]),
          createBaseVNode("div", _hoisted_10, [
            _cache[13] || (_cache[13] = createBaseVNode("h2", { class: "text-lg font-semibold text-gray-900 mb-4" }, "常用 Waline 表情源", -1)),
            _cache[14] || (_cache[14] = createBaseVNode("p", { class: "text-sm text-gray-600 mb-6" }, "点击下方链接快速导入常用的 Waline 表情包", -1)),
            createBaseVNode("div", _hoisted_11, [
              (openBlock(), createElementBlock(Fragment, null, renderList(popularSources, (source) => {
                return createBaseVNode("div", {
                  key: source.name,
                  class: "border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                }, [
                  createBaseVNode("div", _hoisted_12, [
                    createBaseVNode("span", _hoisted_13, toDisplayString(source.icon), 1),
                    createBaseVNode("div", null, [
                      createBaseVNode("h3", _hoisted_14, toDisplayString(source.name), 1),
                      createBaseVNode("p", _hoisted_15, toDisplayString(source.description), 1)
                    ])
                  ]),
                  createBaseVNode("button", {
                    onClick: ($event) => importFromSource(source),
                    disabled: isImportingSource.value === source.name,
                    class: "w-full mt-2 px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                  }, toDisplayString(isImportingSource.value === source.name ? "导入中..." : "快速导入"), 9, _hoisted_16)
                ]);
              }), 64))
            ])
          ]),
          importResults.value.length > 0 ? (openBlock(), createElementBlock("div", _hoisted_17, [
            _cache[15] || (_cache[15] = createBaseVNode("h2", { class: "text-lg font-semibold text-gray-900 mb-4" }, "导入结果", -1)),
            createBaseVNode("div", _hoisted_18, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(importResults.value, (result) => {
                return openBlock(), createElementBlock("div", {
                  key: result.id,
                  class: normalizeClass(["flex items-center justify-between p-3 border border-gray-200 rounded-lg", {
                    "border-green-200 bg-green-50": result.success,
                    "border-red-200 bg-red-50": !result.success
                  }])
                }, [
                  createBaseVNode("div", _hoisted_19, [
                    createBaseVNode("span", {
                      class: normalizeClass(["w-6 h-6 flex items-center justify-center rounded-full text-sm", {
                        "bg-green-100 text-green-600": result.success,
                        "bg-red-100 text-red-600": !result.success
                      }])
                    }, toDisplayString(result.success ? "✓" : "✕"), 3),
                    createBaseVNode("div", null, [
                      createBaseVNode("p", _hoisted_20, toDisplayString(result.groupName), 1),
                      createBaseVNode("p", _hoisted_21, toDisplayString(result.success ? `成功导入 ${result.count} 个表情` : result.error), 1)
                    ])
                  ]),
                  result.success ? (openBlock(), createElementBlock("button", {
                    key: 0,
                    onClick: ($event) => viewGroup(result.groupId),
                    class: "px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  }, " 查看分组 ", 8, _hoisted_22)) : createCommentVNode("", true)
                ], 2);
              }), 128))
            ]),
            createBaseVNode("div", { class: "mt-4 flex justify-end" }, [
              createBaseVNode("button", {
                onClick: clearResults,
                class: "px-3 py-1 text-sm text-gray-600 hover:bg-gray-50 rounded transition-colors"
              }, " 清除结果 ")
            ])
          ])) : createCommentVNode("", true)
        ]),
        message.value.text ? (openBlock(), createElementBlock("div", {
          key: 0,
          class: normalizeClass(["fixed top-4 right-4 max-w-sm w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50", {
            "border-green-200 bg-green-50": message.value.type === "success",
            "border-red-200 bg-red-50": message.value.type === "error"
          }])
        }, [
          createBaseVNode("div", _hoisted_23, [
            createBaseVNode("div", _hoisted_24, [
              createBaseVNode("div", _hoisted_25, [
                createBaseVNode("span", {
                  class: normalizeClass(["w-5 h-5 flex items-center justify-center rounded-full text-sm", {
                    "bg-green-100 text-green-600": message.value.type === "success",
                    "bg-red-100 text-red-600": message.value.type === "error"
                  }])
                }, toDisplayString(message.value.type === "success" ? "✓" : "✕"), 3)
              ]),
              createBaseVNode("div", _hoisted_26, [
                createBaseVNode("p", {
                  class: normalizeClass(["text-sm font-medium", {
                    "text-green-800": message.value.type === "success",
                    "text-red-800": message.value.type === "error"
                  }])
                }, toDisplayString(message.value.text), 3)
              ]),
              createBaseVNode("div", _hoisted_27, [
                createBaseVNode("button", {
                  onClick: _cache[4] || (_cache[4] = ($event) => message.value.text = ""),
                  class: "inline-flex text-gray-400 hover:text-gray-600"
                }, _cache[16] || (_cache[16] = [
                  createBaseVNode("span", { class: "sr-only" }, "关闭", -1),
                  createTextVNode(" ✕ ", -1)
                ]))
              ])
            ])
          ])
        ], 2)) : createCommentVNode("", true)
      ]);
    };
  }
});
const app = createApp(_sfc_main);
const pinia = createPinia();
app.use(pinia);
app.mount("#app");
