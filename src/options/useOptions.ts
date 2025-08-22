import { ref, computed, onMounted, watch } from "vue";
import { importConfigurationToStore, importEmojisToStore, exportConfigurationFile, exportGroupFile } from './utils';
import { useEmojiStore } from "../stores/emojiStore";
import { flushBuffer } from "../utils/indexedDB";
import type { EmojiGroup } from "../types/emoji";
import { isImageUrl } from "../utils/isImageUrl";

export default function useOptions() {
  const emojiStore = useEmojiStore();

  // Tab navigation
  const activeTab = ref("settings");
  const tabs = [
    { id: "settings", label: "设置" },
    { id: "groups", label: "分组管理" },
    { id: "stats", label: "统计" },
    { id: "about", label: "关于" },
  ];

  // Drag and drop state
  const draggedGroup = ref<EmojiGroup | null>(null);
  const draggedEmoji = ref<any>(null);
  const draggedEmojiGroupId = ref<string>("");
  const draggedEmojiIndex = ref<number>(-1);

  // Group expansion state
  const expandedGroups = ref<Set<string>>(new Set());

  // Reactive data
  const selectedGroupId = ref("");
  const selectedGroupForAdd = ref("");
  const showCreateGroupModal = ref(false);
  const showAddEmojiModal = ref(false);
  const showEditGroupModal = ref(false);
  const showImportModal = ref(false);
  const showImportEmojiModal = ref(false);
  const showSuccessToast = ref(false);
  const showErrorToast = ref(false);
  const showConfirmDeleteModal = ref(false);
  const successMessage = ref("");
  const errorMessage = ref("");
  const groupToDelete = ref<EmojiGroup | null>(null);

  // Edit group state
  const editingGroupId = ref<string>("");
  const editGroupName = ref<string>("");
  const editGroupIcon = ref<string>("");

  const handleConfigImported = async (config: any) => {
    if (!config) {
      showError("配置文件格式错误");
      return;
    }
    try {
      await importConfigurationToStore(config);
      showSuccess("配置导入成功");
    } catch (err) {
      console.error(err);
      showError("配置导入失败");
    }
  };

  const handleEmojisImported = async (payload: any | null) => {
    if (!payload) {
      showError("表情数据格式错误");
      return;
    }
    try {
      if (payload.items && Array.isArray(payload.items)) {
        await importEmojisToStore(payload.items, payload.targetGroupId);
        showSuccess(`成功导入 ${payload.items.length} 个表情`);
        return;
      }

      await importEmojisToStore(payload);
      const count = Array.isArray(payload)
        ? payload.length
        : payload.emojis?.length || 0;
      showSuccess(`成功导入 ${count} 个表情`);
    } catch (err) {
      console.error(err);
      showError("表情导入失败");
    }
  };

  const filteredEmojis = computed(() => {
    if (!selectedGroupId.value) {
      return emojiStore.groups.flatMap((group) => group.emojis);
    }
    const group = emojiStore.groups.find((g) => g.id === selectedGroupId.value);
    return group ? group.emojis : [];
  });

  const totalEmojis = computed(() => {
    return emojiStore.groups.reduce(
      (total, group) => total + (group.emojis?.length || 0),
      0
    );
  });

  const toggleGroupExpansion = (groupId: string) => {
    if (expandedGroups.value.has(groupId)) {
      expandedGroups.value.delete(groupId);
    } else {
      expandedGroups.value.add(groupId);
    }
  };

  const confirmDeleteGroup = (group: EmojiGroup) => {
    groupToDelete.value = group;
    showConfirmDeleteModal.value = true;
  };

  const deleteGroup = async () => {
    if (groupToDelete.value) {
      await emojiStore.deleteGroup(groupToDelete.value.id);
      showSuccess(`分组 "${groupToDelete.value.name}" 已删除`);
      showConfirmDeleteModal.value = false;
      groupToDelete.value = null;
    }
  };

  const handleDragStart = (group: EmojiGroup, event: DragEvent) => {
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

  const handleDrop = async (targetGroup: EmojiGroup, event: DragEvent) => {
    event.preventDefault();
    if (targetGroup.id === "favorites") {
      showError("不能移动到常用分组位置");
      draggedGroup.value = null;
      return;
    }
    if (draggedGroup.value && draggedGroup.value.id !== targetGroup.id) {
      await emojiStore.reorderGroups(draggedGroup.value.id, targetGroup.id);
      await flushBuffer(true);
      console.log("[Options] reorderGroups flushed to IndexedDB", {
        source: draggedGroup.value.id,
        target: targetGroup.id,
      });
      showSuccess("分组顺序已更新");
    }
    draggedGroup.value = null;
  };

  const handleEmojiDragStart = (
    emoji: any,
    groupId: string,
    index: number,
    event: DragEvent
  ) => {
    draggedEmoji.value = emoji;
    draggedEmojiGroupId.value = groupId;
    draggedEmojiIndex.value = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
    }
  };

  const handleEmojiDrop = (
    targetGroupId: string,
    targetIndex: number,
    event: DragEvent
  ) => {
    event.preventDefault();
    if (draggedEmoji.value && draggedEmojiGroupId.value) {
      emojiStore.moveEmoji(
        draggedEmojiGroupId.value,
        draggedEmojiIndex.value,
        targetGroupId,
        targetIndex
      );
      void flushBuffer(true).then(() =>
        console.log("[Options] moveEmoji flushed to IndexedDB", {
          from: draggedEmojiGroupId.value,
          to: targetGroupId,
        })
      );
      showSuccess("表情已移动");
    }
    resetEmojiDrag();
  };

  const removeEmojiFromGroup = (groupId: string, index: number) => {
    emojiStore.removeEmojiFromGroup(groupId, index);
    void flushBuffer(true).then(() =>
      console.log("[Options] removeEmojiFromGroup flushed to IndexedDB", {
        groupId,
        index,
      })
    );
    showSuccess("表情已删除");
  };

  const resetEmojiDrag = () => {
    draggedEmoji.value = null;
    draggedEmojiGroupId.value = "";
    draggedEmojiIndex.value = -1;
  };

  const updateImageScale = (event: Event) => {
    const target = event.target as HTMLInputElement;
    emojiStore.updateSettings({ imageScale: parseInt(target.value) });
  };

  const localGridColumns = ref<number>(emojiStore.settings.gridColumns || 4);

  watch(localGridColumns, (val) => {
    if (Number.isInteger(val) && val >= 1) {
      emojiStore.updateSettings({ gridColumns: val });
    }
  });

  const updateShowSearchBar = (event: Event) => {
    const target = event.target as HTMLInputElement;
    emojiStore.updateSettings({ showSearchBar: target.checked });
  };

  const openEditGroup = (group: EmojiGroup) => {
    if (group.id === "favorites") {
      showError("常用分组不能编辑名称和图标");
      return;
    }
    editingGroupId.value = group.id;
    editGroupName.value = group.name;
    editGroupIcon.value = group.icon;
    showEditGroupModal.value = true;
  };

  const openAddEmojiModal = (groupId: string) => {
    selectedGroupForAdd.value = groupId || "";
    showAddEmojiModal.value = true;
  };

  const exportGroup = (group: EmojiGroup) => {
    if (!group) return;
    exportGroupFile(group);
    showSuccess(
      `已导出分组 "${group.name}" (${(group.emojis || []).length} 个表情)`
    );
  };

  const deleteEmoji = (emojiId: string) => {
    if (confirm("确定要删除这个表情吗？")) {
      emojiStore.deleteEmoji(emojiId);
      void flushBuffer(true).then(() =>
        console.log("[Options] deleteEmoji flushed to IndexedDB", { id: emojiId })
      );
      showSuccess("表情删除成功");
    }
  };

  const exportConfiguration = () => {
    exportConfigurationFile(emojiStore);
    showSuccess("配置导出成功");
  };

  const resetSettings = () => {
    if (confirm("确定要重置所有设置吗？这将清除所有自定义数据。")) {
      emojiStore.resetToDefaults();
      showSuccess("设置重置成功");
    }
  };

  const syncToChrome = async () => {
    try {
      const success = await emojiStore.forceSync();
      if (success) {
        showSuccess("数据已上传到Chrome同步存储");
      } else {
        showError("同步失败，请检查网络连接");
      }
    } catch (error) {
      console.error("Sync error:", error);
      showError("同步失败，请重试");
    }
  };

  const handleImageError = (event: Event) => {
    const target = event.target as HTMLImageElement;
    target.src =
      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCI...";
  };

  const onGroupCreated = () => {
    showSuccess("分组创建成功");
    if (emojiStore.groups.length > 0) {
      console.log(
        "[Options] group created, groups count:",
        emojiStore.groups.length
      );
    }
  };

  const onEmojiAdded = () => {
    showSuccess("表情添加成功");
  };

  const showSuccess = (message: string) => {
    successMessage.value = message;
    showSuccessToast.value = true;
    setTimeout(() => {
      showSuccessToast.value = false;
    }, 3000);
  };

  const showError = (message: string) => {
    errorMessage.value = message;
    showErrorToast.value = true;
    setTimeout(() => {
      showErrorToast.value = false;
    }, 3000);
  };

  onMounted(async () => {
    console.log("[Options.vue] Component mounted, loading data...");
    await emojiStore.loadData();
    console.log("[Options.vue] Data loaded, groups count:", emojiStore.groups.length);

    if (emojiStore.groups.length > 0) {
      selectedGroupForAdd.value = emojiStore.groups[0].id;
      console.log("[Options.vue] Set default group IDs to:", emojiStore.groups[0].id);
    } else {
      console.warn("[Options.vue] No groups available after loading");
    }
  });

  watch(
    () => emojiStore.settings.gridColumns,
    (val) => {
      if (Number.isInteger(val)) {
        localGridColumns.value = val as number;
      }
    }
  );

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
    showImportModal,
    showImportEmojiModal,
    showSuccessToast,
    showErrorToast,
    showConfirmDeleteModal,
    successMessage,
    errorMessage,
    groupToDelete,
    // edit
    editingGroupId,
    editGroupName,
    editGroupIcon,
    // grid
    localGridColumns,
    updateImageScale,
    updateShowSearchBar,
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
    exportConfiguration,
    // group operations
    confirmDeleteGroup,
    deleteGroup,
    openEditGroup,
    openAddEmojiModal,
    onGroupCreated,
    onEmojiAdded,
    deleteEmoji,
    // sync / settings
    resetSettings,
    syncToChrome,
    // feedback
    showSuccess,
    showError,
  // other
  handleImageError,
  // expose low-level flushBuffer for template handlers that need to force flush
  flushBuffer,
  } as const;
}
