const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["js/options/options-emojistats.js","js/options/options-emojistats_vue_vue_type_script_setup_true_lang.js","js/options/options-addemojimodal_vue_vue_type_script_setup_true_lang.js","js/options/options-groupstab.js","js/options/options-groupstab_vue_vue_type_script_setup_true_lang.js","js/options/options-groupscardview.js","js/options/options-groupscardview_vue_vue_type_script_setup_true_lang.js","js/options/options-groupactionsdropdown.js","js/options/options-groupactionsdropdown_vue_vue_type_script_setup_true_lang.js","js/options/options-dedupechooser.js","js/options/options-dedupechooser_vue_vue_type_script_setup_true_lang.js","assets/options-dedupechooser_vue_vue_type_style_index_0_scoped_6b377d80_lang.css","assets/options-groupactionsdropdown_vue_vue_type_style_index_0_scoped_0128cc47_lang.css","assets/options-groupscardview_vue_vue_type_style_index_0_scoped_97f1533c_lang.css","assets/options-groupstab_vue_vue_type_style_index_0_scoped_60202387_lang.css","js/options/options-favoritestab.js","js/options/options-favoritestab_vue_vue_type_script_setup_true_lang.js","assets/options-favoritestab_vue_vue_type_style_index_0_scoped_7dc9d199_lang.css","js/options/options-ungroupedtab.js","js/options/options-ungroupedtab_vue_vue_type_script_setup_true_lang.js","js/options/options-editemojimodal_vue_vue_type_script_setup_true_lang.js","assets/options-ungroupedtab_vue_vue_type_style_index_0_scoped_f95cdb33_lang.css","js/options/options-externalimporttab.js","js/options/options-externalimporttab_vue_vue_type_script_setup_true_lang.js","js/options/options-importutils.js","js/options/options-bilibiliimport.js","js/options/options-bilibiliimport_vue_vue_type_script_setup_true_lang.js"])))=>i.map(i=>d[i]);
import { d as defineComponent, c as computed, j as createBlock, o as openBlock, w as withCtx, f as createVNode, u as unref, B as Button, g as createTextVNode, t as toDisplayString, G as DownOutlined, M as Menu, a as createElementBlock, F as Fragment, i as renderList, E as Dropdown, S as createStaticVNode, N as onMounted, U as onBeforeUnmount, b as createBaseVNode, e as createCommentVNode, H as isRef, V as defineAsyncComponent, W as Suspense, _ as _sfc_main$6, X as __vitePreload, n as normalizeClass, k as withModifiers } from "./options-addemojimodal_vue_vue_type_script_setup_true_lang.js";
import { _ as _export_sfc } from "./options-dedupechooser.js";
import { _ as _sfc_main$3 } from "./options-headercontrols_vue_vue_type_script_setup_true_lang.js";
import { _ as _sfc_main$4 } from "./options-globalsettings_vue_vue_type_script_setup_true_lang.js";
import { _ as _sfc_main$8 } from "./options-importconfigmodal_vue_vue_type_script_setup_true_lang.js";
import { _ as _sfc_main$9 } from "./options-importemojismodal_vue_vue_type_script_setup_true_lang.js";
import { _ as _sfc_main$5 } from "./options-creategroupmodal_vue_vue_type_script_setup_true_lang.js";
import { _ as _sfc_main$a } from "./options-confirmgenericmodal_vue_vue_type_script_setup_true_lang.js";
import { N as NotificationToasts } from "./options-notificationtoasts.js";
import { E as EditEmojiModal } from "./options-editemojimodal.js";
import { _ as _sfc_main$7 } from "./options-editgroupmodal_vue_vue_type_script_setup_true_lang.js";
import { u as useOptions } from "./options-useoptions.js";
const _sfc_main$2 = /* @__PURE__ */ defineComponent({
  __name: "GridColumnsSelector",
  props: {
    modelValue: {},
    min: {},
    max: {},
    step: {}
  },
  emits: ["update:modelValue"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const options = computed(() => {
      const min = Number(props.min ?? 2);
      const max = Number(props.max ?? 8);
      const step = Number(props.step ?? 1);
      const arr = [];
      for (let i = min; i <= max; i += step) arr.push(i);
      return arr;
    });
    const onMenuClick = (key) => {
      emit("update:modelValue", Number(key));
    };
    return (_ctx, _cache) => {
      return openBlock(), createBlock(unref(Dropdown), null, {
        overlay: withCtx(() => [
          createVNode(unref(Menu), {
            onClick: _cache[0] || (_cache[0] = (info) => onMenuClick(String(info.key)))
          }, {
            default: withCtx(() => [
              (openBlock(true), createElementBlock(Fragment, null, renderList(options.value, (col) => {
                return openBlock(), createBlock(unref(Menu).Item, {
                  key: col,
                  value: col
                }, {
                  default: withCtx(() => [
                    createTextVNode(toDisplayString(col) + " 列", 1)
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
              createTextVNode(toDisplayString(_ctx.modelValue) + " 列 ", 1),
              createVNode(unref(DownOutlined))
            ]),
            _: 1
          })
        ]),
        _: 1
      });
    };
  }
});
const GridColumnsSelector = /* @__PURE__ */ _export_sfc(_sfc_main$2, [["__scopeId", "data-v-d7e47b6f"]]);
const _hoisted_1$1 = { class: "space-y-8" };
const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "AboutSection",
  setup(__props) {
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1$1, _cache[0] || (_cache[0] = [
        createStaticVNode('<div class="bg-white rounded-lg shadow-sm border" data-v-4815cf43><div class="px-6 py-4 border-b border-gray-200" data-v-4815cf43><h2 class="text-lg font-semibold text-gray-900" data-v-4815cf43>关于扩展</h2></div><div class="p-6 space-y-4" data-v-4815cf43><div data-v-4815cf43><h3 class="font-medium text-gray-900" data-v-4815cf43>表情包扩展</h3><p class="text-sm text-gray-600" data-v-4815cf43>版本 1.0.0</p></div><div data-v-4815cf43><h3 class="font-medium text-gray-900" data-v-4815cf43>功能特色</h3><ul class="text-sm text-gray-600 space-y-1 mt-2" data-v-4815cf43><li data-v-4815cf43>• 支持多分组表情管理</li><li data-v-4815cf43>• 拖拽排序和重新组织</li><li data-v-4815cf43>• Chrome 同步支持</li><li data-v-4815cf43>• 响应式设计，触屏优化</li><li data-v-4815cf43>• 实时搜索和过滤</li></ul></div></div></div>', 1)
      ]));
    };
  }
});
const AboutSection = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__scopeId", "data-v-4815cf43"]]);
const _hoisted_1 = { class: "min-h-screen bg-gray-50" };
const _hoisted_2 = { class: "bg-white shadow-sm border-b" };
const _hoisted_3 = { class: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" };
const _hoisted_4 = { class: "flex justify-between items-center py-6" };
const _hoisted_5 = { class: "bg-white border-b border-gray-200" };
const _hoisted_6 = { class: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" };
const _hoisted_7 = { class: "flex space-x-8" };
const _hoisted_8 = ["onClick", "onPointerenter", "onFocus"];
const _hoisted_9 = { class: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" };
const _hoisted_10 = {
  key: 0,
  class: "space-y-8"
};
const _hoisted_11 = {
  key: 1,
  class: "space-y-8"
};
const _hoisted_12 = {
  key: 2,
  class: "space-y-8"
};
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "Options",
  setup(__props) {
    const EmojiStats = defineAsyncComponent(() => __vitePreload(() => import("./options-emojistats.js"), true ? __vite__mapDeps([0,1,2]) : void 0));
    const GroupsTab = defineAsyncComponent(() => __vitePreload(() => import("./options-groupstab.js"), true ? __vite__mapDeps([3,4,2,5,6,7,8,9,10,11,12,13,14]) : void 0));
    const FavoritesTab = defineAsyncComponent(() => __vitePreload(() => import("./options-favoritestab.js"), true ? __vite__mapDeps([15,16,2,9,10,11,17]) : void 0));
    const UngroupedTab = defineAsyncComponent(() => __vitePreload(() => import("./options-ungroupedtab.js"), true ? __vite__mapDeps([18,19,2,20,9,10,11,21]) : void 0));
    const ExternalImportTab = defineAsyncComponent(() => __vitePreload(() => import("./options-externalimporttab.js"), true ? __vite__mapDeps([22,23,2,24]) : void 0));
    const BilibiliImport = defineAsyncComponent(() => __vitePreload(() => import("./options-bilibiliimport.js"), true ? __vite__mapDeps([25,26,2,24]) : void 0));
    const options = useOptions();
    const prefetchMap = {
      groups: () => __vitePreload(() => import("./options-groupstab.js"), true ? __vite__mapDeps([3,4,2,5,6,7,8,9,10,11,12,13,14]) : void 0),
      favorites: () => __vitePreload(() => import("./options-favoritestab.js"), true ? __vite__mapDeps([15,16,2,9,10,11,17]) : void 0),
      ungrouped: () => __vitePreload(() => import("./options-ungroupedtab.js"), true ? __vite__mapDeps([18,19,2,20,9,10,11,21]) : void 0),
      import: () => __vitePreload(() => import("./options-externalimporttab.js"), true ? __vite__mapDeps([22,23,2,24]) : void 0),
      bilibili: () => __vitePreload(() => import("./options-bilibiliimport.js"), true ? __vite__mapDeps([25,26,2,24]) : void 0),
      stats: () => __vitePreload(() => import("./options-emojistats.js"), true ? __vite__mapDeps([0,1,2]) : void 0)
    };
    const handlePrefetch = (id) => {
      if (!id) return;
      const loader = prefetchMap[id];
      if (!loader) return;
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        requestIdleCallback(() => {
          void loader();
        });
      } else {
        setTimeout(() => {
          void loader();
        }, 150);
      }
    };
    let pendingConfirmResolver = null;
    const {
      emojiStore,
      isImageUrl,
      activeTab,
      tabs,
      totalEmojis,
      expandedGroups,
      toggleGroupExpansion,
      selectedGroupForAdd,
      showCreateGroupModal,
      showAddEmojiModal,
      showEditGroupModal,
      showImportModal,
      showImportEmojiModal,
      showSuccessToast,
      showErrorToast,
      showConfirmGenericModal,
      confirmGenericTitle,
      confirmGenericMessage,
      executeConfirmGenericAction,
      cancelConfirmGenericAction,
      successMessage,
      errorMessage,
      editingGroupId,
      editGroupName,
      editGroupIcon,
      localGridColumns,
      updateImageScale,
      updateShowSearchBar,
      updateOutputFormat,
      updateForceMobileMode,
      updateEnableLinuxDoInjection,
      updateEnableXcomExtraSelectors,
      handleDragStart,
      handleDrop,
      handleEmojiDragStart,
      handleEmojiDrop,
      removeEmojiFromGroup,
      handleConfigImported,
      handleEmojisImported,
      exportGroup,
      exportGroupZip,
      exportConfiguration,
      exportProgress,
      exportProgressGroupId,
      confirmDeleteGroup,
      openEditGroup,
      openAddEmojiModal,
      onGroupCreated,
      onEmojiAdded,
      resetSettings,
      syncToChrome,
      forceLocalToExtension,
      showSuccess,
      flushBuffer,
      handleImageError,
      openEditEmoji,
      showEditEmojiModal,
      editingEmoji,
      editingEmojiGroupId,
      editingEmojiIndex,
      handleEmojiEdit
    } = options;
    onMounted(() => {
    });
    onBeforeUnmount(() => {
      pendingConfirmResolver = null;
    });
    const onModalConfirm = () => {
      if (pendingConfirmResolver) {
        try {
          pendingConfirmResolver(true);
        } finally {
          pendingConfirmResolver = null;
        }
        showConfirmGenericModal.value = false;
        return;
      }
      executeConfirmGenericAction();
    };
    const onModalCancel = () => {
      if (pendingConfirmResolver) {
        try {
          pendingConfirmResolver(false);
        } finally {
          pendingConfirmResolver = null;
        }
        showConfirmGenericModal.value = false;
        return;
      }
      cancelConfirmGenericAction();
    };
    const handleSaveGroup = (payload) => {
      if (payload && payload.id) {
        emojiStore.updateGroup(payload.id, {
          name: payload.name,
          icon: payload.icon
        });
        void flushBuffer(true).then(() => {
        });
        showSuccess("分组已更新");
      }
    };
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createBaseVNode("header", _hoisted_2, [
          createBaseVNode("div", _hoisted_3, [
            createBaseVNode("div", _hoisted_4, [
              _cache[14] || (_cache[14] = createBaseVNode("div", null, [
                createBaseVNode("h1", { class: "text-2xl font-bold text-gray-900" }, "表情管理"),
                createBaseVNode("p", { class: "text-sm text-gray-600" }, "管理表情包分组、自定义表情和扩展设置")
              ], -1)),
              createVNode(_sfc_main$3, {
                onOpenImport: _cache[0] || (_cache[0] = ($event) => showImportModal.value = true),
                onOpenImportEmojis: _cache[1] || (_cache[1] = ($event) => showImportEmojiModal.value = true),
                onResetSettings: unref(resetSettings),
                onSyncToChrome: unref(syncToChrome),
                onForceLocalToExtension: unref(forceLocalToExtension),
                onExportConfiguration: unref(exportConfiguration)
              }, null, 8, ["onResetSettings", "onSyncToChrome", "onForceLocalToExtension", "onExportConfiguration"])
            ])
          ])
        ]),
        createBaseVNode("nav", _hoisted_5, [
          createBaseVNode("div", _hoisted_6, [
            createBaseVNode("div", _hoisted_7, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(unref(tabs), (tab) => {
                return openBlock(), createElementBlock("button", {
                  key: tab.id,
                  onClick: ($event) => activeTab.value = tab.id,
                  onPointerenter: withModifiers(($event) => handlePrefetch(tab.id), ["prevent"]),
                  onFocus: ($event) => handlePrefetch(tab.id),
                  class: normalizeClass(["py-4 px-1 border-b-2 font-medium text-sm transition-colors", [
                    unref(activeTab) === tab.id ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  ]])
                }, toDisplayString(tab.label), 43, _hoisted_8);
              }), 128))
            ])
          ])
        ]),
        createBaseVNode("main", _hoisted_9, [
          unref(activeTab) === "settings" ? (openBlock(), createElementBlock("div", _hoisted_10, [
            createVNode(_sfc_main$4, {
              settings: unref(emojiStore).settings,
              "onUpdate:imageScale": unref(updateImageScale),
              "onUpdate:showSearchBar": unref(updateShowSearchBar),
              "onUpdate:outputFormat": unref(updateOutputFormat),
              "onUpdate:forceMobileMode": unref(updateForceMobileMode),
              "onUpdate:enableLinuxDoInjection": unref(updateEnableLinuxDoInjection),
              "onUpdate:enableXcomExtraSelectors": unref(updateEnableXcomExtraSelectors)
            }, {
              "grid-selector": withCtx(() => [
                createVNode(GridColumnsSelector, {
                  modelValue: unref(localGridColumns),
                  "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => isRef(localGridColumns) ? localGridColumns.value = $event : null),
                  min: 2,
                  max: 8,
                  step: 1
                }, null, 8, ["modelValue"])
              ]),
              _: 1
            }, 8, ["settings", "onUpdate:imageScale", "onUpdate:showSearchBar", "onUpdate:outputFormat", "onUpdate:forceMobileMode", "onUpdate:enableLinuxDoInjection", "onUpdate:enableXcomExtraSelectors"])
          ])) : createCommentVNode("", true),
          (openBlock(), createBlock(Suspense, null, {
            fallback: withCtx(() => _cache[15] || (_cache[15] = [
              createBaseVNode("div", { class: "py-8 text-center text-gray-500" }, "正在加载分组…", -1)
            ])),
            default: withCtx(() => [
              unref(activeTab) === "groups" || unref(activeTab) === "groups-card" ? (openBlock(), createBlock(unref(GroupsTab), {
                key: 0,
                emojiStore: unref(emojiStore),
                expandedGroups: unref(expandedGroups),
                isImageUrl: unref(isImageUrl),
                activeTab: unref(activeTab),
                "onUpdate:activeTab": _cache[3] || (_cache[3] = ($event) => isRef(activeTab) ? activeTab.value = $event : null),
                exportProgress: unref(exportProgress),
                exportProgressGroupId: unref(exportProgressGroupId),
                onOpenCreateGroup: _cache[4] || (_cache[4] = ($event) => showCreateGroupModal.value = true),
                onGroupDragStart: unref(handleDragStart),
                onGroupDrop: unref(handleDrop),
                onToggleExpand: unref(toggleGroupExpansion),
                onOpenEditGroup: unref(openEditGroup),
                onExportGroup: unref(exportGroup),
                onExportGroupZip: unref(exportGroupZip),
                onConfirmDeleteGroup: unref(confirmDeleteGroup),
                onOpenAddEmoji: unref(openAddEmojiModal),
                onEmojiDragStart: unref(handleEmojiDragStart),
                onEmojiDrop: unref(handleEmojiDrop),
                onRemoveEmoji: unref(removeEmojiFromGroup),
                onEditEmoji: unref(openEditEmoji),
                onImageError: unref(handleImageError)
              }, null, 8, ["emojiStore", "expandedGroups", "isImageUrl", "activeTab", "exportProgress", "exportProgressGroupId", "onGroupDragStart", "onGroupDrop", "onToggleExpand", "onOpenEditGroup", "onExportGroup", "onExportGroupZip", "onConfirmDeleteGroup", "onOpenAddEmoji", "onEmojiDragStart", "onEmojiDrop", "onRemoveEmoji", "onEditEmoji", "onImageError"])) : createCommentVNode("", true)
            ]),
            _: 1
          })),
          (openBlock(), createBlock(Suspense, null, {
            fallback: withCtx(() => _cache[16] || (_cache[16] = [
              createBaseVNode("div", { class: "py-8 text-center text-gray-500" }, "正在加载常用…", -1)
            ])),
            default: withCtx(() => [
              unref(activeTab) === "favorites" ? (openBlock(), createBlock(unref(FavoritesTab), {
                key: 0,
                emojiStore: unref(emojiStore),
                onRemove: unref(removeEmojiFromGroup),
                onEdit: unref(openEditEmoji)
              }, null, 8, ["emojiStore", "onRemove", "onEdit"])) : createCommentVNode("", true)
            ]),
            _: 1
          })),
          (openBlock(), createBlock(Suspense, null, {
            fallback: withCtx(() => _cache[17] || (_cache[17] = [
              createBaseVNode("div", { class: "py-8 text-center text-gray-500" }, "正在加载未分组…", -1)
            ])),
            default: withCtx(() => [
              unref(activeTab) === "ungrouped" ? (openBlock(), createBlock(unref(UngroupedTab), {
                key: 0,
                emojiStore: unref(emojiStore),
                onRemove: unref(removeEmojiFromGroup),
                onEdit: unref(openEditEmoji)
              }, null, 8, ["emojiStore", "onRemove", "onEdit"])) : createCommentVNode("", true)
            ]),
            _: 1
          })),
          (openBlock(), createBlock(Suspense, null, {
            fallback: withCtx(() => _cache[18] || (_cache[18] = [
              createBaseVNode("div", { class: "py-8 text-center text-gray-500" }, "正在加载导入…", -1)
            ])),
            default: withCtx(() => [
              unref(activeTab) === "import" ? (openBlock(), createBlock(unref(ExternalImportTab), { key: 0 })) : createCommentVNode("", true)
            ]),
            _: 1
          })),
          (openBlock(), createBlock(Suspense, null, {
            fallback: withCtx(() => _cache[19] || (_cache[19] = [
              createBaseVNode("div", { class: "py-8 text-center text-gray-500" }, "正在加载 Bilibili 导入…", -1)
            ])),
            default: withCtx(() => [
              unref(activeTab) === "bilibili" ? (openBlock(), createBlock(unref(BilibiliImport), { key: 0 })) : createCommentVNode("", true)
            ]),
            _: 1
          })),
          unref(activeTab) === "stats" ? (openBlock(), createElementBlock("div", _hoisted_11, [
            (openBlock(), createBlock(Suspense, null, {
              fallback: withCtx(() => _cache[20] || (_cache[20] = [
                createBaseVNode("div", { class: "py-8 text-center text-gray-500" }, "正在加载统计…", -1)
              ])),
              default: withCtx(() => [
                createVNode(unref(EmojiStats), {
                  groupCount: unref(emojiStore).groups.length,
                  totalEmojis: unref(totalEmojis),
                  favoritesCount: unref(emojiStore).favorites.size
                }, null, 8, ["groupCount", "totalEmojis", "favoritesCount"])
              ]),
              _: 1
            }))
          ])) : createCommentVNode("", true),
          unref(activeTab) === "about" ? (openBlock(), createElementBlock("div", _hoisted_12, [
            createVNode(AboutSection)
          ])) : createCommentVNode("", true)
        ]),
        createVNode(_sfc_main$5, {
          show: unref(showCreateGroupModal),
          "onUpdate:show": _cache[5] || (_cache[5] = ($event) => isRef(showCreateGroupModal) ? showCreateGroupModal.value = $event : null),
          onCreated: unref(onGroupCreated)
        }, null, 8, ["show", "onCreated"]),
        createVNode(_sfc_main$6, {
          show: unref(showAddEmojiModal),
          "onUpdate:show": _cache[6] || (_cache[6] = ($event) => isRef(showAddEmojiModal) ? showAddEmojiModal.value = $event : null),
          groups: unref(emojiStore).groups,
          defaultGroupId: unref(selectedGroupForAdd),
          onAdded: unref(onEmojiAdded)
        }, null, 8, ["show", "groups", "defaultGroupId", "onAdded"]),
        createVNode(_sfc_main$7, {
          show: unref(showEditGroupModal),
          "onUpdate:show": _cache[7] || (_cache[7] = ($event) => isRef(showEditGroupModal) ? showEditGroupModal.value = $event : null),
          editingGroupId: unref(editingGroupId),
          initialName: unref(editGroupName),
          initialIcon: unref(editGroupIcon),
          isImageUrl: unref(isImageUrl),
          onSave: handleSaveGroup,
          onImageError: unref(handleImageError)
        }, null, 8, ["show", "editingGroupId", "initialName", "initialIcon", "isImageUrl", "onImageError"]),
        createVNode(_sfc_main$8, {
          modelValue: unref(showImportModal),
          "onUpdate:modelValue": _cache[8] || (_cache[8] = ($event) => isRef(showImportModal) ? showImportModal.value = $event : null),
          onImported: unref(handleConfigImported)
        }, null, 8, ["modelValue", "onImported"]),
        createVNode(_sfc_main$9, {
          modelValue: unref(showImportEmojiModal),
          "onUpdate:modelValue": _cache[9] || (_cache[9] = ($event) => isRef(showImportEmojiModal) ? showImportEmojiModal.value = $event : null),
          onImported: unref(handleEmojisImported)
        }, null, 8, ["modelValue", "onImported"]),
        createVNode(EditEmojiModal, {
          show: unref(showEditEmojiModal),
          "onUpdate:show": _cache[10] || (_cache[10] = ($event) => isRef(showEditEmojiModal) ? showEditEmojiModal.value = $event : null),
          emoji: unref(editingEmoji) || void 0,
          groupId: unref(editingEmojiGroupId),
          index: unref(editingEmojiIndex),
          onSave: unref(handleEmojiEdit),
          onImageError: unref(handleImageError)
        }, null, 8, ["show", "emoji", "groupId", "index", "onSave", "onImageError"]),
        createVNode(NotificationToasts, {
          showSuccess: unref(showSuccessToast),
          "onUpdate:showSuccess": _cache[11] || (_cache[11] = ($event) => isRef(showSuccessToast) ? showSuccessToast.value = $event : null),
          successMessage: unref(successMessage),
          showError: unref(showErrorToast),
          "onUpdate:showError": _cache[12] || (_cache[12] = ($event) => isRef(showErrorToast) ? showErrorToast.value = $event : null),
          errorMessage: unref(errorMessage)
        }, null, 8, ["showSuccess", "successMessage", "showError", "errorMessage"]),
        createVNode(_sfc_main$a, {
          show: unref(showConfirmGenericModal),
          "onUpdate:show": _cache[13] || (_cache[13] = ($event) => isRef(showConfirmGenericModal) ? showConfirmGenericModal.value = $event : null),
          title: unref(confirmGenericTitle),
          message: unref(confirmGenericMessage),
          onConfirm: onModalConfirm,
          onCancel: onModalCancel
        }, null, 8, ["show", "title", "message"])
      ]);
    };
  }
});
export {
  _sfc_main as _
};
