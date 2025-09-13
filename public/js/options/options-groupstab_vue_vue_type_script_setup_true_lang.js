var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { d as defineComponent, l as useEmojiStore, c as computed, r as ref, N as onMounted, O as onUnmounted, a as createElementBlock, o as openBlock, e as createCommentVNode, f as createVNode, b as createBaseVNode, n as normalizeClass, F as Fragment, i as renderList, k as withModifiers, u as unref, q as normalizeImageUrl, g as createTextVNode, t as toDisplayString, P as __unplugin_components_0, x as normalizeStyle } from "./options-addemojimodal_vue_vue_type_script_setup_true_lang.js";
import { G as GroupsCardView } from "./options-groupscardview.js";
import { G as GroupActionsDropdown } from "./options-groupactionsdropdown.js";
import { D as DedupeChooser } from "./options-dedupechooser.js";
class TouchDragHandler {
  constructor(options) {
    __publicField(this, "state", {
      isDragging: false,
      dragElement: null,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      dragPreview: null
    });
    __publicField(this, "onDragStart");
    __publicField(this, "onDragMove");
    __publicField(this, "onDragEnd");
    // Optional callback to decide whether a touchstart should begin a drag
    __publicField(this, "shouldStartDrag");
    // bound handlers so we can remove listeners added to document
    __publicField(this, "boundTouchMove", null);
    __publicField(this, "boundTouchEnd", null);
    __publicField(this, "boundTouchCancel", null);
    this.onDragStart = options.onDragStart;
    this.onDragMove = options.onDragMove;
    this.onDragEnd = options.onDragEnd;
    this.shouldStartDrag = options.shouldStartDrag;
  }
  addTouchEvents(element, isDraggable = true) {
    if (!isDraggable) return;
    element.addEventListener("touchstart", this.handleTouchStart.bind(this), { passive: false });
  }
  handleTouchStart(e) {
    const target = e.currentTarget;
    if (this.shouldStartDrag && !this.shouldStartDrag(e, target)) {
      return;
    }
    e.preventDefault();
    const touch = e.touches[0];
    this.state.isDragging = true;
    this.state.dragElement = target;
    this.state.startX = touch.clientX;
    this.state.startY = touch.clientY;
    this.state.currentX = touch.clientX;
    this.state.currentY = touch.clientY;
    this.cleanupDragPreview();
    this.createDragPreview(target);
    if (this.onDragStart) {
      this.onDragStart(target);
    }
    this.boundTouchMove = this.handleTouchMove.bind(this);
    this.boundTouchEnd = this.handleTouchEnd.bind(this);
    this.boundTouchCancel = this.handleTouchCancel.bind(this);
    document.addEventListener("touchmove", this.boundTouchMove, { passive: false });
    document.addEventListener("touchend", this.boundTouchEnd, { passive: false });
    document.addEventListener("touchcancel", this.boundTouchCancel, { passive: false });
  }
  handleTouchMove(e) {
    if (!this.state.isDragging || !this.state.dragElement) return;
    e.preventDefault();
    const touch = e.touches[0];
    this.state.currentX = touch.clientX;
    this.state.currentY = touch.clientY;
    if (this.state.dragPreview) {
      this.state.dragPreview.style.left = `${this.state.currentX - 50}px`;
      this.state.dragPreview.style.top = `${this.state.currentY - 50}px`;
    }
    if (this.onDragMove) {
      this.onDragMove(this.state.dragElement, this.state.currentX, this.state.currentY);
    }
  }
  handleTouchEnd(e) {
    if (!this.state.isDragging || !this.state.dragElement) return;
    e.preventDefault();
    const dropTarget = this.findDropTarget(this.state.currentX, this.state.currentY);
    if (this.onDragEnd) {
      this.onDragEnd(this.state.dragElement, dropTarget);
    }
    this.cleanupDragPreview();
    this.removeDocumentListeners();
    this.resetState();
  }
  handleTouchCancel(e) {
    if (!this.state.isDragging) return;
    e.preventDefault();
    this.cleanupDragPreview();
    this.removeDocumentListeners();
    this.resetState();
  }
  removeDocumentListeners() {
    if (this.boundTouchMove) {
      document.removeEventListener("touchmove", this.boundTouchMove);
      this.boundTouchMove = null;
    }
    if (this.boundTouchEnd) {
      document.removeEventListener("touchend", this.boundTouchEnd);
      this.boundTouchEnd = null;
    }
    if (this.boundTouchCancel) {
      document.removeEventListener("touchcancel", this.boundTouchCancel);
      this.boundTouchCancel = null;
    }
  }
  createDragPreview(element) {
    const preview = element.cloneNode(true);
    preview.style.position = "fixed";
    preview.style.pointerEvents = "none";
    preview.style.zIndex = "9999";
    preview.style.opacity = "0.8";
    preview.style.transform = "scale(0.8)";
    preview.style.left = `${this.state.currentX - 50}px`;
    preview.style.top = `${this.state.currentY - 50}px`;
    preview.classList.add("touch-drag-preview");
    document.body.appendChild(preview);
    this.state.dragPreview = preview;
  }
  cleanupDragPreview() {
    try {
      const previews = Array.from(document.querySelectorAll(".touch-drag-preview"));
      previews.forEach((p) => {
        if (p.parentElement) p.parentElement.removeChild(p);
      });
    } catch (err) {
    }
    this.state.dragPreview = null;
  }
  findDropTarget(x, y) {
    if (this.state.dragPreview) {
      this.state.dragPreview.style.display = "none";
    }
    const elementBelow = document.elementFromPoint(x, y);
    if (this.state.dragPreview) {
      this.state.dragPreview.style.display = "";
    }
    return this.findClosestDropTarget(elementBelow);
  }
  findClosestDropTarget(element) {
    if (!element) return null;
    let current = element;
    while (current && current !== document.body) {
      if (
        // list view group items
        current.classList.contains("group-item") || // card view group items
        current.classList.contains("group-card") || // emoji grid items
        current.classList.contains("emoji-item") || // explicit opt-in attribute
        current.hasAttribute("data-drop-target")
      ) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }
  resetState() {
    this.state = {
      isDragging: false,
      dragElement: null,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      dragPreview: null
    };
  }
  destroy() {
    this.cleanupDragPreview();
    this.removeDocumentListeners();
    this.resetState();
  }
}
const _hoisted_1 = {
  key: 0,
  class: "space-y-8"
};
const _hoisted_2 = { class: "bg-white rounded-lg shadow-sm border" };
const _hoisted_3 = { class: "px-6 py-4 border-b border-gray-200" };
const _hoisted_4 = { class: "flex justify-between items-center" };
const _hoisted_5 = { class: "flex items-center gap-3" };
const _hoisted_6 = { class: "ml-4 inline-flex rounded-md bg-gray-50 p-1" };
const _hoisted_7 = { class: "p-6" };
const _hoisted_8 = { class: "space-y-4" };
const _hoisted_9 = ["draggable", "onDragstart", "onDrop"];
const _hoisted_10 = {
  key: 0,
  class: "flex items-center justify-between p-4"
};
const _hoisted_11 = {
  class: "flex items-center gap-3",
  "data-group-move": ""
};
const _hoisted_12 = {
  key: 0,
  class: "cursor-move text-gray-400"
};
const _hoisted_13 = {
  key: 1,
  class: "w-6 text-yellow-500"
};
const _hoisted_14 = { class: "text-lg" };
const _hoisted_15 = ["src"];
const _hoisted_16 = { class: "font-medium text-gray-900" };
const _hoisted_17 = { class: "text-sm text-gray-500" };
const _hoisted_18 = { class: "flex items-center gap-2" };
const _hoisted_19 = ["onClick"];
const _hoisted_20 = {
  key: 0,
  class: "relative"
};
const _hoisted_21 = {
  key: 1,
  class: "ml-2 text-sm text-green-600"
};
const _hoisted_22 = {
  key: 2,
  class: "ml-2"
};
const _hoisted_23 = {
  key: 3,
  class: "text-sm text-gray-500 px-2"
};
const _hoisted_24 = {
  key: 1,
  class: "px-4 pb-4 border-t border-gray-100"
};
const _hoisted_25 = { class: "mt-4" };
const _hoisted_26 = ["onDragstart", "onDrop"];
const _hoisted_27 = { class: "aspect-square bg-gray-50 rounded-lg overflow-hidden hover:bg-gray-100 transition-colors" };
const _hoisted_28 = ["src", "alt"];
const _hoisted_29 = { class: "text-xs text-center text-gray-600 mt-1 truncate" };
const _hoisted_30 = ["onClick"];
const _hoisted_31 = ["onClick"];
const _hoisted_32 = {
  key: 0,
  class: "mt-4"
};
const _hoisted_33 = ["onClick"];
const _hoisted_34 = {
  key: 1,
  class: "mt-4"
};
const _hoisted_35 = { key: 1 };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "GroupsTab",
  props: {
    expandedGroups: { type: Object, required: true },
    isImageUrl: { type: Function },
    activeTab: { type: String },
    exportProgress: { type: Number, required: false },
    exportProgressGroupId: { type: String, required: false }
  },
  emits: [
    "openCreateGroup",
    "groupDragStart",
    "groupDrop",
    "toggleExpand",
    "openEditGroup",
    "exportGroup",
    "exportGroupZip",
    "confirmDeleteGroup",
    "openAddEmoji",
    "emojiDragStart",
    "emojiDrop",
    "removeEmoji",
    "imageError",
    "editEmoji",
    "changeTab",
    "update:activeTab"
  ],
  setup(__props, { emit: __emit }) {
    const emit = __emit;
    function setTab(tab) {
      emit("changeTab", tab);
      emit("update:activeTab", tab);
    }
    const emojiStore = useEmojiStore();
    const displayGroups = computed(() => {
      return (emojiStore.sortedGroups || []).filter((g) => g.id !== "favorites");
    });
    const groupTouchHandler = ref(null);
    const emojiTouchHandler = ref(null);
    const openMenu = ref(null);
    const dedupeMessage = ref({});
    const showDedupeMessage = (groupId, msg, ms = 2e3) => {
      dedupeMessage.value = { ...dedupeMessage.value, [groupId]: msg };
      setTimeout(() => {
        const copy = { ...dedupeMessage.value };
        delete copy[groupId];
        dedupeMessage.value = copy;
      }, ms);
    };
    const closeMenu = () => {
      openMenu.value = null;
    };
    const onEdit = (group) => {
      closeMenu();
      emit("openEditGroup", group);
    };
    const onExport = (group) => {
      closeMenu();
      emit("exportGroup", group);
    };
    const onExportZip = (group) => {
      closeMenu();
      emit("exportGroupZip", group);
    };
    const onDedupe = (group) => {
      closeMenu();
      chooseDedupeFor.value = group.id;
      computeDedupePreview(group.id);
    };
    const chooseDedupeFor = ref(null);
    const previewDedupeByNameCount = ref(null);
    const previewDedupeByUrlCount = ref(null);
    const computeDedupePreview = (groupId) => {
      previewDedupeByNameCount.value = null;
      previewDedupeByUrlCount.value = null;
      if (!groupId) return;
      try {
        const groups = emojiStore.sortedGroups || [];
        const group = groups.find((g) => g.id === groupId);
        if (!group || !Array.isArray(group.emojis)) return;
        const emojis = group.emojis;
        const nameMap = /* @__PURE__ */ new Map();
        for (const e of emojis) {
          const n = String((e == null ? void 0 : e.name) ?? "");
          const c = nameMap.get(n) || 0;
          nameMap.set(n, c + 1);
        }
        let removedByName = 0;
        for (const v of nameMap.values()) if (v > 1) removedByName += v - 1;
        const urlMap = /* @__PURE__ */ new Map();
        for (const e of emojis) {
          const u = e == null ? void 0 : e.url;
          if (!u) continue;
          const s = String(u);
          const c = urlMap.get(s) || 0;
          urlMap.set(s, c + 1);
        }
        let removedByUrl = 0;
        for (const v of urlMap.values()) if (v > 1) removedByUrl += v - 1;
        previewDedupeByNameCount.value = removedByName;
        previewDedupeByUrlCount.value = removedByUrl;
      } catch (e) {
      }
    };
    const performDedupeChoice = (groupId, mode) => {
      chooseDedupeFor.value = null;
      if (!groupId) return;
      try {
        let removed = 0;
        if (mode === "name") removed = emojiStore.dedupeGroupByName(groupId);
        else removed = emojiStore.dedupeGroup(groupId);
        if (removed > 0) showDedupeMessage(groupId, `已去重 ${removed} 个表情`);
        else showDedupeMessage(groupId, `未发现重复`);
      } catch {
      }
    };
    const onDelete = (group) => {
      closeMenu();
      emit("confirmDeleteGroup", group);
    };
    onMounted(() => {
      groupTouchHandler.value = new TouchDragHandler({
        onDragStart: (element) => {
          const groupData = element.__groupData;
          if (groupData && groupData.id !== "favorites") {
            element.classList.add("touch-dragging");
          }
          try {
            const groupData2 = element.__groupData;
            if (groupData2) {
              const syntheticEvent = new DragEvent("dragstart");
              emit("groupDragStart", groupData2, syntheticEvent);
            }
          } catch {
          }
        },
        // Only start group dragging if the initial touch is on the move handle (.cursor-move)
        shouldStartDrag: (e, element) => {
          let node = e.target;
          while (node && node !== element) {
            if (node instanceof Element && node.hasAttribute && node.hasAttribute("data-group-move"))
              return true;
            node = node.parentNode;
          }
          return false;
        },
        onDragEnd: (element, dropTarget) => {
          element.classList.remove("touch-dragging");
          if (dropTarget) {
            const groupData = element.__groupData;
            const targetData = dropTarget.__groupData;
            if (groupData && targetData && groupData.id !== targetData.id) {
              const syntheticEvent = new DragEvent("drop");
              emit("groupDrop", targetData, syntheticEvent);
            }
          }
        }
      });
      emojiTouchHandler.value = new TouchDragHandler({
        onDragStart: (element) => {
          element.classList.add("touch-dragging");
          try {
            const emojiData = element.__emojiData;
            if (emojiData) {
              const syntheticEvent = new DragEvent("dragstart");
              emit(
                "emojiDragStart",
                emojiData.emoji,
                emojiData.groupId,
                emojiData.index,
                syntheticEvent
              );
            }
          } catch {
          }
        },
        onDragEnd: (element, dropTarget) => {
          element.classList.remove("touch-dragging");
          if (dropTarget) {
            const emojiData = element.__emojiData;
            const targetData = dropTarget.__emojiData;
            if (emojiData && targetData) {
              const syntheticEvent = new DragEvent("drop");
              emit("emojiDrop", targetData.groupId, targetData.index, syntheticEvent);
            }
          }
        }
      });
    });
    onUnmounted(() => {
      var _a, _b;
      (_a = groupTouchHandler.value) == null ? void 0 : _a.destroy();
      (_b = emojiTouchHandler.value) == null ? void 0 : _b.destroy();
    });
    const addGroupTouchEvents = (element, group) => {
      var _a;
      if (!element) return;
      if (group.id !== "favorites") {
        element.__groupData = group;
        try {
          element.setAttribute("data-drop-target", "group");
        } catch {
        }
        (_a = groupTouchHandler.value) == null ? void 0 : _a.addTouchEvents(element, true);
      }
    };
    const addEmojiTouchEvents = (element, emoji, groupId, index) => {
      var _a;
      element.__emojiData = { emoji, groupId, index };
      const stopTouch = (e) => {
        e.stopPropagation();
      };
      element.addEventListener("touchstart", stopTouch, { passive: false });
      element.__stopEmojiTouch = stopTouch;
      try {
        element.setAttribute("data-drop-target", "emoji");
      } catch {
      }
      (_a = emojiTouchHandler.value) == null ? void 0 : _a.addTouchEvents(element, true);
    };
    return (_ctx, _cache) => {
      const _component_a_progress = __unplugin_components_0;
      return openBlock(), createElementBlock("div", null, [
        __props.activeTab === "groups" ? (openBlock(), createElementBlock("div", _hoisted_1, [
          createBaseVNode("div", _hoisted_2, [
            createBaseVNode("div", _hoisted_3, [
              createBaseVNode("div", _hoisted_4, [
                createBaseVNode("div", _hoisted_5, [
                  _cache[14] || (_cache[14] = createBaseVNode("h2", { class: "text-lg font-semibold text-gray-900" }, "表情分组管理", -1)),
                  createBaseVNode("div", _hoisted_6, [
                    createBaseVNode("button", {
                      class: normalizeClass(["px-3 py-1 text-sm rounded", { "bg-white shadow": __props.activeTab === "groups" }]),
                      onClick: _cache[0] || (_cache[0] = ($event) => setTab("groups"))
                    }, " 列表 ", 2),
                    createBaseVNode("button", {
                      class: normalizeClass(["px-3 py-1 text-sm rounded", { "bg-white shadow": __props.activeTab === "groups-card" }]),
                      onClick: _cache[1] || (_cache[1] = ($event) => setTab("groups-card"))
                    }, " 卡片 ", 2)
                  ])
                ]),
                createBaseVNode("button", {
                  onClick: _cache[2] || (_cache[2] = ($event) => _ctx.$emit("openCreateGroup")),
                  class: "px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                }, " 新建分组 ")
              ])
            ]),
            createBaseVNode("div", _hoisted_7, [
              createBaseVNode("div", _hoisted_8, [
                (openBlock(true), createElementBlock(Fragment, null, renderList(displayGroups.value, (group) => {
                  var _a;
                  return openBlock(), createElementBlock("div", {
                    key: group.id,
                    class: "group-item border border-gray-200 rounded-lg hover:border-gray-300 transition-colors",
                    draggable: group.id !== "favorites",
                    onDragstart: ($event) => _ctx.$emit("groupDragStart", group, $event),
                    onDragover: _cache[5] || (_cache[5] = withModifiers(() => {
                    }, ["prevent"])),
                    onDrop: ($event) => _ctx.$emit("groupDrop", group, $event),
                    ref_for: true,
                    ref: (el) => el && addGroupTouchEvents(el, group)
                  }, [
                    group.name != "未分组" ? (openBlock(), createElementBlock("div", _hoisted_10, [
                      createBaseVNode("div", _hoisted_11, [
                        group.id !== "favorites" ? (openBlock(), createElementBlock("div", _hoisted_12, "⋮⋮")) : (openBlock(), createElementBlock("div", _hoisted_13, "⭐")),
                        createBaseVNode("div", _hoisted_14, [
                          __props.isImageUrl && __props.isImageUrl(unref(normalizeImageUrl)(group.icon)) ? (openBlock(), createElementBlock("img", {
                            key: 0,
                            src: unref(normalizeImageUrl)(group.icon),
                            alt: "group icon",
                            class: "w-6 h-6 object-contain rounded",
                            onError: _cache[3] || (_cache[3] = ($event) => _ctx.$emit("imageError", $event))
                          }, null, 40, _hoisted_15)) : (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                            createTextVNode(toDisplayString(group.icon), 1)
                          ], 64))
                        ]),
                        createBaseVNode("div", null, [
                          createBaseVNode("h3", _hoisted_16, toDisplayString(group.name), 1),
                          createBaseVNode("p", _hoisted_17, toDisplayString(((_a = group.emojis) == null ? void 0 : _a.length) || 0) + " 个表情", 1)
                        ])
                      ]),
                      createBaseVNode("div", _hoisted_18, [
                        createBaseVNode("button", {
                          onClick: ($event) => _ctx.$emit("toggleExpand", group.id),
                          class: "px-3 py-1 text-sm text-gray-600 hover:bg-gray-50 rounded transition-colors"
                        }, toDisplayString(__props.expandedGroups.has(group.id) ? "收起" : "展开"), 9, _hoisted_19),
                        group.id !== "favorites" ? (openBlock(), createElementBlock("div", _hoisted_20, [
                          createVNode(GroupActionsDropdown, {
                            group,
                            onEdit,
                            onExport,
                            onExportZip,
                            onDedupe,
                            onConfirmDelete: onDelete
                          }, null, 8, ["group"])
                        ])) : createCommentVNode("", true),
                        dedupeMessage.value[group.id] ? (openBlock(), createElementBlock("div", _hoisted_21, toDisplayString(dedupeMessage.value[group.id]), 1)) : __props.exportProgressGroupId === group.id ? (openBlock(), createElementBlock("div", _hoisted_22, [
                          createVNode(_component_a_progress, {
                            type: "circle",
                            percent: __props.exportProgress || 0
                          }, null, 8, ["percent"])
                        ])) : group.id === "favorites" ? (openBlock(), createElementBlock("div", _hoisted_23, " 系统分组 ")) : createCommentVNode("", true)
                      ])
                    ])) : createCommentVNode("", true),
                    __props.expandedGroups.has(group.id) ? (openBlock(), createElementBlock("div", _hoisted_24, [
                      createBaseVNode("div", _hoisted_25, [
                        createBaseVNode("div", {
                          class: "grid gap-3",
                          style: normalizeStyle({
                            gridTemplateColumns: `repeat(${unref(emojiStore).settings.gridColumns}, minmax(0, 1fr))`
                          })
                        }, [
                          (openBlock(true), createElementBlock(Fragment, null, renderList(group.emojis, (emoji, index) => {
                            return openBlock(), createElementBlock("div", {
                              key: `${group.id}-${index}`,
                              class: "emoji-item relative group cursor-move",
                              draggable: true,
                              onDragstart: ($event) => _ctx.$emit("emojiDragStart", emoji, group.id, index, $event),
                              onDragover: _cache[4] || (_cache[4] = withModifiers(() => {
                              }, ["prevent"])),
                              onDrop: ($event) => _ctx.$emit("emojiDrop", group.id, index, $event),
                              ref_for: true,
                              ref: (el) => el && addEmojiTouchEvents(el, emoji, group.id, index)
                            }, [
                              createBaseVNode("div", _hoisted_27, [
                                createBaseVNode("img", {
                                  src: emoji.url,
                                  alt: emoji.name,
                                  class: "w-full h-full object-cover"
                                }, null, 8, _hoisted_28)
                              ]),
                              createBaseVNode("div", _hoisted_29, toDisplayString(emoji.name), 1),
                              createBaseVNode("button", {
                                onClick: ($event) => _ctx.$emit("editEmoji", emoji, group.id, index),
                                class: "absolute bottom-1 right-1 w-4 h-4 bg-blue-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center",
                                title: "编辑表情"
                              }, " ✎ ", 8, _hoisted_30),
                              createBaseVNode("button", {
                                onClick: ($event) => _ctx.$emit("removeEmoji", group.id, index),
                                class: "absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                              }, " × ", 8, _hoisted_31)
                            ], 40, _hoisted_26);
                          }), 128))
                        ], 4),
                        group.id !== "favorites" ? (openBlock(), createElementBlock("div", _hoisted_32, [
                          createBaseVNode("button", {
                            onClick: ($event) => _ctx.$emit("openAddEmoji", group.id),
                            class: "px-3 py-2 text-sm border border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors w-full"
                          }, " + 添加表情 ", 8, _hoisted_33)
                        ])) : createCommentVNode("", true),
                        group.id === "favorites" ? (openBlock(), createElementBlock("div", _hoisted_34, _cache[15] || (_cache[15] = [
                          createBaseVNode("div", { class: "px-3 py-2 text-sm text-gray-500 text-center border border-gray-200 rounded-lg bg-gray-50" }, " 使用表情会自动添加到常用分组 ", -1)
                        ]))) : createCommentVNode("", true)
                      ])
                    ])) : createCommentVNode("", true)
                  ], 40, _hoisted_9);
                }), 128))
              ])
            ])
          ])
        ])) : __props.activeTab === "groups-card" ? (openBlock(), createElementBlock("div", _hoisted_35, [
          createVNode(GroupsCardView, {
            displayGroups: displayGroups.value,
            isImageUrl: __props.isImageUrl,
            expandedGroups: __props.expandedGroups,
            touchRefFn: addGroupTouchEvents,
            onGroupDragStart: _cache[6] || (_cache[6] = (...args) => _ctx.$emit("groupDragStart", ...args)),
            onGroupDrop: _cache[7] || (_cache[7] = (...args) => _ctx.$emit("groupDrop", ...args)),
            onToggleExpand: _cache[8] || (_cache[8] = ($event) => _ctx.$emit("toggleExpand", $event)),
            onOpenEditGroup: _cache[9] || (_cache[9] = ($event) => _ctx.$emit("openEditGroup", $event)),
            onExportGroup: _cache[10] || (_cache[10] = ($event) => _ctx.$emit("exportGroup", $event)),
            onImageError: _cache[11] || (_cache[11] = ($event) => _ctx.$emit("imageError", $event))
          }, null, 8, ["displayGroups", "isImageUrl", "expandedGroups"])
        ])) : createCommentVNode("", true),
        createVNode(DedupeChooser, {
          visible: chooseDedupeFor.value,
          previewByNameCount: previewDedupeByNameCount.value,
          previewByUrlCount: previewDedupeByUrlCount.value,
          "onUpdate:visible": _cache[12] || (_cache[12] = (v) => chooseDedupeFor.value = v),
          onConfirm: _cache[13] || (_cache[13] = (groupId, mode) => performDedupeChoice(groupId, mode))
        }, null, 8, ["visible", "previewByNameCount", "previewByUrlCount"])
      ]);
    };
  }
});
export {
  _sfc_main as _
};
