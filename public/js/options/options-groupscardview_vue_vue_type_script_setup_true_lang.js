import { d as defineComponent, l as useEmojiStore, c as computed, r as ref, a as createElementBlock, o as openBlock, b as createBaseVNode, F as Fragment, i as renderList, k as withModifiers, n as normalizeClass, f as createVNode, u as unref, C as Card, w as withCtx, e as createCommentVNode, j as createBlock, q as normalizeImageUrl, A as Image, t as toDisplayString, x as normalizeStyle } from "./options-addemojimodal_vue_vue_type_script_setup_true_lang.js";
import { G as GroupActionsDropdown } from "./options-groupactionsdropdown.js";
const _hoisted_1 = { class: "space-y-6" };
const _hoisted_2 = ["draggable", "data-group-id", "onTouchstart", "onTouchmove", "onTouchend"];
const _hoisted_3 = { class: "absolute top-2 left-2 z-10" };
const _hoisted_4 = {
  key: 0,
  class: "text-gray-400"
};
const _hoisted_5 = {
  key: 1,
  class: "text-yellow-500"
};
const _hoisted_6 = { class: "flex items-center justify-center bg-gray-50" };
const _hoisted_7 = { class: "w-full flex items-center justify-center p-2" };
const _hoisted_8 = {
  key: 1,
  class: "text-2xl"
};
const _hoisted_9 = { class: "text-sm text-gray-500" };
const _hoisted_10 = { class: "mt-3 flex gap-2" };
const _hoisted_11 = {
  key: 0,
  class: "relative"
};
const _hoisted_12 = {
  key: 1,
  class: "text-sm text-gray-500"
};
const _hoisted_13 = {
  key: 0,
  class: "mt-2 text-sm text-green-600"
};
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "GroupsCardView",
  props: {
    displayGroups: { type: Array, required: true },
    // accept a generic Function to match parent's optional signature
    isImageUrl: { type: Function },
    // function used to attach touch drag events from parent; accepts nullable el
    touchRefFn: {
      type: Function
    }
  },
  emits: [
    "groupDragStart",
    "groupDrop",
    "openEditGroup",
    "exportGroup",
    "exportGroupZip",
    "imageError",
    "confirmDeleteGroup"
  ],
  setup(__props, { emit: __emit }) {
    const emit = __emit;
    const emojiStore = useEmojiStore();
    const columns = computed(() => {
      var _a;
      return ((_a = emojiStore.settings) == null ? void 0 : _a.gridColumns) || 3;
    });
    const openMenuCard = ref(null);
    const dedupeMessageCard = ref({});
    const showDedupeMessageCard = (groupId, msg, ms = 2e3) => {
      dedupeMessageCard.value = { ...dedupeMessageCard.value, [groupId]: msg };
      setTimeout(() => {
        const copy = { ...dedupeMessageCard.value };
        delete copy[groupId];
        dedupeMessageCard.value = copy;
      }, ms);
    };
    const onEditCard = (group) => {
      openMenuCard.value = null;
      emit("openEditGroup", group);
    };
    const onExportCard = (group) => {
      openMenuCard.value = null;
      emit("exportGroup", group);
    };
    const onExportZipCard = (group) => {
      openMenuCard.value = null;
      emit("exportGroupZip", group);
    };
    const onDedupeCard = (group) => {
      openMenuCard.value = null;
      try {
        const removed = emojiStore.dedupeGroup(group.id);
        if (removed > 0) {
          showDedupeMessageCard(group.id, `已去重 ${removed} 个表情`);
        } else {
          showDedupeMessageCard(group.id, `未发现重复`);
        }
      } catch {
      }
    };
    const touchState = ref({
      active: false,
      groupId: null,
      startX: 0,
      startY: 0,
      dragging: false
    });
    const draggingId = ref(null);
    const dropTargetId = ref(null);
    const ghostEl = ref(null);
    const createDragGhost = (group, x, y) => {
      removeDragGhost();
      const el = document.createElement("div");
      el.className = "touch-drag-ghost";
      el.setAttribute("data-ghost-for", group.id);
      if (__props.isImageUrl && __props.isImageUrl(normalizeImageUrl(group.icon))) {
        const img = document.createElement("img");
        img.src = normalizeImageUrl(group.icon) || "";
        img.alt = group.name || "";
        el.appendChild(img);
      } else {
        el.textContent = group.icon || group.name || "";
      }
      document.body.appendChild(el);
      ghostEl.value = el;
      updateDragGhost(x, y);
    };
    const updateDragGhost = (x, y) => {
      if (!ghostEl.value) return;
      ghostEl.value.style.left = `${x}px`;
      ghostEl.value.style.top = `${y}px`;
    };
    const removeDragGhost = () => {
      if (ghostEl.value && ghostEl.value.parentNode) {
        ghostEl.value.parentNode.removeChild(ghostEl.value);
      }
      ghostEl.value = null;
    };
    const onDragStart = (group, e) => {
      draggingId.value = group.id;
      emit("groupDragStart", group, e);
      if (e.dataTransfer) {
        try {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", group.id);
        } catch {
        }
      }
    };
    const onDragOver = (group, e) => {
      e.preventDefault();
      dropTargetId.value = group.id;
    };
    const onDragLeave = (_group, _e) => {
      dropTargetId.value = null;
    };
    const onDrop = (group, e) => {
      e.preventDefault();
      emit("groupDrop", group, e);
      dropTargetId.value = null;
      draggingId.value = null;
    };
    const onDragEnd = (_e) => {
      draggingId.value = null;
      dropTargetId.value = null;
    };
    const getGroupById = (id) => {
      if (!id) return null;
      return __props.displayGroups.find((g) => g.id === id);
    };
    const findGroupIdFromPoint = (x, y) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return null;
      const groupEl = el.closest("[data-group-id]");
      if (!groupEl) return null;
      return groupEl.getAttribute("data-group-id");
    };
    const onTouchStart = (group, e) => {
      const t = e.changedTouches[0];
      touchState.value = {
        active: true,
        groupId: group.id,
        startX: t.clientX,
        startY: t.clientY,
        dragging: false
      };
    };
    const onTouchMove = (group, e) => {
      if (!touchState.value.active || touchState.value.groupId !== group.id) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchState.value.startX;
      const dy = t.clientY - touchState.value.startY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const THRESHOLD = 8;
      if (!touchState.value.dragging && dist > THRESHOLD) {
        touchState.value.dragging = true;
        const wrappedStartEvent = {
          originalEvent: e,
          clientX: t.clientX,
          clientY: t.clientY,
          preventDefault: () => {
            if (e && typeof e.preventDefault === "function" && e.cancelable) {
              try {
                e.preventDefault();
              } catch {
              }
            }
          }
        };
        emit("groupDragStart", group, wrappedStartEvent);
        draggingId.value = group.id;
        try {
          onDragStart(group, wrappedStartEvent);
        } catch {
        }
        createDragGhost(group, t.clientX, t.clientY);
      }
      if (touchState.value.dragging) {
        const curTargetId = findGroupIdFromPoint(t.clientX, t.clientY);
        dropTargetId.value = curTargetId;
        updateDragGhost(t.clientX, t.clientY);
        if (e && typeof e.preventDefault === "function" && e.cancelable) {
          try {
            e.preventDefault();
          } catch {
          }
        }
      }
    };
    const onTouchEnd = (group, e) => {
      if (!touchState.value.active) return;
      const t = e.changedTouches[0];
      if (touchState.value.dragging) {
        const targetId = findGroupIdFromPoint(t.clientX, t.clientY);
        const targetGroup = getGroupById(targetId) || group;
        const wrappedEndEvent = {
          originalEvent: e,
          clientX: t.clientX,
          clientY: t.clientY,
          preventDefault: () => {
            if (e && typeof e.preventDefault === "function" && e.cancelable) {
              try {
                e.preventDefault();
              } catch {
              }
            }
          }
        };
        emit("groupDrop", targetGroup, wrappedEndEvent);
        dropTargetId.value = (targetGroup == null ? void 0 : targetGroup.id) || null;
        try {
          onDrop(targetGroup, wrappedEndEvent);
        } catch {
          draggingId.value = null;
          setTimeout(() => {
            dropTargetId.value = null;
          }, 220);
        }
        removeDragGhost();
        try {
          onDragEnd(wrappedEndEvent);
        } catch {
        }
      }
      touchState.value = { active: false, groupId: null, startX: 0, startY: 0, dragging: false };
    };
    const onTouchCancel = (_e) => {
      touchState.value = { active: false, groupId: null, startX: 0, startY: 0, dragging: false };
      draggingId.value = null;
      dropTargetId.value = null;
      removeDragGhost();
    };
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createBaseVNode("div", {
          class: "grid gap-4",
          style: normalizeStyle({ gridTemplateColumns: `repeat(${columns.value}, minmax(0, 1fr))` })
        }, [
          (openBlock(true), createElementBlock(Fragment, null, renderList(__props.displayGroups, (group) => {
            return openBlock(), createElementBlock("div", {
              key: group.id,
              class: normalizeClass(["group-card", {
                "is-dragging": draggingId.value === group.id,
                "is-drop-target": dropTargetId.value === group.id
              }]),
              draggable: group.id !== "favorites",
              ref_for: true,
              ref: (el) => __props.touchRefFn && __props.touchRefFn(el, group),
              "data-group-id": group.id,
              onTouchstart: withModifiers(($event) => onTouchStart(group, $event), ["prevent"]),
              onTouchmove: ($event) => onTouchMove(group, $event),
              onTouchend: ($event) => onTouchEnd(group, $event),
              onTouchcancel: _cache[2] || (_cache[2] = ($event) => onTouchCancel())
            }, [
              createVNode(unref(Card), {
                hoverable: "",
                class: normalizeClass([{
                  "card-dragging": draggingId.value === group.id,
                  "card-target": dropTargetId.value === group.id,
                  "cursor-move": group.id !== "favorites"
                }, "relative"]),
                draggable: group.id !== "favorites",
                "data-group-move": group.id !== "favorites" ? "" : null,
                onDragstart: ($event) => onDragStart(group, $event),
                onDragover: withModifiers(($event) => onDragOver(group, $event), ["prevent"]),
                onDragleave: ($event) => onDragLeave(),
                onDrop: ($event) => onDrop(group, $event)
              }, {
                default: withCtx(() => [
                  createBaseVNode("div", _hoisted_3, [
                    group.id !== "favorites" ? (openBlock(), createElementBlock("div", _hoisted_4, "⋮⋮")) : (openBlock(), createElementBlock("div", _hoisted_5, "⭐"))
                  ]),
                  createBaseVNode("div", _hoisted_6, [
                    createBaseVNode("div", _hoisted_7, [
                      __props.isImageUrl && __props.isImageUrl(unref(normalizeImageUrl)(group.icon)) ? (openBlock(), createBlock(unref(Image), {
                        key: 0,
                        src: unref(normalizeImageUrl)(group.icon),
                        alt: "icon",
                        class: "max-w-full object-contain",
                        onError: _cache[0] || (_cache[0] = ($event) => _ctx.$emit("imageError", $event))
                      }, null, 8, ["src"])) : (openBlock(), createElementBlock("div", _hoisted_8, toDisplayString(group.icon), 1))
                    ])
                  ]),
                  createVNode(unref(Card).Meta, {
                    title: group.name
                  }, {
                    default: withCtx(() => {
                      var _a;
                      return [
                        createBaseVNode("div", _hoisted_9, toDisplayString(((_a = group.emojis) == null ? void 0 : _a.length) || 0) + " 个表情", 1)
                      ];
                    }),
                    _: 2
                  }, 1032, ["title"]),
                  createBaseVNode("div", _hoisted_10, [
                    group.id !== "favorites" ? (openBlock(), createElementBlock("div", _hoisted_11, [
                      createVNode(GroupActionsDropdown, {
                        group,
                        onEdit: onEditCard,
                        onExport: onExportCard,
                        onExportZip: onExportZipCard,
                        onDedupe: onDedupeCard,
                        onConfirmDelete: _cache[1] || (_cache[1] = (g) => _ctx.$emit("confirmDeleteGroup", g))
                      }, null, 8, ["group"])
                    ])) : (openBlock(), createElementBlock("div", _hoisted_12, "系统分组"))
                  ]),
                  dedupeMessageCard.value[group.id] ? (openBlock(), createElementBlock("div", _hoisted_13, toDisplayString(dedupeMessageCard.value[group.id]), 1)) : createCommentVNode("", true)
                ]),
                _: 2
              }, 1032, ["class", "draggable", "data-group-move", "onDragstart", "onDragover", "onDragleave", "onDrop"])
            ], 42, _hoisted_2);
          }), 128))
        ], 4)
      ]);
    };
  }
});
export {
  _sfc_main as _
};
