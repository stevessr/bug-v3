import "./modulepreload-polyfill.js";
import { d as defineComponent, a0 as toRefs, a as createElementBlock, o as openBlock, F as Fragment, i as renderList, n as normalizeClass, u as unref, b as createBaseVNode, g as createTextVNode, p as isImageUrl, q as normalizeImageUrl, t as toDisplayString, e as createCommentVNode, x as normalizeStyle, l as useEmojiStore, r as ref, N as onMounted, z as watch, f as createVNode, h as withDirectives, m as vModelText, H as isRef, Q as createPinia, R as createApp } from "./options/options-addemojimodal_vue_vue_type_script_setup_true_lang.js";
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
const _hoisted_1$2 = { class: "flex border-b border-gray-100 overflow-x-auto" };
const _hoisted_2$2 = ["onClick"];
const _hoisted_3$2 = { class: "mr-1" };
const _hoisted_4$2 = ["src"];
const _sfc_main$2 = /* @__PURE__ */ defineComponent({
  __name: "GroupTabs",
  props: {
    groups: {},
    activeGroupId: {},
    setActive: { type: Function }
  },
  setup(__props) {
    const props = __props;
    const { groups, activeGroupId, setActive } = toRefs(props);
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$2, [
        (openBlock(true), createElementBlock(Fragment, null, renderList(unref(groups), (group) => {
          return openBlock(), createElementBlock("button", {
            key: group.id,
            onClick: ($event) => unref(setActive)(group.id),
            class: normalizeClass(["flex-shrink-0 px-3 py-2 mobile:px-4 mobile:py-3 text-xs mobile:text-sm font-medium border-b-2 transition-colors", [
              unref(activeGroupId) === group.id ? "border-blue-500 text-blue-600 bg-blue-50" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            ]])
          }, [
            createBaseVNode("span", _hoisted_3$2, [
              unref(isImageUrl) && unref(isImageUrl)(unref(normalizeImageUrl)(group.icon)) ? (openBlock(), createElementBlock("img", {
                key: 0,
                src: unref(normalizeImageUrl)(group.icon),
                alt: "group icon",
                class: "w-4 h-4 mobile:w-5 mobile:h-5 object-contain inline-block"
              }, null, 8, _hoisted_4$2)) : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                createTextVNode(toDisplayString(group.icon), 1)
              ], 64))
            ]),
            createTextVNode(" " + toDisplayString(group.name), 1)
          ], 10, _hoisted_2$2);
        }), 128))
      ]);
    };
  }
});
const _hoisted_1$1 = {
  key: 0,
  class: "flex items-center justify-center py-8"
};
const _hoisted_2$1 = {
  key: 1,
  class: "p-0 overflow-hidden"
};
const _hoisted_3$1 = ["onClick", "title"];
const _hoisted_4$1 = { class: "w-10 h-10 mobile:w-12 mobile:h-12 rounded overflow-hidden mx-auto" };
const _hoisted_5$1 = ["src", "alt"];
const _hoisted_6$1 = ["title"];
const _hoisted_7$1 = {
  key: 1,
  class: "absolute top-0 right-0 w-3 h-3 bg-yellow-400 rounded-full flex items-center justify-center"
};
const _hoisted_8$1 = {
  key: 2,
  class: "flex flex-col items-center justify-center py-8 text-center"
};
const _hoisted_9 = { class: "text-sm text-gray-600" };
const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "EmojiGrid",
  props: {
    emojis: {},
    isLoading: { type: Boolean },
    favorites: {},
    gridColumns: {},
    emptyMessage: {},
    showAddButton: { type: Boolean }
  },
  emits: ["select", "openOptions"],
  setup(__props) {
    const props = __props;
    const { emojis, isLoading, favorites, gridColumns, emptyMessage, showAddButton } = toRefs(props);
    return (_ctx, _cache) => {
      return unref(isLoading) ? (openBlock(), createElementBlock("div", _hoisted_1$1, _cache[1] || (_cache[1] = [
        createBaseVNode("div", { class: "animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" }, null, -1),
        createBaseVNode("span", { class: "ml-2 text-sm text-gray-600" }, "加载中...", -1)
      ]))) : unref(emojis).length > 0 ? (openBlock(), createElementBlock("div", _hoisted_2$1, [
        createBaseVNode("div", {
          class: "grid emoji-grid overflow-y-auto",
          style: normalizeStyle(`grid-template-columns: repeat(${unref(gridColumns)}, minmax(0, 1fr)); max-height: 300px;`)
        }, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(unref(emojis), (emoji) => {
            return openBlock(), createElementBlock("button", {
              key: emoji.id,
              onClick: ($event) => _ctx.$emit("select", emoji),
              class: "relative p-0 rounded hover:bg-gray-100 transition-colors group mobile:p-2",
              title: emoji.name
            }, [
              createBaseVNode("div", _hoisted_4$1, [
                createBaseVNode("img", {
                  src: emoji.displayUrl || emoji.url,
                  alt: emoji.name,
                  class: "w-full h-full object-cover",
                  loading: "lazy"
                }, null, 8, _hoisted_5$1)
              ]),
              unref(favorites).has(emoji.id) && emoji.usageCount ? (openBlock(), createElementBlock("div", {
                key: 0,
                class: "absolute top-0 right-0 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center text-xs text-white font-bold",
                title: `使用 ${emoji.usageCount} 次`
              }, toDisplayString(emoji.usageCount > 99 ? "99+" : emoji.usageCount), 9, _hoisted_6$1)) : unref(favorites).has(emoji.id) ? (openBlock(), createElementBlock("div", _hoisted_7$1, _cache[2] || (_cache[2] = [
                createBaseVNode("svg", {
                  class: "w-2 h-2 text-white",
                  fill: "currentColor",
                  viewBox: "0 0 20 20"
                }, [
                  createBaseVNode("path", { d: "M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" })
                ], -1)
              ]))) : createCommentVNode("", true)
            ], 8, _hoisted_3$1);
          }), 128))
        ], 4)
      ])) : (openBlock(), createElementBlock("div", _hoisted_8$1, [
        _cache[3] || (_cache[3] = createBaseVNode("svg", {
          class: "w-12 h-12 text-gray-400 mb-2",
          fill: "none",
          stroke: "currentColor",
          viewBox: "0 0 24 24"
        }, [
          createBaseVNode("path", {
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
            "stroke-width": "2",
            d: "M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m8-8v2m0 6v2"
          })
        ], -1)),
        createBaseVNode("p", _hoisted_9, toDisplayString(unref(emptyMessage)), 1),
        unref(showAddButton) ? (openBlock(), createElementBlock("button", {
          key: 0,
          onClick: _cache[0] || (_cache[0] = ($event) => _ctx.$emit("openOptions")),
          class: "mt-2 text-xs text-blue-600 hover:text-blue-800"
        }, " 去添加表情 ")) : createCommentVNode("", true)
      ]));
    };
  }
});
function usePopup() {
  const emojiStore = useEmojiStore();
  const localScale = ref(100);
  const showCopyToast = ref(false);
  onMounted(async () => {
    const timeoutMs = 3e3;
    const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    try {
      const result = await Promise.race([
        // mark loaded on success; swallow errors so race resolves
        emojiStore.loadData().then(() => "loaded").catch(() => "loaded"),
        timeout(timeoutMs).then(() => "timeout")
      ]);
      if (result === "timeout") {
        console.warn("[Popup] emojiStore.loadData timed out after", timeoutMs, "ms; clearing isLoading");
        try {
          emojiStore.isLoading = false;
        } catch (e) {
        }
      }
    } catch (e) {
      console.error("[Popup] emojiStore.loadData crashed:", e);
    } finally {
      try {
        localScale.value = emojiStore.settings.imageScale;
      } catch (e) {
      }
    }
  });
  watch(
    () => emojiStore.settings.imageScale,
    (newScale) => {
      localScale.value = newScale;
    }
  );
  const updateScale = () => {
    emojiStore.updateSettings({ imageScale: localScale.value });
  };
  const selectEmoji = (emoji) => {
    const scale = emojiStore.settings.imageScale;
    const match = emoji.url.match(/_(\d{3,})x(\d{3,})\./);
    let width = "500";
    let height = "500";
    if (match) {
      width = match[1];
      height = match[2];
    } else if (emoji.width && emoji.height) {
      width = emoji.width.toString();
      height = emoji.height.toString();
    }
    const emojiMarkdown = `![${emoji.name}|${width}x${height},${scale}%](${emoji.url}) `;
    navigator.clipboard.writeText(emojiMarkdown).then(() => {
      showCopyToast.value = true;
      setTimeout(() => {
        showCopyToast.value = false;
      }, 2e3);
    }).catch(() => {
      const chromeApi = window.chrome;
      if (chromeApi && chromeApi.tabs) {
        chromeApi.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0] && tabs[0].id) {
            chromeApi.tabs.sendMessage(tabs[0].id, {
              type: "INSERT_EMOJI",
              emoji,
              scale
            });
            showCopyToast.value = true;
            setTimeout(() => {
              showCopyToast.value = false;
            }, 2e3);
          }
        });
      }
    });
    emojiStore.addToFavorites(emoji);
  };
  const openOptions = () => {
    const chromeApi = window.chrome;
    if (chromeApi && chromeApi.runtime) {
      chromeApi.runtime.openOptionsPage();
    }
  };
  return {
    emojiStore,
    localScale,
    showCopyToast,
    updateScale,
    selectEmoji,
    openOptions
  };
}
const _hoisted_1 = { class: "popup-container bg-white" };
const _hoisted_2 = { class: "p-3 border-b border-gray-200 bg-gray-50" };
const _hoisted_3 = { class: "flex items-center justify-between mb-2" };
const _hoisted_4 = { class: "flex items-center gap-2 text-xs" };
const _hoisted_5 = { class: "w-10 text-right text-gray-600" };
const _hoisted_6 = {
  key: 0,
  class: "p-2 border-b border-gray-100"
};
const _hoisted_7 = { class: "relative" };
const _hoisted_8 = {
  key: 1,
  class: "fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm animate-pulse"
};
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "Popup",
  setup(__props) {
    const { emojiStore, localScale, showCopyToast, updateScale, selectEmoji, openOptions } = usePopup();
    const setActiveHandler = (id) => {
      emojiStore.activeGroupId = id;
    };
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createBaseVNode("div", _hoisted_2, [
          createBaseVNode("div", _hoisted_3, [
            _cache[5] || (_cache[5] = createBaseVNode("h2", { class: "text-sm font-semibold text-gray-900" }, "表情管理", -1)),
            createBaseVNode("button", {
              onClick: _cache[0] || (_cache[0] = //@ts-ignore
              (...args) => unref(openOptions) && unref(openOptions)(...args)),
              class: "p-1 text-gray-500 hover:text-gray-700 rounded",
              title: "设置"
            }, _cache[4] || (_cache[4] = [
              createBaseVNode("svg", {
                class: "w-4 h-4",
                fill: "none",
                stroke: "currentColor",
                viewBox: "0 0 24 24"
              }, [
                createBaseVNode("path", {
                  "stroke-linecap": "round",
                  "stroke-linejoin": "round",
                  "stroke-width": "2",
                  d: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                }),
                createBaseVNode("path", {
                  "stroke-linecap": "round",
                  "stroke-linejoin": "round",
                  "stroke-width": "2",
                  d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                })
              ], -1)
            ]))
          ]),
          createBaseVNode("div", _hoisted_4, [
            _cache[6] || (_cache[6] = createBaseVNode("span", { class: "text-gray-600" }, "缩放:", -1)),
            withDirectives(createBaseVNode("input", {
              "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => isRef(localScale) ? localScale.value = $event : null),
              type: "range",
              min: "5",
              max: "150",
              step: "5",
              class: "flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer",
              onInput: _cache[2] || (_cache[2] = //@ts-ignore
              (...args) => unref(updateScale) && unref(updateScale)(...args))
            }, null, 544), [
              [
                vModelText,
                unref(localScale),
                void 0,
                { number: true }
              ]
            ]),
            createBaseVNode("span", _hoisted_5, toDisplayString(unref(localScale)) + "%", 1)
          ])
        ]),
        unref(emojiStore).settings.showSearchBar ? (openBlock(), createElementBlock("div", _hoisted_6, [
          createBaseVNode("div", _hoisted_7, [
            withDirectives(createBaseVNode("input", {
              "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => unref(emojiStore).searchQuery = $event),
              type: "text",
              placeholder: "搜索表情...",
              class: "w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            }, null, 512), [
              [vModelText, unref(emojiStore).searchQuery]
            ]),
            _cache[7] || (_cache[7] = createBaseVNode("svg", {
              class: "absolute right-2 top-1.5 w-4 h-4 text-gray-400",
              fill: "none",
              stroke: "currentColor",
              viewBox: "0 0 24 24"
            }, [
              createBaseVNode("path", {
                "stroke-linecap": "round",
                "stroke-linejoin": "round",
                "stroke-width": "2",
                d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              })
            ], -1))
          ])
        ])) : createCommentVNode("", true),
        createVNode(_sfc_main$2, {
          groups: unref(emojiStore).sortedGroups,
          activeGroupId: unref(emojiStore).activeGroupId,
          setActive: setActiveHandler
        }, null, 8, ["groups", "activeGroupId"]),
        createVNode(_sfc_main$1, {
          emojis: unref(emojiStore).filteredEmojis,
          isLoading: unref(emojiStore).isLoading,
          favorites: unref(emojiStore).favorites,
          gridColumns: unref(emojiStore).settings.gridColumns,
          emptyMessage: unref(emojiStore).searchQuery ? "没有找到匹配的表情" : "该分组还没有表情",
          showAddButton: !unref(emojiStore).searchQuery,
          onSelect: unref(selectEmoji),
          onOpenOptions: unref(openOptions)
        }, null, 8, ["emojis", "isLoading", "favorites", "gridColumns", "emptyMessage", "showAddButton", "onSelect", "onOpenOptions"]),
        unref(showCopyToast) ? (openBlock(), createElementBlock("div", _hoisted_8, " 链接已复制到剪贴板 ")) : createCommentVNode("", true)
      ]);
    };
  }
});
const pinia = createPinia();
const app = createApp(_sfc_main);
app.use(pinia);
app.mount("#app");
