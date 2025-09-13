import { d as defineComponent, l as useEmojiStore, r as ref, c as computed, a as createElementBlock, o as openBlock, b as createBaseVNode, e as createCommentVNode, f as createVNode, t as toDisplayString, w as withCtx, u as unref, B as Button, g as createTextVNode, G as DownOutlined, M as Menu, F as Fragment, i as renderList, j as createBlock, E as Dropdown, h as withDirectives, v as vModelCheckbox, x as normalizeStyle, n as normalizeClass, m as vModelText, Y as withKeys } from "./options-addemojimodal_vue_vue_type_script_setup_true_lang.js";
import { e as emojiPreviewUploader } from "./options-editemojimodal_vue_vue_type_script_setup_true_lang.js";
const _hoisted_1 = { class: "space-y-8" };
const _hoisted_2 = { class: "bg-white rounded-lg shadow-sm border" };
const _hoisted_3 = { class: "px-6 py-4 border-b border-gray-200" };
const _hoisted_4 = { class: "flex justify-between items-center" };
const _hoisted_5 = { class: "flex items-center gap-4" };
const _hoisted_6 = {
  key: 0,
  class: "flex items-center gap-2"
};
const _hoisted_7 = { class: "text-sm text-gray-600" };
const _hoisted_8 = ["disabled"];
const _hoisted_9 = { class: "flex items-center gap-2 cursor-pointer" };
const _hoisted_10 = { class: "px-6 py-3 border-b border-gray-100 flex items-center justify-end gap-2" };
const _hoisted_11 = { class: "p-6" };
const _hoisted_12 = ["onClick"];
const _hoisted_13 = ["src", "alt"];
const _hoisted_14 = {
  key: 0,
  class: "absolute bottom-1 right-1"
};
const _hoisted_15 = ["checked", "onChange"];
const _hoisted_16 = {
  key: 1,
  class: "absolute top-1 right-1 flex gap-1"
};
const _hoisted_17 = ["onClick"];
const _hoisted_18 = ["onClick"];
const _hoisted_19 = { class: "text-xs text-center text-gray-600 mt-1 truncate" };
const _hoisted_20 = {
  key: 1,
  class: "text-sm text-gray-500"
};
const _hoisted_21 = {
  key: 0,
  class: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
};
const _hoisted_22 = { class: "bg-white rounded-lg p-6 w-96" };
const _hoisted_23 = { class: "space-y-4" };
const _hoisted_24 = { class: "flex justify-end gap-2 mt-6" };
const _hoisted_25 = ["disabled"];
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "UngroupedTab",
  emits: ["remove", "edit"],
  setup(__props) {
    const emojiStore = useEmojiStore();
    const isMultiSelectMode = ref(false);
    const selectedEmojis = ref(/* @__PURE__ */ new Set());
    const targetGroupId = ref("");
    const uploadingEmojiIds = ref(/* @__PURE__ */ new Set());
    const onTargetGroupSelect = (info) => {
      targetGroupId.value = String(info.key);
    };
    const showCreateGroupDialog = ref(false);
    const newGroupName = ref("");
    const newGroupIcon = ref("");
    const ungroup = computed(() => emojiStore.groups.find((g) => g.id === "ungrouped"));
    const availableGroups = computed(
      () => emojiStore.groups.filter((g) => g.id !== "ungrouped") || []
    );
    const shouldShowUploadButton = computed(() => {
      return !window.location.href.includes("linux.do");
    });
    const uploadSelectedEmojis = async () => {
      if (selectedEmojis.value.size === 0 || !ungroup.value) return;
      const emojisToUpload = Array.from(selectedEmojis.value).map((index) => ({ emoji: ungroup.value.emojis[index], index })).filter(({ emoji }) => emoji && emoji.url && !emoji.url.includes("linux.do"));
      if (emojisToUpload.length === 0) return;
      emojisToUpload.forEach(({ index }) => uploadingEmojiIds.value.add(index));
      try {
        emojiPreviewUploader.showProgressDialog();
        const uploadPromises = emojisToUpload.map(async ({ emoji, index }) => {
          try {
            const response = await fetch(emoji.url);
            const blob = await response.blob();
            const fileName = `${emoji.name}.${blob.type.split("/")[1] || "png"}`;
            const file = new File([blob], fileName, { type: blob.type });
            const resp = await emojiPreviewUploader.uploadEmojiImage(file, emoji.name || "emoji");
            if (resp && resp.url) {
              emojiStore.updateEmojiInGroup("ungrouped", index, { url: resp.url });
            }
            return resp;
          } catch (error) {
            console.error("Failed to upload emoji:", emoji.name, error);
            throw error;
          }
        });
        await Promise.allSettled(uploadPromises);
      } finally {
        emojisToUpload.forEach(({ index }) => uploadingEmojiIds.value.delete(index));
      }
    };
    const uploadAllEmojis = async () => {
      if (!ungroup.value || ungroup.value.emojis.length === 0) return;
      const emojisToUpload = ungroup.value.emojis.map((emoji, index) => ({ emoji, index })).filter(({ emoji }) => emoji && emoji.url && !emoji.url.includes("linux.do"));
      if (emojisToUpload.length === 0) return;
      emojisToUpload.forEach(({ index }) => uploadingEmojiIds.value.add(index));
      try {
        emojiPreviewUploader.showProgressDialog();
        const uploadPromises = emojisToUpload.map(async ({ emoji, index }) => {
          try {
            const response = await fetch(emoji.url);
            const blob = await response.blob();
            const fileName = `${emoji.name}.${blob.type.split("/")[1] || "png"}`;
            const file = new File([blob], fileName, { type: blob.type });
            const resp = await emojiPreviewUploader.uploadEmojiImage(file, emoji.name || "emoji");
            if (resp && resp.url) {
              emojiStore.updateEmojiInGroup("ungrouped", index, { url: resp.url });
            }
            return resp;
          } catch (error) {
            console.error("Failed to upload emoji:", emoji.name, error);
            throw error;
          }
        });
        await Promise.allSettled(uploadPromises);
      } finally {
        emojisToUpload.forEach(({ index }) => uploadingEmojiIds.value.delete(index));
      }
    };
    const onMultiSelectModeChange = () => {
      if (!isMultiSelectMode.value) {
        clearSelection();
      }
    };
    const toggleEmojiSelection = (idx) => {
      if (selectedEmojis.value.has(idx)) {
        selectedEmojis.value.delete(idx);
      } else {
        selectedEmojis.value.add(idx);
      }
      selectedEmojis.value = new Set(selectedEmojis.value);
    };
    const handleEmojiClick = (idx) => {
      if (isMultiSelectMode.value) toggleEmojiSelection(idx);
    };
    const clearSelection = () => {
      selectedEmojis.value.clear();
      selectedEmojis.value = /* @__PURE__ */ new Set();
      targetGroupId.value = "";
    };
    const moveSelectedEmojis = async () => {
      if (!targetGroupId.value || selectedEmojis.value.size === 0) return;
      try {
        if (targetGroupId.value === "__create_new__") {
          showCreateGroupDialog.value = true;
          return;
        }
        const targetGroup = emojiStore.groups.find((g) => g.id === targetGroupId.value);
        if (!targetGroup) return;
        const sortedIndices = Array.from(selectedEmojis.value).sort((a, b) => b - a);
        emojiStore.beginBatch();
        try {
          for (const index of sortedIndices) {
            if (ungroup.value && index < ungroup.value.emojis.length) {
              emojiStore.moveEmoji(
                "ungrouped",
                index,
                targetGroupId.value,
                -1
                // -1表示添加到目标分组的末尾
              );
            }
          }
        } finally {
          await emojiStore.endBatch();
        }
        clearSelection();
      } catch {
      }
    };
    const confirmCreateGroup = async () => {
      if (!newGroupName.value.trim()) return;
      try {
        const newGroup = emojiStore.createGroup(newGroupName.value.trim(), newGroupIcon.value || "📁");
        targetGroupId.value = newGroup.id;
        showCreateGroupDialog.value = false;
        newGroupName.value = "";
        newGroupIcon.value = "";
        await moveSelectedEmojis();
      } catch {
      }
    };
    const cancelCreateGroup = () => {
      showCreateGroupDialog.value = false;
      newGroupName.value = "";
      newGroupIcon.value = "";
      targetGroupId.value = "";
    };
    return (_ctx, _cache) => {
      var _a, _b;
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createBaseVNode("div", _hoisted_2, [
          createBaseVNode("div", _hoisted_3, [
            createBaseVNode("div", _hoisted_4, [
              _cache[6] || (_cache[6] = createBaseVNode("h2", { class: "text-lg font-semibold text-gray-900" }, "未分组表情", -1)),
              createBaseVNode("div", _hoisted_5, [
                isMultiSelectMode.value && selectedEmojis.value.size > 0 ? (openBlock(), createElementBlock("div", _hoisted_6, [
                  createBaseVNode("span", _hoisted_7, "已选择 " + toDisplayString(selectedEmojis.value.size) + " 个", 1),
                  createVNode(unref(Dropdown), null, {
                    overlay: withCtx(() => [
                      createVNode(unref(Menu), { onClick: onTargetGroupSelect }, {
                        default: withCtx(() => [
                          createVNode(unref(Menu).Item, { key: "" }, {
                            default: withCtx(() => _cache[3] || (_cache[3] = [
                              createTextVNode("选择目标分组", -1)
                            ])),
                            _: 1,
                            __: [3]
                          }),
                          (openBlock(true), createElementBlock(Fragment, null, renderList(availableGroups.value, (group) => {
                            return openBlock(), createBlock(unref(Menu).Item, {
                              key: group.id,
                              value: group.id
                            }, {
                              default: withCtx(() => [
                                createTextVNode(toDisplayString(group.name), 1)
                              ]),
                              _: 2
                            }, 1032, ["value"]);
                          }), 128)),
                          createVNode(unref(Menu).Item, { key: "__create_new__" }, {
                            default: withCtx(() => _cache[4] || (_cache[4] = [
                              createTextVNode("+ 创建新分组", -1)
                            ])),
                            _: 1,
                            __: [4]
                          })
                        ]),
                        _: 1
                      })
                    ]),
                    default: withCtx(() => [
                      createVNode(unref(Button), null, {
                        default: withCtx(() => [
                          createTextVNode(toDisplayString(targetGroupId.value || "选择目标分组") + " ", 1),
                          createVNode(unref(DownOutlined))
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  }),
                  createBaseVNode("button", {
                    onClick: moveSelectedEmojis,
                    disabled: !targetGroupId.value,
                    class: "text-sm px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  }, " 移动 ", 8, _hoisted_8),
                  createBaseVNode("button", {
                    onClick: clearSelection,
                    class: "text-sm px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                  }, " 清空选择 ")
                ])) : createCommentVNode("", true),
                createBaseVNode("label", _hoisted_9, [
                  withDirectives(createBaseVNode("input", {
                    type: "checkbox",
                    "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => isMultiSelectMode.value = $event),
                    onChange: onMultiSelectModeChange,
                    class: "rounded"
                  }, null, 544), [
                    [vModelCheckbox, isMultiSelectMode.value]
                  ]),
                  _cache[5] || (_cache[5] = createBaseVNode("span", { class: "text-sm text-gray-700" }, "多选模式", -1))
                ])
              ])
            ])
          ]),
          createBaseVNode("div", _hoisted_10, [
            shouldShowUploadButton.value && ungroup.value && ((_a = ungroup.value.emojis) == null ? void 0 : _a.length) > 0 ? (openBlock(), createElementBlock("button", {
              key: 0,
              onClick: uploadAllEmojis,
              class: "text-sm px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-2",
              title: "上传所有未分组表情到 linux.do"
            }, " 📤 上传全部 ")) : createCommentVNode("", true),
            shouldShowUploadButton.value && isMultiSelectMode.value && selectedEmojis.value.size > 0 ? (openBlock(), createElementBlock("button", {
              key: 1,
              onClick: uploadSelectedEmojis,
              class: "text-sm px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2",
              title: "上传选中的表情到 linux.do"
            }, " 📤 上传选中 (" + toDisplayString(selectedEmojis.value.size) + ") ", 1)) : createCommentVNode("", true)
          ]),
          createBaseVNode("div", _hoisted_11, [
            ungroup.value && ((_b = ungroup.value.emojis) == null ? void 0 : _b.length) ? (openBlock(), createElementBlock("div", {
              key: 0,
              class: "grid gap-3",
              style: normalizeStyle({
                gridTemplateColumns: `repeat(${unref(emojiStore).settings.gridColumns}, minmax(0, 1fr))`
              })
            }, [
              (openBlock(true), createElementBlock(Fragment, null, renderList(ungroup.value.emojis, (emoji, idx) => {
                return openBlock(), createElementBlock("div", {
                  key: `ung-${emoji.id || idx}`,
                  class: "emoji-item relative"
                }, [
                  createBaseVNode("div", {
                    class: normalizeClass(["aspect-square bg-gray-50 rounded-lg overflow-hidden", {
                      "cursor-pointer": isMultiSelectMode.value,
                      "ring-2 ring-blue-500": isMultiSelectMode.value && selectedEmojis.value.has(idx)
                    }]),
                    onClick: ($event) => handleEmojiClick(idx)
                  }, [
                    createBaseVNode("img", {
                      src: emoji.url,
                      alt: emoji.name,
                      class: "w-full h-full object-cover"
                    }, null, 8, _hoisted_13)
                  ], 10, _hoisted_12),
                  isMultiSelectMode.value ? (openBlock(), createElementBlock("div", _hoisted_14, [
                    createBaseVNode("input", {
                      type: "checkbox",
                      checked: selectedEmojis.value.has(idx),
                      onChange: ($event) => toggleEmojiSelection(idx),
                      class: "w-4 h-4 text-blue-600 bg-white border-2 border-gray-300 rounded focus:ring-blue-500"
                    }, null, 40, _hoisted_15)
                  ])) : createCommentVNode("", true),
                  !isMultiSelectMode.value ? (openBlock(), createElementBlock("div", _hoisted_16, [
                    createBaseVNode("button", {
                      onClick: ($event) => _ctx.$emit("edit", emoji, ungroup.value.id, idx),
                      title: "编辑",
                      class: "text-xs px-1 py-0.5 bg-white bg-opacity-80 rounded"
                    }, " 编辑 ", 8, _hoisted_17),
                    createBaseVNode("button", {
                      onClick: ($event) => _ctx.$emit("remove", ungroup.value.id, idx),
                      title: "移除",
                      class: "text-xs px-1 py-0.5 bg-white bg-opacity-80 rounded"
                    }, " 移除 ", 8, _hoisted_18)
                  ])) : createCommentVNode("", true),
                  createBaseVNode("div", _hoisted_19, toDisplayString(emoji.name), 1)
                ]);
              }), 128))
            ], 4)) : (openBlock(), createElementBlock("div", _hoisted_20, "未分组表情为空。"))
          ])
        ]),
        showCreateGroupDialog.value ? (openBlock(), createElementBlock("div", _hoisted_21, [
          createBaseVNode("div", _hoisted_22, [
            _cache[9] || (_cache[9] = createBaseVNode("h3", { class: "text-lg font-semibold mb-4" }, "创建新分组", -1)),
            createBaseVNode("div", _hoisted_23, [
              createBaseVNode("div", null, [
                _cache[7] || (_cache[7] = createBaseVNode("label", { class: "block text-sm font-medium text-gray-700 mb-1" }, "分组名称", -1)),
                withDirectives(createBaseVNode("input", {
                  "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => newGroupName.value = $event),
                  type: "text",
                  class: "w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500",
                  placeholder: "输入分组名称",
                  onKeyup: withKeys(confirmCreateGroup, ["enter"])
                }, null, 544), [
                  [vModelText, newGroupName.value]
                ])
              ]),
              createBaseVNode("div", null, [
                _cache[8] || (_cache[8] = createBaseVNode("label", { class: "block text-sm font-medium text-gray-700 mb-1" }, "分组图标", -1)),
                withDirectives(createBaseVNode("input", {
                  "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => newGroupIcon.value = $event),
                  type: "text",
                  class: "w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500",
                  placeholder: "输入图标 URL 或 emoji"
                }, null, 512), [
                  [vModelText, newGroupIcon.value]
                ])
              ])
            ]),
            createBaseVNode("div", _hoisted_24, [
              createBaseVNode("button", {
                onClick: cancelCreateGroup,
                class: "px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              }, " 取消 "),
              createBaseVNode("button", {
                onClick: confirmCreateGroup,
                disabled: !newGroupName.value.trim(),
                class: "px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              }, " 创建 ", 8, _hoisted_25)
            ])
          ])
        ])) : createCommentVNode("", true)
      ]);
    };
  }
});
export {
  _sfc_main as _
};
