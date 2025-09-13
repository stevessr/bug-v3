var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { d as defineComponent, l as useEmojiStore, r as ref, c as computed, z as watch, a as createElementBlock, e as createCommentVNode, o as openBlock, f as createVNode, b as createBaseVNode, T as Transition, w as withCtx, u as unref, C as Card, n as normalizeClass, A as Image, D as __unplugin_components_0, t as toDisplayString, k as withModifiers, h as withDirectives, m as vModelText, E as Dropdown, B as Button, g as createTextVNode, G as DownOutlined, M as Menu, F as Fragment, i as renderList, j as createBlock } from "./options-addemojimodal_vue_vue_type_script_setup_true_lang.js";
class EmojiPreviewUploader {
  constructor() {
    __publicField(this, "waitingQueue", []);
    __publicField(this, "uploadingQueue", []);
    __publicField(this, "failedQueue", []);
    __publicField(this, "successQueue", []);
    __publicField(this, "isProcessing", false);
    __publicField(this, "maxRetries", 2);
    __publicField(this, "progressDialog", null);
  }
  async uploadEmojiImage(file, emojiName) {
    return new Promise((resolve, reject) => {
      const item = {
        id: `emoji_upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        file,
        resolve,
        reject,
        retryCount: 0,
        status: "waiting",
        timestamp: Date.now(),
        emojiName
      };
      this.waitingQueue.push(item);
      this.updateProgressDialog();
      this.processQueue();
    });
  }
  moveToQueue(item, targetStatus) {
    this.waitingQueue = this.waitingQueue.filter((i) => i.id !== item.id);
    this.uploadingQueue = this.uploadingQueue.filter((i) => i.id !== item.id);
    this.failedQueue = this.failedQueue.filter((i) => i.id !== item.id);
    this.successQueue = this.successQueue.filter((i) => i.id !== item.id);
    item.status = targetStatus;
    switch (targetStatus) {
      case "waiting":
        this.waitingQueue.push(item);
        break;
      case "uploading":
        this.uploadingQueue.push(item);
        break;
      case "failed":
        this.failedQueue.push(item);
        break;
      case "success":
        this.successQueue.push(item);
        break;
    }
    this.updateProgressDialog();
  }
  async processQueue() {
    var _a;
    if (this.isProcessing || this.waitingQueue.length === 0) {
      return;
    }
    this.isProcessing = true;
    while (this.waitingQueue.length > 0) {
      const item = this.waitingQueue.shift();
      if (!item) continue;
      this.moveToQueue(item, "uploading");
      try {
        const result = await this.performUpload(item.file);
        item.result = result;
        this.moveToQueue(item, "success");
        item.resolve(result);
      } catch (error) {
        item.error = error;
        if (this.shouldRetry(error, item)) {
          item.retryCount++;
          if (error.error_type === "rate_limit" && ((_a = error.extras) == null ? void 0 : _a.wait_seconds)) {
            await this.sleep(error.extras.wait_seconds * 1e3);
          } else {
            await this.sleep(Math.pow(2, item.retryCount) * 1e3);
          }
          this.moveToQueue(item, "waiting");
        } else {
          this.moveToQueue(item, "failed");
          item.reject(error);
        }
      }
    }
    this.isProcessing = false;
  }
  shouldRetry(error, item) {
    if (item.retryCount >= this.maxRetries) {
      return false;
    }
    return error.error_type === "rate_limit";
  }
  // Method to manually retry failed items
  retryFailedItem(itemId) {
    const item = this.failedQueue.find((i) => i.id === itemId);
    if (item && item.retryCount < this.maxRetries) {
      item.retryCount++;
      this.moveToQueue(item, "waiting");
      this.processQueue();
    }
  }
  showProgressDialog() {
    if (this.progressDialog) {
      return;
    }
    this.progressDialog = this.createProgressDialog();
    document.body.appendChild(this.progressDialog);
  }
  hideProgressDialog() {
    if (this.progressDialog) {
      this.progressDialog.remove();
      this.progressDialog = null;
    }
  }
  updateProgressDialog() {
    if (!this.progressDialog) {
      return;
    }
    const allItems = [
      ...this.waitingQueue,
      ...this.uploadingQueue,
      ...this.failedQueue,
      ...this.successQueue
    ];
    this.renderQueueItems(this.progressDialog, allItems);
  }
  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  createProgressDialog() {
    const dialog = document.createElement("div");
    dialog.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 350px;
      max-height: 400px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      border: 1px solid #e5e7eb;
      overflow: hidden;
    `;
    const header = document.createElement("div");
    header.style.cssText = `
      padding: 16px 20px;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
      font-weight: 600;
      font-size: 14px;
      color: #374151;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    header.textContent = "表情预览上传队列";
    const closeButton = document.createElement("button");
    closeButton.innerHTML = "✕";
    closeButton.style.cssText = `
      background: none;
      border: none;
      font-size: 16px;
      cursor: pointer;
      color: #6b7280;
      padding: 4px;
      border-radius: 4px;
      transition: background-color 0.2s;
    `;
    closeButton.addEventListener("click", () => {
      this.hideProgressDialog();
    });
    header.appendChild(closeButton);
    const content = document.createElement("div");
    content.className = "emoji-upload-queue-content";
    content.style.cssText = `
      max-height: 320px;
      overflow-y: auto;
      padding: 12px;
    `;
    dialog.appendChild(header);
    dialog.appendChild(content);
    return dialog;
  }
  renderQueueItems(dialog, allItems) {
    const content = dialog.querySelector(".emoji-upload-queue-content");
    if (!content) return;
    content.innerHTML = "";
    if (allItems.length === 0) {
      const emptyState = document.createElement("div");
      emptyState.style.cssText = `
        text-align: center;
        color: #6b7280;
        font-size: 14px;
        padding: 20px;
      `;
      emptyState.textContent = "暂无表情上传任务";
      content.appendChild(emptyState);
      return;
    }
    allItems.forEach((item) => {
      const itemEl = document.createElement("div");
      itemEl.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        margin-bottom: 8px;
        background: #f9fafb;
        border-radius: 6px;
        border-left: 4px solid ${this.getStatusColor(item.status)};
      `;
      const leftSide = document.createElement("div");
      leftSide.style.cssText = `
        flex: 1;
        min-width: 0;
      `;
      const fileName = document.createElement("div");
      fileName.style.cssText = `
        font-size: 13px;
        font-weight: 500;
        color: #374151;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      `;
      fileName.textContent = item.emojiName || item.file.name;
      const status = document.createElement("div");
      status.style.cssText = `
        font-size: 12px;
        color: #6b7280;
        margin-top: 2px;
      `;
      status.textContent = this.getStatusText(item);
      leftSide.appendChild(fileName);
      leftSide.appendChild(status);
      const rightSide = document.createElement("div");
      rightSide.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
      `;
      if (item.status === "failed" && item.retryCount < this.maxRetries) {
        const retryButton = document.createElement("button");
        retryButton.innerHTML = "🔄";
        retryButton.style.cssText = `
          background: none;
          border: none;
          cursor: pointer;
          font-size: 14px;
          padding: 4px;
          border-radius: 4px;
          transition: background-color 0.2s;
        `;
        retryButton.title = "重试上传";
        retryButton.addEventListener("click", () => {
          this.retryFailedItem(item.id);
        });
        retryButton.addEventListener("mouseenter", () => {
          retryButton.style.backgroundColor = "#e5e7eb";
        });
        retryButton.addEventListener("mouseleave", () => {
          retryButton.style.backgroundColor = "transparent";
        });
        rightSide.appendChild(retryButton);
      }
      const statusIcon = document.createElement("div");
      statusIcon.style.cssText = `
        font-size: 16px;
      `;
      statusIcon.textContent = this.getStatusIcon(item.status);
      rightSide.appendChild(statusIcon);
      itemEl.appendChild(leftSide);
      itemEl.appendChild(rightSide);
      content.appendChild(itemEl);
    });
  }
  getStatusColor(status) {
    switch (status) {
      case "waiting":
        return "#f59e0b";
      case "uploading":
        return "#3b82f6";
      case "success":
        return "#10b981";
      case "failed":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  }
  getStatusText(item) {
    var _a;
    switch (item.status) {
      case "waiting":
        return "等待上传";
      case "uploading":
        return "正在上传...";
      case "success":
        return "上传成功";
      case "failed":
        if (((_a = item.error) == null ? void 0 : _a.error_type) === "rate_limit") {
          return `上传失败 - 请求过于频繁 (重试 ${item.retryCount}/${this.maxRetries})`;
        }
        return `上传失败 (重试 ${item.retryCount}/${this.maxRetries})`;
      default:
        return "未知状态";
    }
  }
  getStatusIcon(status) {
    switch (status) {
      case "waiting":
        return "⏳";
      case "uploading":
        return "📤";
      case "success":
        return "✅";
      case "failed":
        return "❌";
      default:
        return "❓";
    }
  }
  async performUpload(file) {
    const sha1 = await this.calculateSHA1(file);
    const formData = new FormData();
    formData.append("upload_type", "composer");
    formData.append("relativePath", "null");
    formData.append("name", file.name);
    formData.append("type", file.type);
    formData.append("sha1_checksum", sha1);
    formData.append("file", file, file.name);
    const authInfo = await this.requestAuthFromOptions();
    const headers = {
      "X-Csrf-Token": authInfo.csrfToken
    };
    if (authInfo.cookies) {
      headers["Cookie"] = authInfo.cookies;
    }
    const response = await fetch(
      `https://linux.do/uploads.json?client_id=f06cb5577ba9410d94b9faf94e48c2d8`,
      {
        method: "POST",
        headers,
        body: formData
      }
    );
    if (!response.ok) {
      const errorData = await response.json();
      throw errorData;
    }
    return await response.json();
  }
  async requestAuthFromOptions() {
    if (window.location.hostname.includes("linux.do")) {
      return {
        csrfToken: this.getCSRFToken(),
        cookies: document.cookie
      };
    }
    return new Promise((resolve, reject) => {
      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.sendMessage({ type: "REQUEST_LINUX_DO_AUTH" }, (response) => {
          if (response == null ? void 0 : response.success) {
            resolve({
              csrfToken: response.csrfToken || "",
              cookies: response.cookies || ""
            });
          } else {
            reject(new Error((response == null ? void 0 : response.error) || "Failed to get authentication info"));
          }
        });
      } else {
        reject(new Error("Chrome extension API not available"));
      }
    });
  }
  getCSRFToken() {
    const metaToken = document.querySelector('meta[name="csrf-token"]');
    if (metaToken) {
      return metaToken.content;
    }
    const match = document.cookie.match(/csrf_token=([^;]+)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
    const hiddenInput = document.querySelector(
      'input[name="authenticity_token"]'
    );
    if (hiddenInput) {
      return hiddenInput.value;
    }
    console.warn("[Emoji Preview Uploader] No CSRF token found");
    return "";
  }
  async calculateSHA1(file) {
    const text = `${file.name}-${file.size}-${file.lastModified}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    if (crypto.subtle) {
      try {
        const hashBuffer = await crypto.subtle.digest("SHA-1", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      } catch (e) {
        console.warn("[Emoji Preview Uploader] Could not calculate SHA1, using fallback");
      }
    }
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(40, "0");
  }
}
const emojiPreviewUploader = new EmojiPreviewUploader();
const _hoisted_1 = {
  key: 0,
  class: "fixed inset-0 z-50 overflow-y-auto",
  "aria-labelledby": "modal-title",
  role: "dialog",
  "aria-modal": "true"
};
const _hoisted_2 = { class: "flex items-center justify-center min-h-screen p-4" };
const _hoisted_3 = {
  key: 0,
  class: "flex-shrink-0 flex items-center justify-center",
  style: { "width": "180px", "min-width": "120px", "max-width": "50%", "height": "320px" }
};
const _hoisted_4 = {
  key: 1,
  class: "w-full flex items-center justify-center"
};
const _hoisted_5 = { class: "flex-1 px-4 py-2" };
const _hoisted_6 = { class: "text-sm text-gray-500 truncate" };
const _hoisted_7 = { key: 0 };
const _hoisted_8 = { class: "mt-4 space-y-3" };
const _hoisted_9 = {
  key: 0,
  class: "w-full"
};
const _hoisted_10 = ["disabled"];
const _hoisted_11 = {
  key: 0,
  class: "mr-2"
};
const _hoisted_12 = {
  key: 1,
  class: "mr-2"
};
const _hoisted_13 = {
  key: 1,
  class: "w-full"
};
const _hoisted_14 = { style: { "display": "none" } };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "EditEmojiModal",
  props: {
    show: { type: Boolean },
    emoji: {},
    groupId: {},
    index: {}
  },
  emits: ["update:show", "save", "imageError"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const emojiStore = useEmojiStore();
    const localEmoji = ref({
      name: "",
      url: "",
      displayUrl: ""
    });
    const uploadingEmojiIds = ref(/* @__PURE__ */ new Set());
    const shouldShowUploadButton = computed(() => {
      var _a;
      return !((_a = localEmoji.value.url) == null ? void 0 : _a.includes("linux.do"));
    });
    const uploadSingleEmoji = async (emoji) => {
      if (!emoji.url || !emoji.id || uploadingEmojiIds.value.has(emoji.id)) return;
      try {
        uploadingEmojiIds.value.add(emoji.id);
        const response = await fetch(emoji.url);
        const blob = await response.blob();
        const fileName = `${emoji.name}.${blob.type.split("/")[1] || "png"}`;
        const file = new File([blob], fileName, { type: blob.type });
        try {
          const resp = await emojiPreviewUploader.uploadEmojiImage(file, emoji.name || "emoji");
          if (resp && resp.url && emoji.id) {
            const previousUrl = emoji.url;
            const updates = { url: resp.url };
            updates.hiddenUrl = previousUrl;
            emojiStore.updateEmoji(emoji.id, updates);
            if (localEmoji.value && localEmoji.value.id === emoji.id) {
              localEmoji.value.url = resp.url;
              if (updates.hiddenUrl) localEmoji.value.hiddenUrl = previousUrl;
            }
          }
        } finally {
          emojiPreviewUploader.showProgressDialog();
        }
      } catch (error) {
        console.error("表情上传失败:", error);
        alert(`表情 "${emoji.name}" 上传失败: ${error.message || "未知错误"}`);
      } finally {
        uploadingEmojiIds.value.delete(emoji.id);
      }
    };
    const imageRatio = ref(1);
    const isVertical = ref(false);
    function handleImageLoad(e) {
      const img = e.target;
      if (img && img.naturalWidth && img.naturalHeight) {
        imageRatio.value = img.naturalWidth / img.naturalHeight;
        isVertical.value = imageRatio.value < 1;
        imageLoadFailed.value = false;
      }
    }
    const imageLoadFailed = ref(false);
    const visible = ref(false);
    function handleImageError(e) {
      imageLoadFailed.value = true;
      emit("imageError", e);
    }
    function restoreHiddenUrl() {
      const hid = localEmoji.value.hiddenUrl;
      const id = localEmoji.value.id;
      if (hid && id) {
        localEmoji.value.url = hid;
        localEmoji.value.hiddenUrl = void 0;
        try {
          emojiStore.updateEmoji(id, { url: hid, hiddenUrl: void 0 });
        } catch (err) {
        }
        imageLoadFailed.value = false;
      }
    }
    const selectedGroupId = ref("");
    const availableGroups = computed(() => {
      return emojiStore.groups.filter((g) => g.id !== "favorites");
    });
    const onEditGroupSelect = (info) => {
      selectedGroupId.value = String(info.key);
    };
    const editSelectedGroupLabel = computed(() => {
      const g = availableGroups.value.find((x) => x.id === selectedGroupId.value);
      return g ? `${g.icon ? g.icon + " " : ""}${g.name}` : "选择分组";
    });
    watch(
      () => props.emoji,
      (newEmoji) => {
        if (newEmoji) {
          localEmoji.value = { ...newEmoji };
          selectedGroupId.value = newEmoji.groupId || props.groupId || "";
        }
      },
      { immediate: true }
    );
    watch(
      () => props.groupId,
      (newGroupId) => {
        if (newGroupId && !selectedGroupId.value) {
          selectedGroupId.value = newGroupId;
        }
      },
      { immediate: true }
    );
    const closeModal = () => {
      emit("update:show", false);
    };
    const handleSubmit = () => {
      var _a, _b;
      if (props.groupId !== void 0 && props.index !== void 0 && localEmoji.value.name && localEmoji.value.url) {
        const updatedEmoji = {
          id: ((_a = props.emoji) == null ? void 0 : _a.id) || "",
          packet: ((_b = props.emoji) == null ? void 0 : _b.packet) || Date.now(),
          name: localEmoji.value.name,
          url: localEmoji.value.url,
          displayUrl: localEmoji.value.displayUrl || void 0,
          hiddenUrl: localEmoji.value.hiddenUrl,
          groupId: selectedGroupId.value,
          width: localEmoji.value.width,
          height: localEmoji.value.height,
          usageCount: localEmoji.value.usageCount,
          lastUsed: localEmoji.value.lastUsed,
          addedAt: localEmoji.value.addedAt
        };
        emit("save", {
          emoji: updatedEmoji,
          groupId: props.groupId,
          index: props.index,
          targetGroupId: selectedGroupId.value !== props.groupId ? selectedGroupId.value : void 0
        });
        closeModal();
      }
    };
    return (_ctx, _cache) => {
      const _component_a_card_meta = __unplugin_components_0;
      return _ctx.show ? (openBlock(), createElementBlock("div", _hoisted_1, [
        createVNode(Transition, { name: "overlay-fade" }, {
          default: withCtx(() => [
            createBaseVNode("div", {
              class: "fixed inset-0 bg-gray-500 bg-opacity-75",
              onClick: closeModal
            })
          ]),
          _: 1
        }),
        createBaseVNode("div", _hoisted_2, [
          createVNode(Transition, {
            name: "card-pop",
            appear: ""
          }, {
            default: withCtx(() => [
              createVNode(unref(Card), {
                hoverable: "",
                style: { "max-width": "80vw", "width": "640px" }
              }, {
                default: withCtx(() => [
                  createBaseVNode("div", {
                    class: normalizeClass(isVertical.value ? "flex flex-row" : "flex flex-col")
                  }, [
                    isVertical.value ? (openBlock(), createElementBlock("div", _hoisted_3, [
                      createVNode(unref(Image), {
                        preview: { visible: false },
                        src: localEmoji.value.displayUrl || localEmoji.value.url,
                        class: "object-contain w-full h-full",
                        onLoad: handleImageLoad,
                        onClick: _cache[0] || (_cache[0] = ($event) => visible.value = true),
                        onError: handleImageError
                      }, null, 8, ["src"])
                    ])) : (openBlock(), createElementBlock("div", _hoisted_4, [
                      createVNode(unref(Image), {
                        preview: { visible: false },
                        src: localEmoji.value.displayUrl || localEmoji.value.url,
                        class: "object-contain max-h-full max-w-full",
                        onLoad: handleImageLoad,
                        onClick: _cache[1] || (_cache[1] = ($event) => visible.value = true),
                        onError: handleImageError
                      }, null, 8, ["src"])
                    ])),
                    createBaseVNode("div", _hoisted_5, [
                      createVNode(_component_a_card_meta, {
                        title: localEmoji.value.name || "编辑表情"
                      }, {
                        description: withCtx(() => [
                          createBaseVNode("div", _hoisted_6, toDisplayString(localEmoji.value.url), 1)
                        ]),
                        _: 1
                      }, 8, ["title"]),
                      createBaseVNode("form", {
                        onSubmit: withModifiers(handleSubmit, ["prevent"]),
                        class: "mt-4 space-y-4"
                      }, [
                        createBaseVNode("div", null, [
                          _cache[6] || (_cache[6] = createBaseVNode("label", {
                            for: "emoji-name",
                            class: "block text-sm font-medium text-gray-700"
                          }, " 表情名称 ", -1)),
                          withDirectives(createBaseVNode("input", {
                            id: "emoji-name",
                            "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => localEmoji.value.name = $event),
                            type: "text",
                            class: "mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm",
                            placeholder: "输入表情名称",
                            required: ""
                          }, null, 512), [
                            [vModelText, localEmoji.value.name]
                          ])
                        ]),
                        createBaseVNode("div", null, [
                          _cache[7] || (_cache[7] = createBaseVNode("label", {
                            for: "emoji-url",
                            class: "block text-sm font-medium text-gray-700"
                          }, " 输出链接 (必填) ", -1)),
                          withDirectives(createBaseVNode("input", {
                            id: "emoji-url",
                            "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => localEmoji.value.url = $event),
                            type: "url",
                            class: "mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm",
                            placeholder: "https://example.com/emoji.png",
                            required: ""
                          }, null, 512), [
                            [vModelText, localEmoji.value.url]
                          ]),
                          _cache[8] || (_cache[8] = createBaseVNode("p", { class: "mt-1 text-xs text-gray-500" }, "插入到编辑器时使用的链接", -1))
                        ]),
                        createBaseVNode("div", null, [
                          _cache[9] || (_cache[9] = createBaseVNode("label", {
                            for: "emoji-display-url",
                            class: "block text-sm font-medium text-gray-700"
                          }, " 显示链接 (可选) ", -1)),
                          withDirectives(createBaseVNode("input", {
                            id: "emoji-display-url",
                            "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => localEmoji.value.displayUrl = $event),
                            type: "url",
                            class: "mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm",
                            placeholder: "https://example.com/preview.png"
                          }, null, 512), [
                            [vModelText, localEmoji.value.displayUrl]
                          ]),
                          _cache[10] || (_cache[10] = createBaseVNode("p", { class: "mt-1 text-xs text-gray-500" }, " 表情选择器中显示的链接，留空则使用输出链接 ", -1))
                        ]),
                        availableGroups.value.length > 0 ? (openBlock(), createElementBlock("div", _hoisted_7, [
                          _cache[11] || (_cache[11] = createBaseVNode("label", {
                            for: "emoji-group",
                            class: "block text-sm font-medium text-gray-700"
                          }, " 选择分组 ", -1)),
                          createVNode(unref(Dropdown), null, {
                            overlay: withCtx(() => [
                              createVNode(unref(Menu), { onClick: onEditGroupSelect }, {
                                default: withCtx(() => [
                                  (openBlock(true), createElementBlock(Fragment, null, renderList(availableGroups.value, (group) => {
                                    return openBlock(), createBlock(unref(Menu).Item, {
                                      key: group.id,
                                      value: group.id
                                    }, {
                                      default: withCtx(() => [
                                        createTextVNode(toDisplayString(group.icon) + " " + toDisplayString(group.name), 1)
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
                                  createTextVNode(toDisplayString(editSelectedGroupLabel.value) + " ", 1),
                                  createVNode(unref(DownOutlined))
                                ]),
                                _: 1
                              })
                            ]),
                            _: 1
                          })
                        ])) : createCommentVNode("", true),
                        createBaseVNode("div", _hoisted_8, [
                          shouldShowUploadButton.value ? (openBlock(), createElementBlock("div", _hoisted_9, [
                            createBaseVNode("button", {
                              type: "button",
                              onClick: _cache[5] || (_cache[5] = ($event) => uploadSingleEmoji(localEmoji.value)),
                              disabled: uploadingEmojiIds.value.has(localEmoji.value.id || ""),
                              title: "上传到linux.do",
                              class: "w-full inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-500 text-base font-medium text-white hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-300 disabled:cursor-not-allowed sm:text-sm"
                            }, [
                              uploadingEmojiIds.value.has(localEmoji.value.id || "") ? (openBlock(), createElementBlock("span", _hoisted_11, "⏳")) : (openBlock(), createElementBlock("span", _hoisted_12, "📤")),
                              _cache[12] || (_cache[12] = createTextVNode(" 上传到linux.do ", -1))
                            ], 8, _hoisted_10)
                          ])) : createCommentVNode("", true),
                          localEmoji.value.hiddenUrl && imageLoadFailed.value ? (openBlock(), createElementBlock("div", _hoisted_13, [
                            createBaseVNode("button", {
                              type: "button",
                              onClick: restoreHiddenUrl,
                              class: "w-full inline-flex justify-center rounded-md border border-yellow-400 shadow-sm px-4 py-2 bg-yellow-300 text-base font-medium text-black hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 sm:text-sm"
                            }, " 恢复原始链接 ")
                          ])) : createCommentVNode("", true),
                          createBaseVNode("div", { class: "grid grid-cols-2 gap-3" }, [
                            _cache[13] || (_cache[13] = createBaseVNode("button", {
                              type: "submit",
                              class: "w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm"
                            }, " 保存 ", -1)),
                            createBaseVNode("button", {
                              type: "button",
                              onClick: closeModal,
                              class: "w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm"
                            }, " 取消 ")
                          ])
                        ])
                      ], 32)
                    ])
                  ], 2)
                ]),
                _: 1
              })
            ]),
            _: 1
          })
        ]),
        createBaseVNode("div", _hoisted_14, [
          createVNode(unref(Image).PreviewGroup, {
            preview: { visible: visible.value, onVisibleChange: (vis) => visible.value = vis }
          }, {
            default: withCtx(() => [
              createVNode(unref(Image), {
                src: localEmoji.value.displayUrl || localEmoji.value.url
              }, null, 8, ["src"])
            ]),
            _: 1
          }, 8, ["preview"])
        ])
      ])) : createCommentVNode("", true);
    };
  }
});
export {
  _sfc_main as _,
  emojiPreviewUploader as e
};
