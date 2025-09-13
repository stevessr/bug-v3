var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var _a, _b, _c, _d;
const contentDefaultEmojiGroups = [
  {
    id: "nachoneko",
    name: "默认",
    icon: "😺",
    order: 0,
    emojis: []
  }
];
async function getDefaultEmojisAsync() {
  return contentDefaultEmojiGroups;
}
const cachedState = {
  emojiGroups: [],
  settings: {
    imageScale: 30,
    gridColumns: 4,
    outputFormat: "markdown",
    forceMobileMode: false,
    defaultGroup: "nachoneko",
    showSearchBar: true
  }
};
function sendMessageToBackground(message) {
  return new Promise((resolve) => {
    try {
      if (window.chrome && window.chrome.runtime && window.chrome.runtime.sendMessage) {
        ;
        window.chrome.runtime.sendMessage(message, (response) => {
          resolve(response);
        });
      } else {
        resolve({ success: false, error: "chrome.runtime.sendMessage not available" });
      }
    } catch (e) {
      resolve({ success: false, error: e instanceof Error ? e.message : String(e) });
    }
  });
}
async function loadDataFromStorage() {
  try {
    console.log("[Emoji Extension] Requesting emoji data from background");
    const resp = await sendMessageToBackground({ type: "GET_EMOJI_DATA" });
    if (resp && resp.success && resp.data) {
      const groups = resp.data.groups || [];
      const settings = resp.data.settings || {};
      console.log("[Emoji Extension] Received groups from background:", (groups == null ? void 0 : groups.length) || 0);
      if (Array.isArray(groups) && groups.length > 0) {
        let validGroups = 0;
        let totalEmojis = 0;
        groups.forEach((group) => {
          if (group && group.emojis && Array.isArray(group.emojis)) {
            validGroups++;
            totalEmojis += group.emojis.length;
          }
        });
        if (validGroups > 0 && totalEmojis > 0) {
          cachedState.emojiGroups = groups;
          console.log(
            `[Emoji Extension] Successfully loaded ${validGroups} valid groups with ${totalEmojis} total emojis (from background)`
          );
        } else {
          console.warn(
            "[Emoji Extension] Groups exist but contain no valid emojis, using defaults (from background)"
          );
          cachedState.emojiGroups = [];
        }
      } else {
        console.warn(
          "[Emoji Extension] No valid emoji groups found in background response, using defaults"
        );
        cachedState.emojiGroups = [];
      }
      if (settings && typeof settings === "object") {
        cachedState.settings = { ...cachedState.settings, ...settings };
        console.log("[Emoji Extension] Loaded settings (from background):", cachedState.settings);
      }
    } else {
      console.warn(
        "[Emoji Extension] Background did not return emoji data, falling back to defaults"
      );
      cachedState.emojiGroups = [];
      cachedState.settings = {
        imageScale: 30,
        gridColumns: 4,
        outputFormat: "markdown",
        forceMobileMode: false,
        defaultGroup: "nachoneko",
        showSearchBar: true
      };
    }
    let finalEmojisCount = 0;
    cachedState.emojiGroups.forEach((g) => {
      var _a2;
      if ((_a2 = g == null ? void 0 : g.emojis) == null ? void 0 : _a2.length) finalEmojisCount += g.emojis.length;
    });
    console.log("[Emoji Extension] Final cache state (from background):", {
      groupsCount: cachedState.emojiGroups.length,
      emojisCount: finalEmojisCount,
      settings: cachedState.settings
    });
  } catch (error) {
    console.error("[Emoji Extension] Failed to load from background (module):", error);
    cachedState.emojiGroups = [];
    cachedState.settings = {
      imageScale: 30,
      gridColumns: 4,
      outputFormat: "markdown",
      forceMobileMode: false,
      defaultGroup: "nachoneko",
      showSearchBar: true
    };
  }
}
function ensureDefaultIfEmpty() {
  if (!Array.isArray(cachedState.emojiGroups) || cachedState.emojiGroups.length === 0) {
    const defaultEmojis = getDefaultEmojisAsync();
    cachedState.emojiGroups = [
      { id: "default", name: "默认表情", icon: "😀", order: 0, emojis: defaultEmojis }
    ];
  }
}
function insertEmojiIntoEditor(emoji) {
  var _a2;
  const em = emoji;
  try {
    chrome.runtime.sendMessage({
      action: "addToFavorites",
      emoji
    });
  } catch (_e) {
    try {
      ;
      chrome.runtime.sendMessage({ action: "addToFavorites", emoji });
    } catch (_ignored) {
    }
  }
  const textArea = document.querySelector("textarea.d-editor-input");
  const richEle = document.querySelector(".ProseMirror.d-editor-input");
  if (!textArea && !richEle) {
    console.warn("找不到输入框");
    return;
  }
  const match = (_a2 = em.url) == null ? void 0 : _a2.match(/_(\d{3,})x(\d{3,})\./);
  let width = "500";
  let height = "500";
  if (match) {
    width = match[1];
    height = match[2];
  } else if (em.width && em.height) {
    width = em.width.toString();
    height = em.height.toString();
  }
  const scale = cachedState && cachedState.settings && cachedState.settings.imageScale || 30;
  const outputFormat = cachedState && cachedState.settings && cachedState.settings.outputFormat || "markdown";
  if (textArea) {
    let emojiText = "";
    if (outputFormat === "html") {
      const pixelWidth = Math.max(1, Math.round(Number(width) * (scale / 100)));
      const pixelHeight = Math.max(1, Math.round(Number(height) * (scale / 100)));
      emojiText = `<img src="${em.url}" title=":${em.name}:" class="emoji only-emoji" alt=":${em.name}:" loading="lazy" width="${pixelWidth}" height="${pixelHeight}" style="aspect-ratio: ${pixelWidth} / ${pixelHeight};"> `;
    } else {
      emojiText = `![${em.name}|${width}x${height},${scale}%](${em.url}) `;
    }
    const startPos = textArea.selectionStart;
    const endPos = textArea.selectionEnd;
    textArea.value = textArea.value.substring(0, startPos) + emojiText + textArea.value.substring(endPos, textArea.value.length);
    textArea.selectionStart = textArea.selectionEnd = startPos + emojiText.length;
    textArea.focus();
    const event = new Event("input", { bubbles: true, cancelable: true });
    textArea.dispatchEvent(event);
  } else if (richEle) {
    const numericWidth = Number(width) || 500;
    const pixelWidth = Math.max(1, Math.round(numericWidth * (scale / 100)));
    const imgTemplate = `<img src="${em.url}" alt="${em.name}" width="${width}" height="${height}" data-scale="${scale}" style="width: ${pixelWidth}px">`;
    try {
      const dt = new DataTransfer();
      dt.setData("text/html", imgTemplate);
      const evt = new ClipboardEvent("paste", {
        clipboardData: dt,
        bubbles: true
      });
      richEle.dispatchEvent(evt);
    } catch (_e) {
      try {
        document.execCommand("insertHTML", false, imgTemplate);
      } catch (e) {
        console.warn("无法向富文本编辑器中插入表情", e);
      }
    }
  }
}
async function createEmojiPicker(isMobileView) {
  console.log("[Emoji Extension] Creating picker for isMobileView:", isMobileView);
  if (isMobileView) {
    return createMobileEmojiPicker();
  }
  return createDesktopEmojiPicker();
}
function isImageUrl(value) {
  if (!value) return false;
  if (typeof value === "string" && value.startsWith("data:image/")) return true;
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(url.pathname);
    }
    return false;
  } catch {
    return false;
  }
}
async function createDesktopEmojiPicker() {
  ensureDefaultIfEmpty();
  const groupsToUse = cachedState.emojiGroups;
  const picker = document.createElement("div");
  picker.className = "fk-d-menu -animated -expanded";
  picker.setAttribute("data-identifier", "emoji-picker");
  picker.setAttribute("role", "dialog");
  picker.style.cssText = "max-width: 400px; visibility: visible; z-index: 999999;";
  const innerContent = document.createElement("div");
  innerContent.className = "fk-d-menu__inner-content";
  const emojiPickerDiv = document.createElement("div");
  emojiPickerDiv.className = "emoji-picker";
  const filterContainer = document.createElement("div");
  filterContainer.className = "emoji-picker__filter-container";
  const filterDiv = document.createElement("div");
  filterDiv.className = "emoji-picker__filter filter-input-container";
  const searchInput = document.createElement("input");
  searchInput.className = "filter-input";
  searchInput.placeholder = "按表情符号名称搜索…";
  searchInput.type = "text";
  filterDiv.appendChild(searchInput);
  filterContainer.appendChild(filterDiv);
  const content = document.createElement("div");
  content.className = "emoji-picker__content";
  const sectionsNav = document.createElement("div");
  sectionsNav.className = "emoji-picker__sections-nav";
  const scrollableContent = document.createElement("div");
  scrollableContent.className = "emoji-picker__scrollable-content";
  const sections = document.createElement("div");
  sections.className = "emoji-picker__sections";
  sections.setAttribute("role", "button");
  groupsToUse.forEach((group, index) => {
    var _a2;
    if (!((_a2 = group == null ? void 0 : group.emojis) == null ? void 0 : _a2.length)) return;
    const navButton = document.createElement("button");
    navButton.className = `btn no-text btn-flat emoji-picker__section-btn ${index === 0 ? "active" : ""}`;
    navButton.setAttribute("tabindex", "-1");
    navButton.setAttribute("data-section", group.id);
    navButton.type = "button";
    const iconVal = group.icon || "📁";
    if (isImageUrl(iconVal)) {
      const img = document.createElement("img");
      img.src = iconVal;
      img.alt = group.name || "";
      img.className = "emoji-group-icon";
      img.style.width = "18px";
      img.style.height = "18px";
      img.style.objectFit = "contain";
      navButton.appendChild(img);
    } else {
      navButton.textContent = String(iconVal);
    }
    navButton.title = group.name;
    navButton.addEventListener("click", () => {
      sectionsNav.querySelectorAll(".emoji-picker__section-btn").forEach((btn) => btn.classList.remove("active"));
      navButton.classList.add("active");
      const target = sections.querySelector(`[data-section="${group.id}"]`);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    sectionsNav.appendChild(navButton);
    const section = document.createElement("div");
    section.className = "emoji-picker__section";
    section.setAttribute("data-section", group.id);
    section.setAttribute("role", "region");
    section.setAttribute("aria-label", group.name);
    const titleContainer = document.createElement("div");
    titleContainer.className = "emoji-picker__section-title-container";
    const title = document.createElement("h2");
    title.className = "emoji-picker__section-title";
    title.textContent = group.name;
    titleContainer.appendChild(title);
    const sectionEmojis = document.createElement("div");
    sectionEmojis.className = "emoji-picker__section-emojis";
    let added = 0;
    group.emojis.forEach((emoji) => {
      if (!emoji || typeof emoji !== "object" || !emoji.url || !emoji.name) return;
      const img = document.createElement("img");
      img.width = 32;
      img.height = 32;
      img.className = "emoji";
      img.src = emoji.url;
      img.setAttribute("tabindex", "0");
      img.setAttribute("data-emoji", emoji.name);
      img.alt = emoji.name;
      img.title = `:${emoji.name}:`;
      img.loading = "lazy";
      img.addEventListener("click", () => {
        insertEmojiIntoEditor(emoji);
        picker.remove();
      });
      img.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          insertEmojiIntoEditor(emoji);
          picker.remove();
        }
      });
      sectionEmojis.appendChild(img);
      added++;
    });
    if (added === 0) {
      const msg = document.createElement("div");
      msg.textContent = `${group.name} 组暂无有效表情`;
      msg.style.cssText = "padding: 20px; text-align: center; color: #999;";
      sectionEmojis.appendChild(msg);
    }
    section.appendChild(titleContainer);
    section.appendChild(sectionEmojis);
    sections.appendChild(section);
  });
  searchInput.addEventListener("input", (e) => {
    const q = (e.target.value || "").toLowerCase();
    const allImages = sections.querySelectorAll("img");
    allImages.forEach((img) => {
      var _a2;
      const emojiName = ((_a2 = img.getAttribute("data-emoji")) == null ? void 0 : _a2.toLowerCase()) || "";
      img.style.display = q === "" || emojiName.includes(q) ? "" : "none";
    });
    sections.querySelectorAll(".emoji-picker__section").forEach((section) => {
      const visibleEmojis = section.querySelectorAll('img:not([style*="none"])');
      const titleContainer = section.querySelector(".emoji-picker__section-title-container");
      if (titleContainer)
        titleContainer.style.display = visibleEmojis.length > 0 ? "" : "none";
    });
  });
  scrollableContent.appendChild(sections);
  content.appendChild(sectionsNav);
  content.appendChild(scrollableContent);
  emojiPickerDiv.appendChild(filterContainer);
  emojiPickerDiv.appendChild(content);
  innerContent.appendChild(emojiPickerDiv);
  picker.appendChild(innerContent);
  return picker;
}
async function createMobileEmojiPicker() {
  ensureDefaultIfEmpty();
  const groupsToUse = cachedState.emojiGroups;
  const modal = document.createElement("div");
  modal.className = "modal d-modal fk-d-menu-modal emoji-picker-content";
  modal.setAttribute("data-keyboard", "false");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("role", "dialog");
  modal.setAttribute("data-identifier", "emoji-picker");
  const modalContainerDiv = document.createElement("div");
  modalContainerDiv.className = "d-modal__container";
  const modalBody = document.createElement("div");
  modalBody.className = "d-modal__body";
  modalBody.tabIndex = -1;
  const emojiPickerDiv = document.createElement("div");
  emojiPickerDiv.className = "emoji-picker";
  const filterContainer = document.createElement("div");
  filterContainer.className = "emoji-picker__filter-container";
  const filterInputContainer = document.createElement("div");
  filterInputContainer.className = "emoji-picker__filter filter-input-container";
  const searchInput = document.createElement("input");
  searchInput.className = "filter-input";
  searchInput.placeholder = "按表情符号名称和别名搜索…";
  searchInput.type = "text";
  filterInputContainer.appendChild(searchInput);
  const closeButton = document.createElement("button");
  closeButton.className = "btn no-text btn-icon btn-transparent emoji-picker__close-btn";
  closeButton.type = "button";
  closeButton.innerHTML = `<svg class="fa d-icon d-icon-xmark svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#xmark"></use></svg>`;
  closeButton.addEventListener("click", () => {
    const modalContainer = modal.closest(".modal-container");
    if (modalContainer) {
      modalContainer.remove();
    }
  });
  filterContainer.appendChild(filterInputContainer);
  filterContainer.appendChild(closeButton);
  const content = document.createElement("div");
  content.className = "emoji-picker__content";
  const sectionsNav = document.createElement("div");
  sectionsNav.className = "emoji-picker__sections-nav";
  const scrollableContent = document.createElement("div");
  scrollableContent.className = "emoji-picker__scrollable-content";
  const sections = document.createElement("div");
  sections.className = "emoji-picker__sections";
  sections.setAttribute("role", "button");
  groupsToUse.forEach((group, index) => {
    var _a2;
    if (!((_a2 = group == null ? void 0 : group.emojis) == null ? void 0 : _a2.length)) return;
    const navButton = document.createElement("button");
    navButton.className = `btn no-text btn-flat emoji-picker__section-btn ${index === 0 ? "active" : ""}`;
    navButton.setAttribute("tabindex", "-1");
    navButton.setAttribute("data-section", group.id);
    navButton.type = "button";
    const iconVal = group.icon || "📁";
    if (isImageUrl(iconVal)) {
      const img = document.createElement("img");
      img.src = iconVal;
      img.alt = group.name || "";
      img.className = "emoji";
      img.style.width = "18px";
      img.style.height = "18px";
      img.style.objectFit = "contain";
      navButton.appendChild(img);
    } else {
      navButton.textContent = String(iconVal);
    }
    navButton.title = group.name;
    navButton.addEventListener("click", () => {
      sectionsNav.querySelectorAll(".emoji-picker__section-btn").forEach((btn) => btn.classList.remove("active"));
      navButton.classList.add("active");
      const target = sections.querySelector(`[data-section="${group.id}"]`);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    sectionsNav.appendChild(navButton);
    const section = document.createElement("div");
    section.className = "emoji-picker__section";
    section.setAttribute("data-section", group.id);
    section.setAttribute("role", "region");
    section.setAttribute("aria-label", group.name);
    const titleContainer = document.createElement("div");
    titleContainer.className = "emoji-picker__section-title-container";
    const title = document.createElement("h2");
    title.className = "emoji-picker__section-title";
    title.textContent = group.name;
    titleContainer.appendChild(title);
    const sectionEmojis = document.createElement("div");
    sectionEmojis.className = "emoji-picker__section-emojis";
    group.emojis.forEach((emoji) => {
      if (!emoji || typeof emoji !== "object" || !emoji.url || !emoji.name) return;
      const img = document.createElement("img");
      img.width = 32;
      img.height = 32;
      img.className = "emoji";
      img.src = emoji.url;
      img.tabIndex = 0;
      img.dataset.emoji = emoji.name;
      img.alt = emoji.name;
      img.title = `:${emoji.name}:`;
      img.loading = "lazy";
      img.addEventListener("click", () => {
        insertEmojiIntoEditor(emoji);
        const modalContainer = modal.closest(".modal-container");
        if (modalContainer) {
          modalContainer.remove();
        }
      });
      img.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          insertEmojiIntoEditor(emoji);
          const modalContainer = modal.closest(".modal-container");
          if (modalContainer) {
            modalContainer.remove();
          }
        }
      });
      sectionEmojis.appendChild(img);
    });
    section.appendChild(titleContainer);
    section.appendChild(sectionEmojis);
    sections.appendChild(section);
  });
  searchInput.addEventListener("input", (e) => {
    const q = (e.target.value || "").toLowerCase();
    sections.querySelectorAll("img").forEach((img) => {
      const emojiName = (img.dataset.emoji || "").toLowerCase();
      img.style.display = q === "" || emojiName.includes(q) ? "" : "none";
    });
    sections.querySelectorAll(".emoji-picker__section").forEach((section) => {
      const visibleEmojis = section.querySelectorAll('img:not([style*="display: none"])');
      section.style.display = visibleEmojis.length > 0 ? "" : "none";
    });
  });
  scrollableContent.appendChild(sections);
  content.appendChild(sectionsNav);
  content.appendChild(scrollableContent);
  emojiPickerDiv.appendChild(filterContainer);
  emojiPickerDiv.appendChild(content);
  modalBody.appendChild(emojiPickerDiv);
  modalContainerDiv.appendChild(modalBody);
  modal.appendChild(modalContainerDiv);
  return modal;
}
function parseImageFilenamesFromMarkdown(markdownText) {
  const imageRegex = /!\[([^\]]*)\]\([^)]+\)/g;
  const filenames = [];
  let match;
  while ((match = imageRegex.exec(markdownText)) !== null) {
    const filename = match[1];
    if (filename && filename.trim()) {
      filenames.push(filename.trim());
    }
  }
  return filenames;
}
function insertIntoEditor(text) {
  const textArea = document.querySelector("textarea.d-editor-input");
  const richEle = document.querySelector(".ProseMirror.d-editor-input");
  if (!textArea && !richEle) {
    console.error("找不到输入框");
    return;
  }
  if (textArea) {
    const start = textArea.selectionStart;
    const end = textArea.selectionEnd;
    const value = textArea.value;
    textArea.value = value.substring(0, start) + text + value.substring(end);
    textArea.setSelectionRange(start + text.length, start + text.length);
    textArea.focus();
    const event = new Event("input", { bubbles: true });
    textArea.dispatchEvent(event);
  } else if (richEle) {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    richEle.focus();
  }
}
class ImageUploader {
  constructor() {
    __publicField(this, "waitingQueue", []);
    __publicField(this, "uploadingQueue", []);
    __publicField(this, "failedQueue", []);
    __publicField(this, "successQueue", []);
    __publicField(this, "isProcessing", false);
    __publicField(this, "maxRetries", 2);
    // Second failure stops retry
    __publicField(this, "progressDialog", null);
  }
  async uploadImage(file) {
    return new Promise((resolve, reject) => {
      const item = {
        id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        file,
        resolve,
        reject,
        retryCount: 0,
        status: "waiting",
        timestamp: Date.now()
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
    var _a2;
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
        const markdown = `![${result.original_filename}](${result.url})`;
        insertIntoEditor(markdown);
      } catch (error) {
        item.error = error;
        if (this.shouldRetry(error, item)) {
          item.retryCount++;
          if (error.error_type === "rate_limit" && ((_a2 = error.extras) == null ? void 0 : _a2.wait_seconds)) {
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
    header.textContent = "图片上传队列";
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
    closeButton.addEventListener("mouseenter", () => {
      closeButton.style.backgroundColor = "#e5e7eb";
    });
    closeButton.addEventListener("mouseleave", () => {
      closeButton.style.backgroundColor = "transparent";
    });
    header.appendChild(closeButton);
    const content = document.createElement("div");
    content.className = "upload-queue-content";
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
    const content = dialog.querySelector(".upload-queue-content");
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
      emptyState.textContent = "暂无上传任务";
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
      fileName.textContent = item.file.name;
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
    var _a2;
    switch (item.status) {
      case "waiting":
        return "等待上传";
      case "uploading":
        return "正在上传...";
      case "success":
        return "上传成功";
      case "failed":
        if (((_a2 = item.error) == null ? void 0 : _a2.error_type) === "rate_limit") {
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
    const csrfToken = this.getCSRFToken();
    const headers = {
      "X-Csrf-Token": csrfToken
    };
    if (document.cookie) {
      headers["Cookie"] = document.cookie;
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
    console.warn("[Image Uploader] No CSRF token found");
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
        console.warn("[Image Uploader] Could not calculate SHA1, using fallback");
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
const uploader = new ImageUploader();
function createDragDropUploadPanel() {
  const panel = document.createElement("div");
  panel.className = "drag-drop-upload-panel";
  panel.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 500px;
    max-width: 90vw;
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 9999;
  `;
  const header = document.createElement("div");
  header.style.cssText = `
    padding: 20px 24px 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;
  const title = document.createElement("h3");
  title.textContent = "上传图片";
  title.style.cssText = `
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #111827;
  `;
  const closeButton = document.createElement("button");
  closeButton.innerHTML = "✕";
  closeButton.style.cssText = `
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: #6b7280;
    padding: 4px;
    border-radius: 4px;
    transition: background-color 0.2s;
  `;
  closeButton.addEventListener("mouseenter", () => {
    closeButton.style.backgroundColor = "#f3f4f6";
  });
  closeButton.addEventListener("mouseleave", () => {
    closeButton.style.backgroundColor = "transparent";
  });
  header.appendChild(title);
  header.appendChild(closeButton);
  const content = document.createElement("div");
  content.style.cssText = `
    padding: 24px;
  `;
  const tabContainer = document.createElement("div");
  tabContainer.style.cssText = `
    display: flex;
    border-bottom: 1px solid #e5e7eb;
    margin-bottom: 20px;
  `;
  const regularTab = document.createElement("button");
  regularTab.textContent = "常规上传";
  regularTab.style.cssText = `
    flex: 1;
    padding: 10px 20px;
    background: none;
    border: none;
    border-bottom: 2px solid #3b82f6;
    color: #3b82f6;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  `;
  const diffTab = document.createElement("button");
  diffTab.textContent = "差分上传";
  diffTab.style.cssText = `
    flex: 1;
    padding: 10px 20px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: #6b7280;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  `;
  tabContainer.appendChild(regularTab);
  tabContainer.appendChild(diffTab);
  const regularPanel = document.createElement("div");
  regularPanel.className = "regular-upload-panel";
  regularPanel.style.cssText = `
    display: block;
  `;
  const dropZone = document.createElement("div");
  dropZone.className = "drop-zone";
  dropZone.style.cssText = `
    border: 2px dashed #d1d5db;
    border-radius: 8px;
    padding: 40px 20px;
    text-align: center;
    background: #f9fafb;
    transition: all 0.2s;
    cursor: pointer;
  `;
  const dropIcon = document.createElement("div");
  dropIcon.innerHTML = "📁";
  dropIcon.style.cssText = `
    font-size: 48px;
    margin-bottom: 16px;
  `;
  const dropText = document.createElement("div");
  dropText.innerHTML = `
    <div style="font-size: 16px; font-weight: 500; color: #374151; margin-bottom: 8px;">
      拖拽图片到此处，或点击选择文件
    </div>
    <div style="font-size: 14px; color: #6b7280;">
      支持 JPG、PNG、GIF 等格式，最大 10MB
    </div>
  `;
  dropZone.appendChild(dropIcon);
  dropZone.appendChild(dropText);
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.multiple = true;
  fileInput.style.display = "none";
  regularPanel.appendChild(dropZone);
  regularPanel.appendChild(fileInput);
  const diffPanel = document.createElement("div");
  diffPanel.className = "diff-upload-panel";
  diffPanel.style.cssText = `
    display: none;
  `;
  const markdownTextarea = document.createElement("textarea");
  markdownTextarea.placeholder = "请粘贴包含图片的markdown文本...";
  markdownTextarea.style.cssText = `
    width: 100%;
    height: 120px;
    padding: 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-family: monospace;
    font-size: 14px;
    resize: vertical;
    margin-bottom: 12px;
    box-sizing: border-box;
  `;
  const diffDropZone = document.createElement("div");
  diffDropZone.className = "diff-drop-zone";
  diffDropZone.style.cssText = `
    border: 2px dashed #d1d5db;
    border-radius: 8px;
    padding: 30px 20px;
    text-align: center;
    background: #f9fafb;
    transition: all 0.2s;
    cursor: pointer;
    margin-bottom: 12px;
  `;
  const diffDropIcon = document.createElement("div");
  diffDropIcon.innerHTML = "📋";
  diffDropIcon.style.cssText = `
    font-size: 36px;
    margin-bottom: 12px;
  `;
  const diffDropText = document.createElement("div");
  diffDropText.innerHTML = `
    <div style="font-size: 16px; font-weight: 500; color: #374151; margin-bottom: 8px;">
      选择图片进行差分上传
    </div>
    <div style="font-size: 14px; color: #6b7280;">
      只会上传不在上方markdown文本中的图片
    </div>
  `;
  diffDropZone.appendChild(diffDropIcon);
  diffDropZone.appendChild(diffDropText);
  const diffFileInput = document.createElement("input");
  diffFileInput.type = "file";
  diffFileInput.accept = "image/*";
  diffFileInput.multiple = true;
  diffFileInput.style.display = "none";
  diffPanel.appendChild(markdownTextarea);
  diffPanel.appendChild(diffDropZone);
  diffPanel.appendChild(diffFileInput);
  content.appendChild(tabContainer);
  content.appendChild(regularPanel);
  content.appendChild(diffPanel);
  panel.appendChild(header);
  panel.appendChild(content);
  const switchToTab = (activeTab, inactiveTab, activePanel, inactivePanel) => {
    activeTab.style.borderBottomColor = "#3b82f6";
    activeTab.style.color = "#3b82f6";
    inactiveTab.style.borderBottomColor = "transparent";
    inactiveTab.style.color = "#6b7280";
    activePanel.style.display = "block";
    inactivePanel.style.display = "none";
  };
  regularTab.addEventListener("click", () => {
    switchToTab(regularTab, diffTab, regularPanel, diffPanel);
  });
  diffTab.addEventListener("click", () => {
    switchToTab(diffTab, regularTab, diffPanel, regularPanel);
  });
  return {
    panel,
    overlay,
    dropZone,
    fileInput,
    closeButton,
    diffDropZone,
    diffFileInput,
    markdownTextarea
  };
}
async function showImageUploadDialog() {
  return new Promise((resolve) => {
    const {
      panel,
      overlay,
      dropZone,
      fileInput,
      closeButton,
      diffDropZone,
      diffFileInput,
      markdownTextarea
    } = createDragDropUploadPanel();
    let isDragOver = false;
    let isDiffDragOver = false;
    const cleanup = () => {
      document.body.removeChild(overlay);
      document.body.removeChild(panel);
      resolve();
    };
    const handleFiles = async (files) => {
      if (!files || files.length === 0) return;
      cleanup();
      uploader.showProgressDialog();
      try {
        const promises = Array.from(files).map(async (file) => {
          try {
            const result = await uploader.uploadImage(file);
            return result;
          } catch (error) {
            console.error("[Image Uploader] Upload failed:", error);
            throw error;
          }
        });
        await Promise.allSettled(promises);
      } finally {
        setTimeout(() => {
          uploader.hideProgressDialog();
        }, 3e3);
      }
    };
    const handleDiffFiles = async (files) => {
      if (!files || files.length === 0) return;
      const markdownText = markdownTextarea.value;
      const existingFilenames = parseImageFilenamesFromMarkdown(markdownText);
      const filesToUpload = Array.from(files).filter((file) => {
        const filename = file.name;
        return !existingFilenames.includes(filename);
      });
      if (filesToUpload.length === 0) {
        alert("所有选择的图片都已在markdown文本中存在，无需上传。");
        return;
      }
      if (filesToUpload.length < files.length) {
        const skippedCount = files.length - filesToUpload.length;
        const proceed = confirm(
          `发现 ${skippedCount} 个图片已存在于markdown文本中，将被跳过。是否继续上传剩余 ${filesToUpload.length} 个图片？`
        );
        if (!proceed) {
          return;
        }
      }
      cleanup();
      uploader.showProgressDialog();
      try {
        const promises = filesToUpload.map(async (file) => {
          try {
            const result = await uploader.uploadImage(file);
            return result;
          } catch (error) {
            console.error("[Image Uploader] Diff upload failed:", error);
            throw error;
          }
        });
        await Promise.allSettled(promises);
      } finally {
        setTimeout(() => {
          uploader.hideProgressDialog();
        }, 3e3);
      }
    };
    fileInput.addEventListener("change", async (event) => {
      const files = event.target.files;
      if (files) {
        await handleFiles(files);
      }
    });
    dropZone.addEventListener("click", () => {
      fileInput.click();
    });
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!isDragOver) {
        isDragOver = true;
        dropZone.style.borderColor = "#3b82f6";
        dropZone.style.backgroundColor = "#eff6ff";
      }
    });
    dropZone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      if (!dropZone.contains(e.relatedTarget)) {
        isDragOver = false;
        dropZone.style.borderColor = "#d1d5db";
        dropZone.style.backgroundColor = "#f9fafb";
      }
    });
    dropZone.addEventListener("drop", async (e) => {
      var _a2;
      e.preventDefault();
      isDragOver = false;
      dropZone.style.borderColor = "#d1d5db";
      dropZone.style.backgroundColor = "#f9fafb";
      const files = (_a2 = e.dataTransfer) == null ? void 0 : _a2.files;
      if (files) {
        await handleFiles(files);
      }
    });
    diffFileInput.addEventListener("change", async (event) => {
      const files = event.target.files;
      if (files) {
        await handleDiffFiles(files);
      }
    });
    diffDropZone.addEventListener("click", () => {
      diffFileInput.click();
    });
    diffDropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!isDiffDragOver) {
        isDiffDragOver = true;
        diffDropZone.style.borderColor = "#3b82f6";
        diffDropZone.style.backgroundColor = "#eff6ff";
      }
    });
    diffDropZone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      if (!diffDropZone.contains(e.relatedTarget)) {
        isDiffDragOver = false;
        diffDropZone.style.borderColor = "#d1d5db";
        diffDropZone.style.backgroundColor = "#f9fafb";
      }
    });
    diffDropZone.addEventListener("drop", async (e) => {
      var _a2;
      e.preventDefault();
      isDiffDragOver = false;
      diffDropZone.style.borderColor = "#d1d5db";
      diffDropZone.style.backgroundColor = "#f9fafb";
      const files = (_a2 = e.dataTransfer) == null ? void 0 : _a2.files;
      if (files) {
        await handleDiffFiles(files);
      }
    });
    closeButton.addEventListener("click", cleanup);
    overlay.addEventListener("click", cleanup);
    const preventDefaults = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      document.addEventListener(eventName, preventDefaults, false);
    });
    const originalCleanup = cleanup;
    const enhancedCleanup = () => {
      ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
        document.removeEventListener(eventName, preventDefaults, false);
      });
      originalCleanup();
    };
    closeButton.removeEventListener("click", cleanup);
    overlay.removeEventListener("click", cleanup);
    closeButton.addEventListener("click", enhancedCleanup);
    overlay.addEventListener("click", enhancedCleanup);
    document.body.appendChild(overlay);
    document.body.appendChild(panel);
  });
}
const TOOLBAR_SELECTORS = [
  '.d-editor-button-bar[role="toolbar"]',
  // Standard editor toolbar
  ".chat-composer__inner-container"
  // Chat composer
];
function findAllToolbars() {
  const toolbars = [];
  for (const selector of TOOLBAR_SELECTORS) {
    const elements = document.querySelectorAll(selector);
    toolbars.push(...Array.from(elements));
  }
  return toolbars;
}
let currentPicker = null;
function handleClickOutside(e, button) {
  if (currentPicker && !currentPicker.contains(e.target) && e.target !== button) {
    currentPicker.remove();
    currentPicker = null;
    document.removeEventListener("click", (event) => handleClickOutside(event, button));
  }
}
async function injectDesktopPicker(button) {
  currentPicker = await createEmojiPicker(false);
  const buttonRect = button.getBoundingClientRect();
  const pickerElement = currentPicker;
  if (pickerElement) document.body.appendChild(pickerElement);
  const editorWrapper = document.querySelector(".d-editor-textarea-wrapper");
  if (editorWrapper) {
    const editorRect = editorWrapper.getBoundingClientRect();
    const replyControl = document.querySelector("#reply-control");
    const isMinireply = (replyControl == null ? void 0 : replyControl.className.includes("hide-preview")) && window.innerWidth < 1600;
    pickerElement.style.position = "fixed";
    if (isMinireply) {
      pickerElement.style.bottom = window.innerHeight - editorRect.top + 10 + "px";
      pickerElement.style.left = editorRect.left + editorRect.width / 2 - 200 + "px";
    } else {
      const pickerRect = pickerElement.getBoundingClientRect();
      pickerElement.style.top = buttonRect.top - pickerRect.height - 5 + "px";
      pickerElement.style.left = buttonRect.left + buttonRect.width / 2 - pickerRect.width / 2 + "px";
      if (pickerElement.getBoundingClientRect().top < 0) {
        pickerElement.style.top = buttonRect.bottom + 5 + "px";
      }
    }
  } else {
    pickerElement.style.position = "fixed";
    pickerElement.style.top = buttonRect.bottom + 5 + "px";
    pickerElement.style.left = buttonRect.left + "px";
  }
  setTimeout(() => {
    document.addEventListener("click", (event) => handleClickOutside(event, button));
  }, 100);
}
async function injectMobilePicker() {
  const picker = await createEmojiPicker(true);
  let modalContainer = document.querySelector(".modal-container");
  if (!modalContainer) {
    modalContainer = document.createElement("div");
    modalContainer.className = "modal-container";
    document.body.appendChild(modalContainer);
  }
  modalContainer.innerHTML = "";
  const backdrop = document.createElement("div");
  backdrop.className = "d-modal__backdrop";
  backdrop.addEventListener("click", () => {
    modalContainer.remove();
    currentPicker = null;
  });
  modalContainer.appendChild(picker);
  modalContainer.appendChild(backdrop);
  currentPicker = modalContainer;
}
function createUploadMenu(isMobile = false) {
  const menu = document.createElement("div");
  menu.className = "fk-d-menu toolbar-menu__options-content toolbar-popup-menu-options -animated -expanded";
  menu.setAttribute("data-identifier", "toolbar-menu__options");
  menu.setAttribute("role", "dialog");
  const inner = document.createElement("div");
  inner.className = "fk-d-menu__inner-content";
  const list = document.createElement("ul");
  list.className = "dropdown-menu";
  function createListItem(titleText, emoji, onClick) {
    const li = document.createElement("li");
    li.className = "dropdown-menu__item";
    const btn = document.createElement("button");
    btn.className = "btn btn-icon-text";
    btn.type = "button";
    btn.title = titleText;
    btn.addEventListener("click", onClick);
    const emojiSpan = document.createElement("span");
    emojiSpan.textContent = emoji;
    const labelWrap = document.createElement("span");
    labelWrap.className = "d-button-label";
    const labelText = document.createElement("span");
    labelText.className = "d-button-label__text";
    labelText.textContent = titleText;
    labelWrap.appendChild(labelText);
    btn.appendChild(emojiSpan);
    btn.appendChild(labelWrap);
    li.appendChild(btn);
    return li;
  }
  const uploadLi = createListItem("上传本地图片", "📁", async () => {
    menu.remove();
    await showImageUploadDialog();
  });
  const generateLi = createListItem("AI 生成图片", "🎨", () => {
    menu.remove();
    try {
      window.open("https://gemini-image.smnet.studio/", "_blank");
    } catch (e) {
      window.location.href = "https://gemini-image.smnet.studio/";
    }
  });
  list.appendChild(uploadLi);
  list.appendChild(generateLi);
  inner.appendChild(list);
  menu.appendChild(inner);
  if (isMobile) {
    const modalContainer = document.createElement("div");
    modalContainer.className = "modal-container";
    const modal = document.createElement("div");
    modal.className = "modal d-modal fk-d-menu-modal toolbar-menu__options-content toolbar-popup-menu-options";
    modal.setAttribute("data-keyboard", "false");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("data-identifier", "toolbar-menu__options");
    modal.setAttribute("data-content", "");
    const modalContainerInner = document.createElement("div");
    modalContainerInner.className = "d-modal__container";
    const modalBody = document.createElement("div");
    modalBody.className = "d-modal__body";
    modalBody.tabIndex = -1;
    const grip = document.createElement("div");
    grip.className = "fk-d-menu-modal__grip";
    grip.setAttribute("aria-hidden", "true");
    modalBody.appendChild(grip);
    modalBody.appendChild(inner.querySelector(".dropdown-menu"));
    modalContainerInner.appendChild(modalBody);
    modal.appendChild(modalContainerInner);
    const backdrop = document.createElement("div");
    backdrop.className = "d-modal__backdrop";
    backdrop.addEventListener("click", () => {
      if (modalContainer.parentElement) modalContainer.parentElement.removeChild(modalContainer);
    });
    modalContainer.appendChild(modal);
    modalContainer.appendChild(backdrop);
    return modalContainer;
  }
  return menu;
}
function injectButton(toolbar) {
  if (toolbar.querySelector(".emoji-extension-button") || toolbar.querySelector(".image-upload-button")) {
    return;
  }
  const isChatComposer = toolbar.classList.contains("chat-composer__inner-container");
  const emojiButton = document.createElement("button");
  emojiButton.classList.add(
    "btn",
    "no-text",
    "btn-icon",
    "toolbar__button",
    "nacho-emoji-picker-button",
    "emoji-extension-button"
  );
  if (isChatComposer) {
    emojiButton.classList.add(
      "fk-d-menu__trigger",
      "emoji-picker-trigger",
      "chat-composer-button",
      "btn-transparent",
      "-emoji"
    );
    emojiButton.setAttribute("aria-expanded", "false");
    emojiButton.setAttribute("data-identifier", "emoji-picker");
    emojiButton.setAttribute("data-trigger", "");
  }
  emojiButton.title = "表情包";
  emojiButton.type = "button";
  emojiButton.innerHTML = `🐈‍⬛`;
  emojiButton.addEventListener("click", async (event) => {
    var _a2;
    event.stopPropagation();
    if (currentPicker) {
      currentPicker.remove();
      currentPicker = null;
      document.removeEventListener("click", (event2) => handleClickOutside(event2, emojiButton));
      return;
    }
    const forceMobile = ((_a2 = cachedState.settings) == null ? void 0 : _a2.forceMobileMode) || false;
    if (forceMobile) {
      injectMobilePicker();
    } else {
      injectDesktopPicker(emojiButton);
    }
  });
  const uploadButton = document.createElement("button");
  uploadButton.classList.add("btn", "no-text", "btn-icon", "toolbar__button", "image-upload-button");
  if (isChatComposer) {
    uploadButton.classList.add("fk-d-menu__trigger", "chat-composer-button", "btn-transparent");
    uploadButton.setAttribute("aria-expanded", "false");
    uploadButton.setAttribute("data-trigger", "");
  }
  uploadButton.title = "上传图片";
  uploadButton.type = "button";
  uploadButton.innerHTML = `📷`;
  uploadButton.addEventListener("click", async (event) => {
    var _a2;
    event.stopPropagation();
    const forceMobile = ((_a2 = cachedState.settings) == null ? void 0 : _a2.forceMobileMode) || false;
    const isMobile = forceMobile || toolbar.classList.contains("chat-composer__inner-container");
    const menu = createUploadMenu(isMobile);
    if (isMobile) {
      const modalPortal = document.querySelector(".modal-container");
      if (!modalPortal) {
        document.body.appendChild(menu);
      } else {
        modalPortal.appendChild(menu);
      }
    } else {
      let portal = document.querySelector("#d-menu-portals");
      if (!portal) {
        portal = document.createElement("div");
        portal.id = "d-menu-portals";
        document.body.appendChild(portal);
      }
      portal.appendChild(menu);
      const rect = uploadButton.getBoundingClientRect();
      menu.style.position = "fixed";
      menu.style.visibility = "hidden";
      menu.style.zIndex = "10000";
      menu.style.maxWidth = "400px";
      const menuRect = menu.getBoundingClientRect();
      let top = rect.top - menuRect.height - 5;
      let left = rect.left + rect.width / 2 - menuRect.width / 2;
      let placement = "top";
      if (top < 0) {
        top = rect.bottom + 5;
        placement = "bottom";
      }
      left = Math.max(8, Math.min(left, window.innerWidth - menuRect.width - 8));
      menu.style.top = `${top}px`;
      menu.style.left = `${left}px`;
      menu.style.visibility = "visible";
      menu.setAttribute("data-strategy", "absolute");
      menu.setAttribute("data-placement", placement);
    }
    const removeMenu = (e) => {
      if (isMobile) {
        const modalContainer = menu.classList && menu.classList.contains("modal-container") ? menu : document.querySelector(".modal-container");
        if (modalContainer && !modalContainer.contains(e.target)) {
          if (modalContainer.parentElement) modalContainer.parentElement.removeChild(modalContainer);
          document.removeEventListener("click", removeMenu);
        }
      } else {
        if (!menu.contains(e.target)) {
          if (menu.parentElement) menu.parentElement.removeChild(menu);
          document.removeEventListener("click", removeMenu);
        }
      }
    };
    setTimeout(() => {
      document.addEventListener("click", removeMenu);
    }, 100);
  });
  try {
    if (isChatComposer) {
      const emojiPickerBtn = toolbar.querySelector(
        ".emoji-picker-trigger:not(.emoji-extension-button)"
      );
      if (emojiPickerBtn) {
        toolbar.insertBefore(uploadButton, emojiPickerBtn);
        toolbar.insertBefore(emojiButton, emojiPickerBtn);
      } else {
        toolbar.appendChild(uploadButton);
        toolbar.appendChild(emojiButton);
      }
    } else {
      toolbar.appendChild(uploadButton);
      toolbar.appendChild(emojiButton);
    }
  } catch (e) {
    console.error("[Emoji Extension] Failed to inject buttons (module):", e);
  }
}
function extractNameFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split("/").pop() || "";
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
    const decoded = decodeURIComponent(nameWithoutExt);
    if (/^[0-9a-f]{8,}$/i.test(decoded) || decoded.length < 2) return "表情";
    return decoded || "表情";
  } catch {
    return "表情";
  }
}
function setupButtonClickHandler(button, data) {
  button.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const originalContent = button.innerHTML;
    const originalStyle = button.style.cssText;
    try {
      await chrome.runtime.sendMessage({ action: "addEmojiFromWeb", emojiData: data });
      button.innerHTML = "已添加";
      button.style.background = "linear-gradient(135deg, #10b981, #059669)";
      setTimeout(() => {
        button.innerHTML = originalContent;
        button.style.cssText = originalStyle;
      }, 2e3);
    } catch (error) {
      console.error("[DiscourseOneClick] 添加表情失败:", error);
      button.innerHTML = "失败";
      button.style.background = "linear-gradient(135deg, #ef4444, #dc2626)";
      setTimeout(() => {
        button.innerHTML = originalContent;
        button.style.cssText = originalStyle;
      }, 2e3);
    }
  });
}
function isMagnificPopup(element) {
  return element.classList && element.classList.contains("mfp-wrap") && element.classList.contains("mfp-gallery") && element.querySelector(".mfp-img") !== null;
}
function extractEmojiDataFromMfp(imgElement, titleContainer) {
  const src = imgElement.src;
  if (!src || !src.startsWith("http")) return null;
  let name = "";
  const titleText = titleContainer.textContent || "";
  const titleParts = titleText.split("·");
  if (titleParts.length > 0) name = titleParts[0].trim();
  if (!name || name.length < 2) name = imgElement.alt || imgElement.title || extractNameFromUrl(src);
  name = name.trim() || "表情";
  return { name, url: src };
}
function createMfpEmojiButton(data) {
  const button = document.createElement("a");
  button.className = "image-source-link emoji-add-link";
  button.style.cssText = `color:#fff;background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:6px;padding:4px 8px;margin:0 2px;display:inline-flex;align-items:center;font-weight:600;`;
  button.innerHTML = "添加表情";
  button.title = "添加到未分组表情";
  setupButtonClickHandler(button, data);
  return button;
}
function addEmojiButtonToMfp(mfpContainer) {
  if (mfpContainer.querySelector(".emoji-add-link")) return;
  const imgElement = mfpContainer.querySelector(".mfp-img");
  const titleContainer = mfpContainer.querySelector(".mfp-title");
  if (!imgElement || !titleContainer) return;
  const emojiData = extractEmojiDataFromMfp(imgElement, titleContainer);
  if (!emojiData) return;
  const addButton = createMfpEmojiButton(emojiData);
  const downloadLink = titleContainer.querySelector("a.image-source-link");
  if (downloadLink) {
    titleContainer.insertBefore(document.createTextNode(" · "), downloadLink);
    titleContainer.insertBefore(addButton, downloadLink);
  } else {
    titleContainer.appendChild(document.createTextNode(" · "));
    titleContainer.appendChild(addButton);
  }
}
function scanForMagnificPopup() {
  const mfpContainers = document.querySelectorAll(".mfp-wrap.mfp-gallery");
  mfpContainers.forEach((container) => {
    if (isMagnificPopup(container)) addEmojiButtonToMfp(container);
  });
}
function observeMagnificPopup() {
  const observer = new MutationObserver((mutations) => {
    let changed = false;
    mutations.forEach((m) => {
      if (m.type === "childList") {
        m.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node;
            if (el.classList && el.classList.contains("mfp-wrap")) changed = true;
          }
        });
      }
    });
    if (changed) setTimeout(scanForMagnificPopup, 100);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
function isCookedContent(element) {
  return element.classList.contains("cooked") && element.querySelector(".lightbox-wrapper") !== null;
}
function extractEmojiDataFromLightbox(lightboxWrapper) {
  const results = [];
  const anchor = lightboxWrapper.querySelector("a.lightbox");
  const img = lightboxWrapper.querySelector("img");
  if (!anchor || !img) return results;
  const title = anchor.getAttribute("title") || "";
  const originalUrl = anchor.getAttribute("href") || "";
  const downloadUrl = anchor.getAttribute("data-download-href") || "";
  const imgSrc = img.getAttribute("src") || "";
  let name = title || img.getAttribute("alt") || "";
  if (!name || name.length < 2) name = extractNameFromUrl(originalUrl || downloadUrl || imgSrc);
  name = name.replace(/\.(webp|jpg|jpeg|png|gif)$/i, "").trim() || "表情";
  const urlToUse = originalUrl || downloadUrl || imgSrc;
  if (urlToUse && urlToUse.startsWith("http")) results.push({ name, url: urlToUse });
  return results;
}
function createBatchParseButton(cookedElement) {
  const button = document.createElement("button");
  button.className = "emoji-batch-parse-button";
  button.style.cssText = "display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border-radius:8px;padding:8px 12px;margin:10px 0;font-weight:600;";
  button.innerHTML = "一键解析并添加所有图片";
  button.title = "解析当前内容中的所有图片并添加到未分组表情";
  button.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const originalContent = button.innerHTML;
    const originalStyle = button.style.cssText;
    try {
      button.innerHTML = "正在解析...";
      button.style.background = "linear-gradient(135deg,#6b7280,#4b5563)";
      button.disabled = true;
      const lightboxWrappers = cookedElement.querySelectorAll(".lightbox-wrapper");
      const allEmojiData = [];
      lightboxWrappers.forEach((wrapper) => {
        const items = extractEmojiDataFromLightbox(wrapper);
        allEmojiData.push(...items);
      });
      if (allEmojiData.length === 0) throw new Error("未找到可解析的图片");
      let successCount = 0;
      for (const emojiData of allEmojiData) {
        try {
          await chrome.runtime.sendMessage({ action: "addEmojiFromWeb", emojiData });
          successCount++;
        } catch (e2) {
          console.error("[DiscourseOneClick] 添加图片失败", emojiData.name, e2);
        }
      }
      button.innerHTML = `已处理 ${successCount}/${allEmojiData.length} 张图片`;
      button.style.background = "linear-gradient(135deg,#10b981,#059669)";
      setTimeout(() => {
        button.innerHTML = originalContent;
        button.style.cssText = originalStyle;
        button.disabled = false;
      }, 3e3);
    } catch (error) {
      console.error("[DiscourseOneClick] 批量解析失败:", error);
      button.innerHTML = "解析失败";
      button.style.background = "linear-gradient(135deg,#ef4444,#dc2626)";
      setTimeout(() => {
        button.innerHTML = originalContent;
        button.style.cssText = originalStyle;
        button.disabled = false;
      }, 3e3);
    }
  });
  return button;
}
function addBatchParseButtonToCooked(cookedElement) {
  if (cookedElement.querySelector(".emoji-batch-parse-button")) return;
  const lightboxWrappers = cookedElement.querySelectorAll(".lightbox-wrapper");
  if (lightboxWrappers.length === 0) return;
  const button = createBatchParseButton(cookedElement);
  const firstChild = cookedElement.firstChild;
  if (firstChild) cookedElement.insertBefore(button, firstChild);
  else cookedElement.appendChild(button);
}
function scanForCookedContent() {
  const cookedElements = document.querySelectorAll(".cooked");
  cookedElements.forEach((el) => {
    if (isCookedContent(el)) addBatchParseButtonToCooked(el);
  });
}
function observeCookedContent() {
  const observer = new MutationObserver((mutations) => {
    let shouldScan = false;
    mutations.forEach((m) => {
      if (m.type === "childList") {
        m.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node;
            if (element.classList && element.classList.contains("cooked")) shouldScan = true;
            else if (element.querySelector && element.querySelector(".cooked")) shouldScan = true;
          }
        });
      }
    });
    if (shouldScan) setTimeout(scanForCookedContent, 100);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
function isDiscoursePage() {
  var _a2;
  try {
    const gen = ((_a2 = document.querySelector('meta[name="generator"]')) == null ? void 0 : _a2.getAttribute("content")) || "";
    if (gen.toLowerCase().includes("discourse")) return true;
    if (document.querySelector('meta[name^="discourse_"]')) return true;
    if (document.getElementById("data-discourse-setup")) return true;
    if (document.querySelector('meta[name="discourse/config/environment"]')) return true;
    return false;
  } catch (e) {
    console.error("[DiscourseOneClick] isDiscoursePage check failed", e);
    return false;
  }
}
function initDiscourse() {
  try {
    if (!isDiscoursePage()) {
      console.log("[DiscourseOneClick] skipping init: not a Discourse page");
      return;
    }
    setTimeout(scanForMagnificPopup, 200);
    setTimeout(scanForCookedContent, 300);
    observeMagnificPopup();
    observeCookedContent();
  } catch (e) {
    console.error("[DiscourseOneClick] init failed", e);
  }
}
window.__emoji_discourse_init = initDiscourse;
if ((_b = (_a = window.chrome) == null ? void 0 : _a.runtime) == null ? void 0 : _b.onMessage) {
  window.chrome.runtime.onMessage.addListener(async (message, _sender) => {
    if (message && message.action === "uploadBlobToDiscourse") {
      try {
        const filename = message.filename || "image.jpg";
        const mimeType = message.mimeType || "image/jpeg";
        const arrayBuffer = message.arrayBuffer;
        if (!arrayBuffer) throw new Error("no arrayBuffer");
        const blob = new Blob([new Uint8Array(arrayBuffer)], { type: mimeType });
        const file = new File([blob], filename, { type: mimeType });
        const base = message.discourseBase || window.location.origin;
        const form = new FormData();
        form.append("upload_type", "composer");
        form.append("relativePath", "null");
        form.append("name", file.name);
        form.append("type", file.type);
        form.append("file", file, file.name);
        const meta = document.querySelector('meta[name="csrf-token"]');
        const csrf = meta ? meta.content : (document.cookie.match(/csrf_token=([^;]+)/) || [])[1] || "";
        const headers = {};
        if (csrf) headers["X-Csrf-Token"] = csrf;
        if (document.cookie) headers["Cookie"] = document.cookie;
        const uploadUrl = `${base.replace(/\/$/, "")}/uploads.json?client_id=f06cb5577ba9410d94b9faf94e48c2d8`;
        const resp = await fetch(uploadUrl, {
          method: "POST",
          headers,
          body: form,
          credentials: "include"
        });
        if (!resp.ok) {
          const data = await resp.json().catch(() => null);
          window.chrome.runtime.sendMessage({
            type: "UPLOAD_RESULT",
            success: false,
            details: data
          });
        } else {
          const data = await resp.json();
          window.chrome.runtime.sendMessage({
            type: "UPLOAD_RESULT",
            success: true,
            data
          });
        }
      } catch (e) {
        window.chrome.runtime.sendMessage({
          type: "UPLOAD_RESULT",
          success: false,
          error: String(e)
        });
      }
    }
  });
}
const cssAnimation = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
function injectCSSAnimation() {
  if (!document.getElementById("oneclick-add-styles")) {
    const style = document.createElement("style");
    style.id = "oneclick-add-styles";
    style.textContent = cssAnimation;
    document.head.appendChild(style);
  }
}
function initOneClickAdd() {
  console.log("[OneClickAdd] 初始化一键添加表情核心");
  injectCSSAnimation();
  try {
    initDiscourse();
  } catch (e) {
    console.error("[OneClickAdd] initDiscourse failed", e);
  }
}
function checkAndReinjectButtons() {
  const toolbars = findAllToolbars();
  toolbars.forEach((toolbar) => {
    if (!toolbar.querySelector(".emoji-extension-button") && !toolbar.querySelector(".image-upload-button")) {
      console.log("[Emoji Extension] Buttons missing after reply button click, re-injecting...");
      injectButton(toolbar);
    }
  });
}
function setupReplyButtonListeners() {
  const replyButtonSelectors = [
    // Topic footer reply button
    'button.btn.btn-icon-text.btn-primary.create.topic-footer-button[title*="回复"]',
    // Simple reply button (no text)
    'button.btn.no-text.btn-icon.btn-default.create.reply-to-post[title*="回复"]',
    // Post action menu reply button
    'button.btn.btn-icon-text.post-action-menu__reply.reply.create[title*="回复"]'
  ];
  document.addEventListener("click", (event) => {
    const target = event.target;
    const isReplyButton = replyButtonSelectors.some((selector) => {
      try {
        return target.matches(selector) || target.closest(selector);
      } catch (_e) {
        return false;
      }
    });
    if (isReplyButton) {
      console.log("[Emoji Extension] Reply button clicked, checking for injection needs...");
      setTimeout(() => {
        checkAndReinjectButtons();
      }, 500);
      setTimeout(() => {
        checkAndReinjectButtons();
      }, 2e3);
    }
  });
  const observer = new MutationObserver((mutations) => {
    let shouldCheck = false;
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node;
          const hasReplyButtons = replyButtonSelectors.some((selector) => {
            try {
              return element.matches(selector) || element.querySelector(selector);
            } catch (_e) {
              return false;
            }
          });
          if (hasReplyButtons) {
            shouldCheck = true;
          }
        }
      });
    });
    if (shouldCheck) {
      console.log("[Emoji Extension] Reply buttons detected in DOM changes, checking injection...");
      setTimeout(() => {
        checkAndReinjectButtons();
      }, 500);
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  console.log("[Emoji Extension] Reply button listeners initialized");
}
async function initializeEmojiFeature(maxInjectionAttempts = 10, delay = 1e3) {
  var _a2, _b2, _c2, _d2;
  console.log("[Emoji Extension] Initializing (module)...");
  await loadDataFromStorage();
  initOneClickAdd();
  setupReplyButtonListeners();
  let injectionAttempts = 0;
  function attemptInjection() {
    injectionAttempts++;
    const toolbars = findAllToolbars();
    let injectedCount = 0;
    toolbars.forEach((toolbar) => {
      if (!toolbar.querySelector(".emoji-extension-button") && !toolbar.querySelector(".image-upload-button")) {
        console.log("[Emoji Extension] Toolbar found, injecting buttons.");
        injectButton(toolbar);
        injectedCount++;
      }
    });
    if (injectedCount > 0 || toolbars.length > 0) {
      return;
    }
    if (injectionAttempts < maxInjectionAttempts) {
      console.log(
        `[Emoji Extension] Toolbar not found, attempt ${injectionAttempts}/${maxInjectionAttempts}. Retrying ${delay / 1e3} s.`
      );
      setTimeout(attemptInjection, delay);
    } else if (maxInjectionAttempts < 20) {
      initializeEmojiFeature(20, 2e3);
    } else if (maxInjectionAttempts < 40) {
      initializeEmojiFeature(40, 4e3);
    } else if (maxInjectionAttempts < 80) {
      initializeEmojiFeature(80, 8e3);
    } else if (maxInjectionAttempts < 160) {
      initializeEmojiFeature(160, 16e3);
    } else if (maxInjectionAttempts < 320) {
      initializeEmojiFeature(320, 32e3);
    } else if (maxInjectionAttempts < 640) {
      initializeEmojiFeature(640, 64e3);
    } else {
      console.error(
        "[Emoji Extension] Failed to find toolbar after multiple attempts. Button injection failed. 我感觉你是人机"
      );
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attemptInjection);
  } else {
    attemptInjection();
  }
  if ((_b2 = (_a2 = window.chrome) == null ? void 0 : _a2.storage) == null ? void 0 : _b2.onChanged) {
    window.chrome.storage.onChanged.addListener((changes, _namespace) => {
      if (_namespace === "local") {
        const relevantKeys = ["emojiGroups", "emojiGroupIndex", "appSettings"];
        const hasRelevant = Object.keys(changes).some(
          (k) => relevantKeys.includes(k) || k.startsWith("emojiGroup_")
        );
        if (hasRelevant) {
          console.log("[Emoji Extension] Storage change detected (module), reloading data");
          loadDataFromStorage();
        }
      }
    });
  }
  if ((_d2 = (_c2 = window.chrome) == null ? void 0 : _c2.runtime) == null ? void 0 : _d2.onMessage) {
    window.chrome.runtime.onMessage.addListener(
      (message, _sender, _sendResponse) => {
        if (message.type === "SETTINGS_UPDATED") {
          console.log("[Emoji Extension] Settings updated from background, reloading data");
          loadDataFromStorage();
        }
      }
    );
  }
  setInterval(() => {
    const toolbars = findAllToolbars();
    toolbars.forEach((toolbar) => {
      if (!toolbar.querySelector(".emoji-extension-button") && !toolbar.querySelector(".image-upload-button")) {
        console.log("[Emoji Extension] Toolbar found but buttons missing, injecting... (module)");
        injectButton(toolbar);
      }
    });
  }, 3e4);
  setInterval(() => {
    console.log("[Emoji Extension] Periodic data reload (module)");
    loadDataFromStorage();
  }, 12e4);
}
function Uninject() {
  function requestBackgroundInject(pageType) {
    try {
      if (window.chrome && window.chrome.runtime && window.chrome.runtime.sendMessage) {
        ;
        window.chrome.runtime.sendMessage({ action: "requestInject", pageType }, (response) => {
          if (response && response.success) {
            console.log("[Uninject] background injected content for", pageType);
          } else {
            let respLog = "no response";
            try {
              if (response && typeof response === "object") {
                if (response.error) respLog = String(response.error);
                else if (response.message) respLog = String(response.message);
                else respLog = safeStringify$1(response);
              } else if (response !== void 0) {
                respLog = String(response);
              }
            } catch (e) {
              respLog = String(e);
            }
            console.warn("[Uninject] background failed to inject for", pageType, respLog);
          }
        });
      } else {
        console.warn("[Uninject] chrome.runtime not available; cannot request background inject for", pageType);
      }
    } catch (e) {
      console.error("[Uninject] requestInject failed for", pageType, e);
    }
  }
  requestBackgroundInject("pixiv");
  requestBackgroundInject("bilibili");
  requestBackgroundInject("x");
}
function safeStringify$1(obj) {
  const seen = /* @__PURE__ */ new WeakSet();
  return JSON.stringify(obj, function(_key, value) {
    if (value && typeof value === "object") {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);
    }
    return value;
  });
}
function safeStringify(obj) {
  const seen = /* @__PURE__ */ new WeakSet();
  return JSON.stringify(obj, function(_key, value) {
    if (value && typeof value === "object") {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);
    }
    return value;
  });
}
console.log("[Emoji Extension] Content autodetect loader");
function shouldInjectEmoji() {
  var _a2;
  try {
    const discourseMetaTags = document.querySelectorAll(
      'meta[name*="discourse"], meta[content*="discourse"], meta[property*="discourse"]'
    );
    if (discourseMetaTags.length > 0) return true;
    const generatorMeta = document.querySelector('meta[name="generator"]');
    if (generatorMeta) {
      const content = ((_a2 = generatorMeta.getAttribute("content")) == null ? void 0 : _a2.toLowerCase()) || "";
      if (content.includes("discourse") || content.includes("flarum") || content.includes("phpbb")) return true;
    }
    const hostname = window.location.hostname.toLowerCase();
    const allowedDomains = ["linux.do", "meta.discourse.org"];
    if (allowedDomains.some((domain) => hostname.includes(domain))) return true;
    const editors = document.querySelectorAll(
      "textarea.d-editor-input, .ProseMirror.d-editor-input, .composer-input, .reply-area textarea"
    );
    if (editors.length > 0) return true;
    return false;
  } catch (e) {
    console.error("[Emoji Extension] shouldInjectEmoji failed", e);
    return false;
  }
}
if (shouldInjectEmoji()) {
  let detectPageType = function() {
    try {
      const hostname = window.location.hostname.toLowerCase();
      if (hostname.includes("bilibili")) return "bilibili";
      if (hostname.includes("pixiv")) return "pixiv";
      if (hostname.includes("twitter") || hostname.includes("x.com")) return "x";
      const discourseMeta = document.querySelectorAll('meta[name*="discourse"], meta[content*="discourse"]').length;
      if (discourseMeta > 0) return "discourse";
      return "generic";
    } catch (e) {
      return "generic";
    }
  };
  console.log("[Emoji Extension] autodetect: requesting background to inject content");
  const pageType = detectPageType();
  if (window.chrome && window.chrome.runtime && window.chrome.runtime.sendMessage) {
    try {
      ;
      window.chrome.runtime.sendMessage({ action: "requestInject", pageType }, (response) => {
        if (response && response.success) {
          console.log("[Emoji Extension] background injected content:", response.message);
        } else {
          let respLog = "no response";
          try {
            if (response && typeof response === "object") {
              if (response.error) respLog = String(response.error);
              else if (response.message) respLog = String(response.message);
              else respLog = safeStringify(response);
            } else if (response !== void 0) {
              respLog = String(response);
            }
          } catch (e) {
            respLog = String(e);
          }
          console.warn("[Emoji Extension] background failed to inject, falling back to local init", respLog);
          initializeEmojiFeature();
        }
      });
    } catch (e) {
      console.warn("[Emoji Extension] sendMessage failed, falling back to local init", e);
      initializeEmojiFeature();
    }
  } else {
    console.warn("[Emoji Extension] chrome.runtime not available in content script; running local init");
    initializeEmojiFeature();
  }
} else {
  Uninject();
  console.log("[Emoji Extension] autodetect: skipping injection - incompatible platform");
}
if (window.location.hostname.includes("linux.do") && ((_d = (_c = window.chrome) == null ? void 0 : _c.runtime) == null ? void 0 : _d.onMessage)) {
  window.chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "GET_CSRF_TOKEN") {
      try {
        const metaToken = document.querySelector('meta[name="csrf-token"]');
        if (metaToken) {
          sendResponse({ csrfToken: metaToken.content });
          return true;
        }
        const match = document.cookie.match(/csrf_token=([^;]+)/);
        if (match) {
          sendResponse({ csrfToken: decodeURIComponent(match[1]) });
          return true;
        }
        const hiddenInput = document.querySelector('input[name="authenticity_token"]');
        if (hiddenInput) {
          sendResponse({ csrfToken: hiddenInput.value });
          return true;
        }
        sendResponse({ csrfToken: "" });
        return true;
      } catch (error) {
        console.warn("[Emoji Extension] Failed to get CSRF token:", error);
        sendResponse({ csrfToken: "" });
        return true;
      }
    }
    return false;
  });
}
