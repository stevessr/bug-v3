import { d as defineComponent, l as useEmojiStore, r as ref, c as computed, N as onMounted, a as createElementBlock, o as openBlock, S as createStaticVNode, b as createBaseVNode, e as createCommentVNode, g as createTextVNode, h as withDirectives, m as vModelText, t as toDisplayString, Y as withKeys, f as createVNode, w as withCtx, u as unref, B as Button, G as DownOutlined, M as Menu, E as Dropdown, F as Fragment, i as renderList, n as normalizeClass, a1 as vModelRadio, R as createApp, Q as createPinia } from "./options/options-addemojimodal_vue_vue_type_script_setup_true_lang.js";
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
const _hoisted_3 = {
  key: 0,
  class: "bg-white rounded-lg shadow-sm border p-6 mb-8"
};
const _hoisted_4 = { class: "space-y-4" };
const _hoisted_5 = ["disabled"];
const _hoisted_6 = {
  key: 1,
  class: "space-y-6"
};
const _hoisted_7 = { class: "bg-white rounded-lg shadow-sm border p-4" };
const _hoisted_8 = { class: "flex justify-between items-center" };
const _hoisted_9 = { class: "text-xs text-gray-500" };
const _hoisted_10 = { class: "bg-white rounded-lg shadow-sm border p-6" };
const _hoisted_11 = { class: "flex gap-4" };
const _hoisted_12 = ["disabled"];
const _hoisted_13 = { class: "mt-4 flex gap-4 text-sm" };
const _hoisted_14 = { class: "flex items-center" };
const _hoisted_15 = { class: "flex items-center" };
const _hoisted_16 = {
  key: 0,
  class: "bg-white rounded-lg shadow-sm border p-6"
};
const _hoisted_17 = { class: "flex justify-between items-center mb-4" };
const _hoisted_18 = {
  key: 0,
  class: "flex gap-2"
};
const _hoisted_19 = { class: "text-sm text-gray-600" };
const _hoisted_20 = { class: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4" };
const _hoisted_21 = ["onClick"];
const _hoisted_22 = ["src", "alt"];
const _hoisted_23 = {
  key: 0,
  class: "absolute top-2 right-2 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs"
};
const _hoisted_24 = { class: "mt-2" };
const _hoisted_25 = ["title"];
const _hoisted_26 = {
  key: 0,
  class: "mt-6 text-center"
};
const _hoisted_27 = ["disabled"];
const _hoisted_28 = {
  key: 1,
  class: "bg-white rounded-lg shadow-sm border p-6 text-center"
};
const _hoisted_29 = {
  key: 0,
  class: "fixed inset-0 z-50 overflow-y-auto",
  "aria-labelledby": "modal-title",
  role: "dialog",
  "aria-modal": "true"
};
const _hoisted_30 = { class: "flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0" };
const _hoisted_31 = { class: "inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6" };
const _hoisted_32 = { class: "space-y-2 max-h-60 overflow-y-auto" };
const _hoisted_33 = ["value"];
const _hoisted_34 = { class: "flex items-center gap-2" };
const _hoisted_35 = { class: "text-lg" };
const _hoisted_36 = { class: "font-medium" };
const _hoisted_37 = { class: "text-sm text-gray-500" };
const _hoisted_38 = { class: "mt-6 flex gap-3" };
const _hoisted_39 = ["disabled"];
const _hoisted_40 = { class: "p-4" };
const _hoisted_41 = { class: "flex" };
const _hoisted_42 = { class: "flex-shrink-0" };
const _hoisted_43 = { class: "ml-3" };
const _hoisted_44 = { class: "ml-auto pl-3" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "Tenor",
  setup(__props) {
    const emojiStore = useEmojiStore();
    const tenorApiKey = ref("");
    const inputApiKey = ref("");
    const searchQuery = ref("");
    const searchResults = ref([]);
    const selectedGifs = ref(/* @__PURE__ */ new Set());
    const isSearching = ref(false);
    const isLoadingMore = ref(false);
    const isImporting = ref(false);
    const hasSearched = ref(false);
    const hasMore = ref(false);
    const nextPos = ref("");
    const searchLimit = ref(12);
    const contentFilter = ref("high");
    const onSearchLimitSelect = (info) => {
      searchLimit.value = Number(String(info.key));
    };
    const onContentFilterSelect = (info) => {
      contentFilter.value = String(info.key);
    };
    const showGroupModal = ref(false);
    const selectedGroupId = ref("");
    const message = ref({ text: "", type: "success" });
    const availableGroups = computed(() => {
      return emojiStore.groups.filter((g) => g.id !== "favorites");
    });
    onMounted(async () => {
      await emojiStore.loadData();
      try {
        const result = await chrome.storage.local.get(["tenorApiKey"]);
        if (result.tenorApiKey) {
          tenorApiKey.value = result.tenorApiKey;
        } else {
          const settings = emojiStore.settings;
          if (settings == null ? void 0 : settings.tenorApiKey) {
            tenorApiKey.value = settings.tenorApiKey;
          }
        }
      } catch (error) {
        console.error("Failed to load Tenor API key:", error);
        try {
          const settings = emojiStore.settings;
          if (settings == null ? void 0 : settings.tenorApiKey) {
            tenorApiKey.value = settings.tenorApiKey;
          }
        } catch (e) {
        }
      }
    });
    const saveApiKey = async () => {
      if (!inputApiKey.value.trim()) return;
      try {
        await chrome.storage.local.set({ tenorApiKey: inputApiKey.value.trim() });
        tenorApiKey.value = inputApiKey.value.trim();
        inputApiKey.value = "";
        showMessage("API Key 已保存", "success");
      } catch (error) {
        console.error("Failed to save API key:", error);
        showMessage("API Key 保存失败", "error");
      }
    };
    const clearApiKey = async () => {
      try {
        await chrome.storage.local.remove(["tenorApiKey"]);
        tenorApiKey.value = "";
        searchResults.value = [];
        selectedGifs.value.clear();
        hasSearched.value = false;
        showMessage("API Key 已清除", "success");
      } catch (error) {
        console.error("Failed to clear API key:", error);
        showMessage("API Key 清除失败", "error");
      }
    };
    const searchGifs = async () => {
      if (!searchQuery.value.trim() || !tenorApiKey.value || isSearching.value) return;
      isSearching.value = true;
      hasSearched.value = true;
      searchResults.value = [];
      selectedGifs.value.clear();
      nextPos.value = "";
      try {
        const url = new URL("https://tenor.googleapis.com/v2/search");
        url.searchParams.set("q", searchQuery.value.trim());
        url.searchParams.set("key", tenorApiKey.value);
        url.searchParams.set("limit", searchLimit.value.toString());
        url.searchParams.set("contentfilter", contentFilter.value);
        url.searchParams.set("media_filter", "tinygif,gif");
        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        if (data.results && Array.isArray(data.results)) {
          searchResults.value = data.results;
          nextPos.value = data.next || "";
          hasMore.value = !!data.next;
        } else {
          searchResults.value = [];
          hasMore.value = false;
        }
      } catch (error) {
        console.error("Search failed:", error);
        showMessage("搜索失败，请检查 API Key 或网络连接", "error");
        searchResults.value = [];
        hasMore.value = false;
      } finally {
        isSearching.value = false;
      }
    };
    const loadMore = async () => {
      if (!nextPos.value || isLoadingMore.value) return;
      isLoadingMore.value = true;
      try {
        const url = new URL("https://tenor.googleapis.com/v2/search");
        url.searchParams.set("q", searchQuery.value.trim());
        url.searchParams.set("key", tenorApiKey.value);
        url.searchParams.set("limit", searchLimit.value.toString());
        url.searchParams.set("contentfilter", contentFilter.value);
        url.searchParams.set("media_filter", "tinygif,gif");
        url.searchParams.set("pos", nextPos.value);
        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        if (data.results && Array.isArray(data.results)) {
          searchResults.value.push(...data.results);
          nextPos.value = data.next || "";
          hasMore.value = !!data.next;
        }
      } catch (error) {
        console.error("Load more failed:", error);
        showMessage("加载更多失败", "error");
      } finally {
        isLoadingMore.value = false;
      }
    };
    const toggleSelection = (gif) => {
      if (selectedGifs.value.has(gif.id)) {
        selectedGifs.value.delete(gif.id);
      } else {
        selectedGifs.value.add(gif.id);
      }
    };
    const importSelected = () => {
      if (selectedGifs.value.size === 0) return;
      if (availableGroups.value.length > 0) {
        const ungroup = availableGroups.value.find((g) => g.id === "ungrouped");
        selectedGroupId.value = ungroup ? "ungrouped" : availableGroups.value[0].id;
      }
      showGroupModal.value = true;
    };
    const confirmImport = async () => {
      if (!selectedGroupId.value || selectedGifs.value.size === 0) return;
      isImporting.value = true;
      try {
        const gifsToImport = searchResults.value.filter((gif) => selectedGifs.value.has(gif.id));
        let successCount = 0;
        for (const gif of gifsToImport) {
          try {
            const emoji = {
              packet: Date.now(),
              name: gif.content_description || `tenor-${gif.id}`,
              url: gif.media_formats.gif && gif.media_formats.gif.url || gif.media_formats.tinygif && gif.media_formats.tinygif.url || ""
            };
            emojiStore.addEmoji(selectedGroupId.value, emoji);
            successCount++;
          } catch (error) {
            console.error("Failed to import GIF:", gif.id, error);
          }
        }
        if (successCount > 0) {
          showMessage(`成功导入 ${successCount} 个 GIF`, "success");
          selectedGifs.value.clear();
          showGroupModal.value = false;
        } else {
          showMessage("导入失败", "error");
        }
      } catch (error) {
        console.error("Import failed:", error);
        showMessage("导入失败", "error");
      } finally {
        isImporting.value = false;
      }
    };
    const showMessage = (text, type = "success") => {
      message.value = { text, type };
      setTimeout(() => {
        message.value.text = "";
      }, 3e3);
    };
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        _cache[23] || (_cache[23] = createStaticVNode('<header class="bg-white shadow-sm border-b"><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div class="flex justify-between items-center py-6"><div><h1 class="text-2xl font-bold text-gray-900">Tenor GIF 搜索</h1><p class="text-sm text-gray-600">搜索并导入 Tenor GIF 表情到你的收藏</p></div></div></div></header>', 1)),
        createBaseVNode("main", _hoisted_2, [
          !tenorApiKey.value ? (openBlock(), createElementBlock("div", _hoisted_3, [
            _cache[9] || (_cache[9] = createBaseVNode("h2", { class: "text-lg font-semibold text-gray-900 mb-4" }, "配置 Tenor API", -1)),
            _cache[10] || (_cache[10] = createBaseVNode("p", { class: "text-sm text-gray-600 mb-4" }, [
              createTextVNode(" 请先设置你的 Tenor API Key。你可以在 "),
              createBaseVNode("a", {
                href: "https://developers.google.com/tenor/guides/quickstart",
                target: "_blank",
                class: "text-blue-600 hover:text-blue-800 underline"
              }, " Tenor 开发者中心 "),
              createTextVNode(" 申请免费的 API Key。 ")
            ], -1)),
            createBaseVNode("div", _hoisted_4, [
              createBaseVNode("div", null, [
                _cache[8] || (_cache[8] = createBaseVNode("label", {
                  for: "api-key",
                  class: "block text-sm font-medium text-gray-700"
                }, " Tenor API Key ", -1)),
                withDirectives(createBaseVNode("input", {
                  id: "api-key",
                  "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => inputApiKey.value = $event),
                  type: "text",
                  class: "mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm",
                  placeholder: "输入你的 Tenor API Key"
                }, null, 512), [
                  [vModelText, inputApiKey.value]
                ])
              ]),
              createBaseVNode("button", {
                onClick: saveApiKey,
                disabled: !inputApiKey.value.trim(),
                class: "px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              }, " 保存 API Key ", 8, _hoisted_5)
            ])
          ])) : (openBlock(), createElementBlock("div", _hoisted_6, [
            createBaseVNode("div", _hoisted_7, [
              createBaseVNode("div", _hoisted_8, [
                createBaseVNode("div", null, [
                  _cache[11] || (_cache[11] = createBaseVNode("h3", { class: "text-sm font-medium text-gray-900" }, "API Key 已配置", -1)),
                  createBaseVNode("p", _hoisted_9, "Key: " + toDisplayString(tenorApiKey.value.substring(0, 8)) + "...", 1)
                ]),
                createBaseVNode("button", {
                  onClick: clearApiKey,
                  class: "px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                }, " 重新配置 ")
              ])
            ]),
            createBaseVNode("div", _hoisted_10, [
              createBaseVNode("div", _hoisted_11, [
                withDirectives(createBaseVNode("input", {
                  "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => searchQuery.value = $event),
                  onKeyup: withKeys(searchGifs, ["enter"]),
                  type: "text",
                  placeholder: "搜索 GIF...",
                  class: "flex-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                }, null, 544), [
                  [vModelText, searchQuery.value]
                ]),
                createBaseVNode("button", {
                  onClick: searchGifs,
                  disabled: isSearching.value || !searchQuery.value.trim(),
                  class: "px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                }, toDisplayString(isSearching.value ? "搜索中..." : "搜索"), 9, _hoisted_12)
              ]),
              createBaseVNode("div", _hoisted_13, [
                createBaseVNode("div", _hoisted_14, [
                  createVNode(unref(Dropdown), null, {
                    overlay: withCtx(() => [
                      createVNode(unref(Menu), {
                        onClick: _cache[2] || (_cache[2] = (info) => onSearchLimitSelect(info))
                      }, {
                        default: withCtx(() => [
                          createVNode(unref(Menu).Item, { key: "12" }, {
                            default: withCtx(() => _cache[12] || (_cache[12] = [
                              createTextVNode("12 个结果", -1)
                            ])),
                            _: 1,
                            __: [12]
                          }),
                          createVNode(unref(Menu).Item, { key: "24" }, {
                            default: withCtx(() => _cache[13] || (_cache[13] = [
                              createTextVNode("24 个结果", -1)
                            ])),
                            _: 1,
                            __: [13]
                          }),
                          createVNode(unref(Menu).Item, { key: "48" }, {
                            default: withCtx(() => _cache[14] || (_cache[14] = [
                              createTextVNode("48 个结果", -1)
                            ])),
                            _: 1,
                            __: [14]
                          })
                        ]),
                        _: 1
                      })
                    ]),
                    default: withCtx(() => [
                      createVNode(unref(Button), null, {
                        default: withCtx(() => [
                          createTextVNode(toDisplayString(searchLimit.value) + " 个结果 ", 1),
                          createVNode(unref(DownOutlined))
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  })
                ]),
                createBaseVNode("div", _hoisted_15, [
                  createVNode(unref(Dropdown), null, {
                    overlay: withCtx(() => [
                      createVNode(unref(Menu), {
                        onClick: _cache[3] || (_cache[3] = (info) => onContentFilterSelect(info))
                      }, {
                        default: withCtx(() => [
                          createVNode(unref(Menu).Item, { key: "high" }, {
                            default: withCtx(() => _cache[15] || (_cache[15] = [
                              createTextVNode("高安全级别", -1)
                            ])),
                            _: 1,
                            __: [15]
                          }),
                          createVNode(unref(Menu).Item, { key: "medium" }, {
                            default: withCtx(() => _cache[16] || (_cache[16] = [
                              createTextVNode("中等安全级别", -1)
                            ])),
                            _: 1,
                            __: [16]
                          }),
                          createVNode(unref(Menu).Item, { key: "low" }, {
                            default: withCtx(() => _cache[17] || (_cache[17] = [
                              createTextVNode("低安全级别", -1)
                            ])),
                            _: 1,
                            __: [17]
                          }),
                          createVNode(unref(Menu).Item, { key: "off" }, {
                            default: withCtx(() => _cache[18] || (_cache[18] = [
                              createTextVNode("关闭过滤", -1)
                            ])),
                            _: 1,
                            __: [18]
                          })
                        ]),
                        _: 1
                      })
                    ]),
                    default: withCtx(() => [
                      createVNode(unref(Button), null, {
                        default: withCtx(() => [
                          createTextVNode(toDisplayString(contentFilter.value) + " ", 1),
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
            searchResults.value.length > 0 ? (openBlock(), createElementBlock("div", _hoisted_16, [
              createBaseVNode("div", _hoisted_17, [
                _cache[19] || (_cache[19] = createBaseVNode("h3", { class: "text-lg font-semibold text-gray-900" }, "搜索结果", -1)),
                selectedGifs.value.size > 0 ? (openBlock(), createElementBlock("div", _hoisted_18, [
                  createBaseVNode("span", _hoisted_19, "已选择 " + toDisplayString(selectedGifs.value.size) + " 个", 1),
                  createBaseVNode("button", {
                    onClick: importSelected,
                    class: "px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  }, " 导入选中 ")
                ])) : createCommentVNode("", true)
              ]),
              createBaseVNode("div", _hoisted_20, [
                (openBlock(true), createElementBlock(Fragment, null, renderList(searchResults.value, (gif) => {
                  var _a, _b, _c, _d;
                  return openBlock(), createElementBlock("div", {
                    key: gif.id,
                    class: "relative group cursor-pointer",
                    onClick: ($event) => toggleSelection(gif)
                  }, [
                    createBaseVNode("div", {
                      class: normalizeClass(["aspect-square bg-gray-100 rounded-lg overflow-hidden", {
                        "ring-2 ring-blue-500": selectedGifs.value.has(gif.id),
                        "ring-1 ring-gray-200": !selectedGifs.value.has(gif.id)
                      }])
                    }, [
                      createBaseVNode("img", {
                        src: ((_b = (_a = gif.media_formats) == null ? void 0 : _a.tinygif) == null ? void 0 : _b.url) || ((_d = (_c = gif.media_formats) == null ? void 0 : _c.gif) == null ? void 0 : _d.url) || "",
                        alt: gif.content_description,
                        class: "w-full h-full object-cover",
                        loading: "lazy"
                      }, null, 8, _hoisted_22)
                    ], 2),
                    selectedGifs.value.has(gif.id) ? (openBlock(), createElementBlock("div", _hoisted_23, " ✓ ")) : createCommentVNode("", true),
                    createBaseVNode("div", _hoisted_24, [
                      createBaseVNode("p", {
                        class: "text-xs text-gray-600 truncate",
                        title: gif.content_description
                      }, toDisplayString(gif.content_description || "Untitled"), 9, _hoisted_25)
                    ])
                  ], 8, _hoisted_21);
                }), 128))
              ]),
              hasMore.value ? (openBlock(), createElementBlock("div", _hoisted_26, [
                createBaseVNode("button", {
                  onClick: loadMore,
                  disabled: isLoadingMore.value,
                  class: "px-6 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                }, toDisplayString(isLoadingMore.value ? "加载中..." : "加载更多"), 9, _hoisted_27)
              ])) : createCommentVNode("", true)
            ])) : hasSearched.value && !isSearching.value ? (openBlock(), createElementBlock("div", _hoisted_28, _cache[20] || (_cache[20] = [
              createBaseVNode("p", { class: "text-gray-500" }, "未找到相关 GIF，请尝试其他关键词", -1)
            ]))) : createCommentVNode("", true)
          ]))
        ]),
        showGroupModal.value ? (openBlock(), createElementBlock("div", _hoisted_29, [
          createBaseVNode("div", _hoisted_30, [
            createBaseVNode("div", {
              class: "fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity",
              onClick: _cache[4] || (_cache[4] = ($event) => showGroupModal.value = false)
            }),
            createBaseVNode("div", _hoisted_31, [
              createBaseVNode("div", null, [
                _cache[21] || (_cache[21] = createBaseVNode("h3", { class: "text-lg leading-6 font-medium text-gray-900 mb-4" }, "选择目标分组", -1)),
                createBaseVNode("div", _hoisted_32, [
                  (openBlock(true), createElementBlock(Fragment, null, renderList(availableGroups.value, (group) => {
                    var _a;
                    return openBlock(), createElementBlock("label", {
                      key: group.id,
                      class: "flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    }, [
                      withDirectives(createBaseVNode("input", {
                        type: "radio",
                        value: group.id,
                        "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => selectedGroupId.value = $event),
                        class: "mr-3"
                      }, null, 8, _hoisted_33), [
                        [vModelRadio, selectedGroupId.value]
                      ]),
                      createBaseVNode("div", _hoisted_34, [
                        createBaseVNode("span", _hoisted_35, toDisplayString(group.icon), 1),
                        createBaseVNode("span", _hoisted_36, toDisplayString(group.name), 1),
                        createBaseVNode("span", _hoisted_37, " (" + toDisplayString(((_a = group.emojis) == null ? void 0 : _a.length) || 0) + " 个表情) ", 1)
                      ])
                    ]);
                  }), 128))
                ]),
                createBaseVNode("div", _hoisted_38, [
                  createBaseVNode("button", {
                    onClick: confirmImport,
                    disabled: !selectedGroupId.value || isImporting.value,
                    class: "flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  }, toDisplayString(isImporting.value ? "导入中..." : `导入 ${selectedGifs.value.size} 个 GIF`), 9, _hoisted_39),
                  createBaseVNode("button", {
                    onClick: _cache[6] || (_cache[6] = ($event) => showGroupModal.value = false),
                    class: "px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  }, " 取消 ")
                ])
              ])
            ])
          ])
        ])) : createCommentVNode("", true),
        message.value.text ? (openBlock(), createElementBlock("div", {
          key: 1,
          class: normalizeClass(["fixed top-4 right-4 max-w-sm w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50", {
            "border-green-200 bg-green-50": message.value.type === "success",
            "border-red-200 bg-red-50": message.value.type === "error"
          }])
        }, [
          createBaseVNode("div", _hoisted_40, [
            createBaseVNode("div", _hoisted_41, [
              createBaseVNode("div", _hoisted_42, [
                createBaseVNode("span", {
                  class: normalizeClass(["w-5 h-5 flex items-center justify-center rounded-full text-sm", {
                    "bg-green-100 text-green-600": message.value.type === "success",
                    "bg-red-100 text-red-600": message.value.type === "error"
                  }])
                }, toDisplayString(message.value.type === "success" ? "✓" : "✕"), 3)
              ]),
              createBaseVNode("div", _hoisted_43, [
                createBaseVNode("p", {
                  class: normalizeClass(["text-sm font-medium", {
                    "text-green-800": message.value.type === "success",
                    "text-red-800": message.value.type === "error"
                  }])
                }, toDisplayString(message.value.text), 3)
              ]),
              createBaseVNode("div", _hoisted_44, [
                createBaseVNode("button", {
                  onClick: _cache[7] || (_cache[7] = ($event) => message.value.text = ""),
                  class: "inline-flex text-gray-400 hover:text-gray-600"
                }, _cache[22] || (_cache[22] = [
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
