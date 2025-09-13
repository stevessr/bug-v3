import { l as useEmojiStore, r as ref, c as computed, z as watch, N as onMounted, Z as newStorageHelpers, s as flushBuffer, p as isImageUrl, $ as STORAGE_KEYS } from "./options-addemojimodal_vue_vue_type_script_setup_true_lang.js";
import { a as importConfigurationToStore, b as importEmojisToStore } from "./options-importutils.js";
import { e as exportGroupFile, a as exportGroupZip, b as exportConfigurationFile } from "./options-exportutils.js";
function useOptions() {
  const emojiStore = useEmojiStore();
  const activeTab = ref("groups");
  const tabs = [
    { id: "settings", label: "设置" },
    { id: "favorites", label: "常用" },
    { id: "groups", label: "分组管理" },
    { id: "groups-card", label: "分组（卡片）" },
    { id: "ungrouped", label: "未分组" },
    { id: "import", label: "外部导入" },
    { id: "bilibili", label: "Bilibili 导入" },
    { id: "stats", label: "统计" },
    { id: "about", label: "关于" }
  ];
  const draggedGroup = ref(null);
  const draggedEmoji = ref(null);
  const draggedEmojiGroupId = ref("");
  const draggedEmojiIndex = ref(-1);
  const expandedGroups = ref(/* @__PURE__ */ new Set());
  const selectedGroupId = ref("");
  const selectedGroupForAdd = ref("");
  const showCreateGroupModal = ref(false);
  const showAddEmojiModal = ref(false);
  const showEditGroupModal = ref(false);
  const showEditEmojiModal = ref(false);
  const showImportModal = ref(false);
  const showImportEmojiModal = ref(false);
  const showSuccessToast = ref(false);
  const showErrorToast = ref(false);
  const showConfirmGenericModal = ref(false);
  const confirmGenericTitle = ref("");
  const confirmGenericMessage = ref("");
  let confirmGenericAction = null;
  const successMessage = ref("");
  const errorMessage = ref("");
  const groupToDelete = ref(null);
  const editingGroupId = ref("");
  const editGroupName = ref("");
  const editGroupIcon = ref("");
  const editingEmoji = ref(null);
  const editingEmojiGroupId = ref("");
  const editingEmojiIndex = ref(-1);
  const handleConfigImported = async (config) => {
    if (!config) {
      showError("配置文件格式错误");
      return;
    }
    try {
      await importConfigurationToStore(config);
      showSuccess("配置导入成功");
    } catch {
      showError("配置导入失败");
    }
  };
  const handleEmojisImported = async (payload) => {
    var _a;
    if (!payload) {
      showError("表情数据格式错误");
      return;
    }
    try {
      const p = payload;
      if (typeof p === "object" && p !== null && "items" in p && Array.isArray(p.items)) {
        await importEmojisToStore(p.items, p.targetGroupId);
        showSuccess(`成功导入 ${p.items.length} 个表情`);
        return;
      }
      await importEmojisToStore(p);
      const count = Array.isArray(p) ? p.length : ((_a = p.emojis) == null ? void 0 : _a.length) || 0;
      showSuccess(`成功导入 ${count} 个表情`);
    } catch (err) {
      showError("表情导入失败");
    }
  };
  const filteredEmojis = computed(() => {
    if (!selectedGroupId.value) {
      return emojiStore.groups.flatMap((group2) => group2.emojis);
    }
    const group = emojiStore.groups.find((g) => g.id === selectedGroupId.value);
    return group ? group.emojis : [];
  });
  const totalEmojis = computed(() => {
    return emojiStore.groups.reduce((total, group) => {
      var _a;
      return total + (((_a = group.emojis) == null ? void 0 : _a.length) || 0);
    }, 0);
  });
  const toggleGroupExpansion = (groupId) => {
    if (expandedGroups.value.has(groupId)) {
      expandedGroups.value.delete(groupId);
    } else {
      expandedGroups.value.add(groupId);
    }
  };
  const confirmDeleteGroup = (group) => {
    groupToDelete.value = group;
    confirmGenericTitle.value = "确认删除";
    confirmGenericMessage.value = `确定要删除分组 "${group.name}" 吗？分组中的表情也会被删除。`;
    confirmGenericAction = () => {
      if (groupToDelete.value) {
        emojiStore.deleteGroup(groupToDelete.value.id);
        showSuccess(`分组 "${groupToDelete.value.name}" 已删除`);
        groupToDelete.value = null;
      }
    };
    showConfirmGenericModal.value = true;
  };
  const handleDragStart = (group, event) => {
    if (group.id === "favorites") {
      event.preventDefault();
      showError("常用分组不能移动位置");
      return;
    }
    draggedGroup.value = group;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
    }
  };
  const handleDrop = async (targetGroup, event) => {
    event.preventDefault();
    if (targetGroup.id === "favorites") {
      showError("不能移动到常用分组位置");
      draggedGroup.value = null;
      return;
    }
    if (draggedGroup.value && draggedGroup.value.id !== targetGroup.id) {
      await emojiStore.reorderGroups(draggedGroup.value.id, targetGroup.id);
      await flushBuffer(true);
      showSuccess("分组顺序已更新");
    }
    draggedGroup.value = null;
  };
  const handleEmojiDragStart = (emoji, groupId, index, event) => {
    draggedEmoji.value = emoji;
    draggedEmojiGroupId.value = groupId;
    draggedEmojiIndex.value = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
    }
  };
  const handleEmojiDrop = (targetGroupId, targetIndex, event) => {
    event.preventDefault();
    if (draggedEmoji.value && draggedEmojiGroupId.value) {
      emojiStore.moveEmoji(
        draggedEmojiGroupId.value,
        draggedEmojiIndex.value,
        targetGroupId,
        targetIndex
      );
      void flushBuffer(true).then(() => {
      });
      showSuccess("表情已移动");
    }
    resetEmojiDrag();
  };
  const removeEmojiFromGroup = (groupId, index) => {
    emojiStore.removeEmojiFromGroup(groupId, index);
    void flushBuffer(true).then(() => {
    });
    showSuccess("表情已删除");
  };
  const resetEmojiDrag = () => {
    draggedEmoji.value = null;
    draggedEmojiGroupId.value = "";
    draggedEmojiIndex.value = -1;
  };
  const updateImageScale = (value) => {
    if (Number.isInteger(value) && value > 0) {
      emojiStore.updateSettings({ imageScale: value });
    }
  };
  const localGridColumns = ref(emojiStore.settings.gridColumns || 4);
  watch(localGridColumns, (val) => {
    if (Number.isInteger(val) && val >= 1) {
      emojiStore.updateSettings({ gridColumns: val });
    }
  });
  const updateShowSearchBar = (value) => {
    emojiStore.updateSettings({ showSearchBar: value });
  };
  const updateOutputFormat = (value) => {
    emojiStore.updateSettings({ outputFormat: value });
  };
  const updateForceMobileMode = (value) => {
    emojiStore.updateSettings({ forceMobileMode: value });
  };
  const updateEnableLinuxDoInjection = (value) => {
    emojiStore.updateSettings({ enableLinuxDoInjection: value });
  };
  const updateEnableXcomExtraSelectors = (value) => {
    emojiStore.updateSettings({ enableXcomExtraSelectors: value });
  };
  const openEditGroup = (group) => {
    if (group.id === "favorites") {
      showError("常用分组不能编辑名称和图标");
      return;
    }
    editingGroupId.value = group.id;
    editGroupName.value = group.name;
    editGroupIcon.value = group.icon;
    showEditGroupModal.value = true;
  };
  const openEditEmoji = (emoji, groupId, index) => {
    editingEmoji.value = emoji;
    editingEmojiGroupId.value = groupId;
    editingEmojiIndex.value = index;
    showEditEmojiModal.value = true;
  };
  const handleEmojiEdit = async (payload) => {
    try {
      if (payload.targetGroupId && payload.targetGroupId !== payload.groupId) {
        emojiStore.removeEmojiFromGroup(payload.groupId, payload.index);
        const updatedEmoji = { ...payload.emoji, groupId: payload.targetGroupId };
        emojiStore.addEmoji(payload.targetGroupId, updatedEmoji);
        showSuccess("表情已移动到新分组并更新");
      } else {
        emojiStore.updateEmojiInGroup(payload.groupId, payload.index, payload.emoji);
        showSuccess("表情已更新");
      }
      await flushBuffer(true);
    } catch {
      showError("表情更新失败");
    }
  };
  const openAddEmojiModal = (groupId) => {
    selectedGroupForAdd.value = groupId || "";
    showAddEmojiModal.value = true;
  };
  const exportGroup = (group) => {
    if (!group) return;
    exportGroupFile(group);
    showSuccess(`已导出分组 "${group.name}" (${(group.emojis || []).length} 个表情)`);
  };
  const exportProgress = ref(0);
  const exportProgressGroupId = ref(null);
  const exportGroupZip$1 = async (group) => {
    if (!group) return;
    try {
      exportProgressGroupId.value = group.id;
      exportProgress.value = 0;
      await exportGroupZip(group, (p) => {
        exportProgress.value = Math.max(0, Math.min(100, Math.round(p)));
      });
      exportProgress.value = 100;
      showSuccess(`已打包并下载分组 "${group.name}"`);
    } catch (e) {
      exportProgress.value = 0;
      showError("打包下载失败，已导出 JSON 作为回退");
    }
    setTimeout(() => {
      exportProgressGroupId.value = null;
      exportProgress.value = 0;
    }, 800);
  };
  const deleteEmoji = (emojiId) => {
    confirmGenericTitle.value = "删除表情";
    confirmGenericMessage.value = "确定要删除这个表情吗？此操作不可撤销。";
    confirmGenericAction = () => {
      emojiStore.deleteEmoji(emojiId);
      void flushBuffer(true).then(() => {
      });
      showSuccess("表情删除成功");
    };
    showConfirmGenericModal.value = true;
  };
  const exportConfiguration = () => {
    exportConfigurationFile(emojiStore);
    showSuccess("配置导出成功");
  };
  const resetSettings = () => {
    confirmGenericTitle.value = "重置设置";
    confirmGenericMessage.value = "确定要重置所有设置吗？这将清除所有自定义数据。";
    confirmGenericAction = () => {
      emojiStore.resetToDefaults();
      showSuccess("设置重置成功");
    };
    showConfirmGenericModal.value = true;
  };
  const executeConfirmGenericAction = () => {
    if (confirmGenericAction) {
      const action = confirmGenericAction;
      confirmGenericAction = null;
      action();
    }
    showConfirmGenericModal.value = false;
  };
  const cancelConfirmGenericAction = () => {
    confirmGenericAction = null;
    showConfirmGenericModal.value = false;
  };
  const syncToChrome = async () => {
    try {
      const success = await emojiStore.forceSync();
      if (success) {
        showSuccess("数据已上传到Chrome同步存储");
      } else {
        showError("同步失败，请检查网络连接");
      }
    } catch {
      showError("同步失败，请重试");
    }
  };
  const forceLocalToExtension = async () => {
    try {
      if (typeof localStorage === "undefined") {
        showError("本地存储不可用");
        return;
      }
      const chromeAPI = typeof chrome !== "undefined" ? chrome : globalThis.chrome;
      if (!chromeAPI || !chromeAPI.storage || !chromeAPI.storage.local) {
        showError("扩展存储 API 不可用");
        return;
      }
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (key === STORAGE_KEYS.SETTINGS || key === STORAGE_KEYS.FAVORITES || key === STORAGE_KEYS.GROUP_INDEX || key.startsWith(STORAGE_KEYS.GROUP_PREFIX)) {
          keys.push(key);
        }
      }
      if (keys.length === 0) {
        showError("未发现可同步的本地存储键");
        return;
      }
      const payload = {};
      keys.forEach((k) => {
        const raw = localStorage.getItem(k);
        try {
          payload[k] = raw ? JSON.parse(raw) : null;
        } catch {
          payload[k] = raw;
        }
      });
      await new Promise((resolve, reject) => {
        try {
          chromeAPI.storage.local.set(payload, () => {
            if (chromeAPI.runtime && chromeAPI.runtime.lastError) {
              reject(chromeAPI.runtime.lastError);
            } else {
              resolve();
            }
          });
        } catch (e) {
          reject(e);
        }
      });
      showSuccess("已将本地存储强制同步到扩展存储");
    } catch (e) {
      showError("强制同步失败，请查看控制台");
    }
  };
  const handleImageError = (event) => {
    const target = event.target;
    target.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCI...";
  };
  const onGroupCreated = () => {
    showSuccess("分组创建成功");
    if (emojiStore.groups.length > 0) ;
  };
  const onEmojiAdded = () => {
    showSuccess("表情添加成功");
  };
  const showSuccess = (message) => {
    successMessage.value = message;
    showSuccessToast.value = true;
    setTimeout(() => {
      showSuccessToast.value = false;
    }, 3e3);
  };
  const showError = (message) => {
    errorMessage.value = message;
    showErrorToast.value = true;
    setTimeout(() => {
      showErrorToast.value = false;
    }, 3e3);
  };
  onMounted(async () => {
    await emojiStore.loadData();
    if (emojiStore.groups.length > 0) {
      selectedGroupForAdd.value = emojiStore.groups[0].id;
    }
    try {
      const pingStart = Date.now();
      const pingInterval = setInterval(() => {
        try {
          void newStorageHelpers.getAllEmojiGroups();
        } catch (e) {
          void e;
        }
        if (Date.now() - pingStart > 4e3) {
          clearInterval(pingInterval);
        }
      }, 500);
    } catch (e) {
    }
    try {
      const emitInjectedSuccess = () => {
        void newStorageHelpers.setFavorites([]).then(() => {
        }).catch((e) => {
          void e;
        });
      };
      try {
        emitInjectedSuccess();
      } catch (e) {
        void e;
      }
      try {
        setTimeout(emitInjectedSuccess, 1e3);
      } catch (e) {
        void e;
      }
      try {
        setTimeout(emitInjectedSuccess, 3500);
      } catch (e) {
        void e;
      }
    } catch (e) {
    }
  });
  return {
    // store + utils
    emojiStore,
    isImageUrl,
    // tabs
    activeTab,
    tabs,
    // computed
    filteredEmojis,
    totalEmojis,
    // groups
    expandedGroups,
    toggleGroupExpansion,
    // modals / ui state
    selectedGroupId,
    selectedGroupForAdd,
    showCreateGroupModal,
    showAddEmojiModal,
    showEditGroupModal,
    showEditEmojiModal,
    showImportModal,
    showImportEmojiModal,
    showSuccessToast,
    showErrorToast,
    successMessage,
    errorMessage,
    groupToDelete,
    // edit
    editingGroupId,
    editGroupName,
    editGroupIcon,
    editingEmoji,
    editingEmojiGroupId,
    editingEmojiIndex,
    // grid
    localGridColumns,
    updateImageScale,
    updateShowSearchBar,
    updateOutputFormat,
    updateForceMobileMode,
    updateEnableLinuxDoInjection,
    updateEnableXcomExtraSelectors,
    // drag/drop
    handleDragStart,
    handleDrop,
    handleEmojiDragStart,
    handleEmojiDrop,
    removeEmojiFromGroup,
    resetEmojiDrag,
    // import/export
    handleConfigImported,
    handleEmojisImported,
    exportGroup,
    exportGroupZip: exportGroupZip$1,
    exportConfiguration,
    // group operations
    confirmDeleteGroup,
    openEditGroup,
    openEditEmoji,
    handleEmojiEdit,
    openAddEmojiModal,
    onGroupCreated,
    onEmojiAdded,
    deleteEmoji,
    // export progress
    exportProgress,
    exportProgressGroupId,
    // sync / settings
    resetSettings,
    syncToChrome,
    forceLocalToExtension,
    // feedback
    showSuccess,
    showError,
    // other
    handleImageError,
    // expose low-level flushBuffer for template handlers that need to force flush
    flushBuffer,
    // generic confirm modal
    showConfirmGenericModal,
    confirmGenericTitle,
    confirmGenericMessage,
    executeConfirmGenericAction,
    cancelConfirmGenericAction
  };
}
export {
  useOptions as u
};
