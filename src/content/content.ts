// Enhanced content script for Linux.do emoji injection
// Updated to use new storage system with conflict resolution
// Global state
let cachedEmojiGroups: any[] = [];
let cachedSettings: any = { imageScale: 30, gridColumns: 4 };
import { getDefaultEmojis } from "./default";

// Storage system adapter for content script
class ContentStorageAdapter {
  // Read from extension storage with fallback to local/session storage
  async get(key: string): Promise<any> {
    // Try extension storage first (main source for content scripts)
    if (chrome?.storage?.local) {
      try {
        const result = await chrome.storage.local.get({ [key]: null });
        const value = result[key];
        if (value && value.data) {
          console.log(`[Content Storage] Found ${key} in extension storage`);
          return value.data;
        }
      } catch (error) {
        console.warn(`[Content Storage] Extension storage failed for ${key}:`, error);
      }
    }

    // Fallback to localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        const value = localStorage.getItem(key);
        if (value) {
          const parsed = JSON.parse(value);
          if (parsed && parsed.data) {
            console.log(`[Content Storage] Found ${key} in localStorage`);
            return parsed.data;
          }
        }
      }
    } catch (error) {
      console.warn(`[Content Storage] localStorage failed for ${key}:`, error);
    }

    // Fallback to sessionStorage
    try {
      if (typeof sessionStorage !== 'undefined') {
        const value = sessionStorage.getItem(key);
        if (value) {
          const parsed = JSON.parse(value);
          if (parsed && parsed.data) {
            console.log(`[Content Storage] Found ${key} in sessionStorage`);
            return parsed.data;
          }
        }
      }
    } catch (error) {
      console.warn(`[Content Storage] sessionStorage failed for ${key}:`, error);
    }

    console.log(`[Content Storage] No data found for ${key}`);
    return null;
  }

  async getAllEmojiGroups(): Promise<any[]> {
    // First try to get the group index
    const groupIndex = await this.get('emojiGroupIndex');
    if (groupIndex && Array.isArray(groupIndex)) {
      const groups = [];
      for (const groupInfo of groupIndex) {
        const group = await this.get(`emojiGroup_${groupInfo.id}`);
        if (group) {
          groups.push({ ...group, order: groupInfo.order });
        }
      }
      if (groups.length > 0) {
        return groups.sort((a, b) => a.order - b.order);
      }
    }

    // Fallback to legacy emojiGroups key
    const legacyGroups = await this.get('emojiGroups');
    if (legacyGroups && Array.isArray(legacyGroups)) {
      return legacyGroups;
    }

    return [];
  }

  async getSettings(): Promise<any> {
    const settings = await this.get('appSettings');
    return settings || { imageScale: 30, gridColumns: 4 };
  }
}

const contentStorage = new ContentStorageAdapter();

// Storage sync functionality using new storage system
async function loadDataFromStorage() {
  try {
    console.log('[Emoji Extension] Loading data using new storage system');
    
    // Load groups using new storage system
    const groups = await contentStorage.getAllEmojiGroups();
    if (Array.isArray(groups) && groups.length > 0) {
      cachedEmojiGroups = groups;
      console.log('[Emoji Extension] Loaded groups:', groups.length);
    } else {
      console.warn('[Emoji Extension] No valid emoji groups found, using defaults');
      cachedEmojiGroups = [];
    }

    // Load settings
    const settings = await contentStorage.getSettings();
    if (settings && typeof settings === 'object') {
      cachedSettings = { ...cachedSettings, ...settings };
      console.log('[Emoji Extension] Loaded settings:', cachedSettings);
    }

    console.log('[Emoji Extension] Final cache state:', {
      groupsCount: cachedEmojiGroups.length,
      settings: cachedSettings
    });

  } catch (error) {
    console.error('[Emoji Extension] Failed to load from storage:', error);
    // Ensure we have valid arrays even if loading fails
    cachedEmojiGroups = [];
    cachedSettings = { imageScale: 30, gridColumns: 4 };
  }
}

// Get all emojis from cached groups
function getAllEmojis() {
  const allEmojis: any[] = [];

  // Ensure cachedEmojiGroups is an array before calling forEach
  if (Array.isArray(cachedEmojiGroups)) {
    cachedEmojiGroups.forEach((group) => {
      if (group && group.emojis && Array.isArray(group.emojis)) {
        allEmojis.push(...group.emojis);
      }
    });
  }

  // Fallback to default if no emojis loaded
  if (allEmojis.length === 0) {
    return getDefaultEmojis();
  }

  return allEmojis;
}

console.log("[Emoji Extension] Content script loaded");

function initializeEmojiFeature() {
  console.log("[Emoji Extension] Initializing...");

  // Load data from storage first
  loadDataFromStorage().then(() => {
    console.log("[Emoji Extension] Data loaded from storage");

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        setTimeout(injectFeatures, 500);
      });
    } else {
      setTimeout(injectFeatures, 500);
    }
  });
}

function injectFeatures() {
  const toolbar = findToolbar();
  if (toolbar && !document.querySelector(".nacho-emoji-picker-button")) {
    injectButton(toolbar);
  }
}

function findToolbar(): Element | null {
  const toolbar = document.querySelector(
    '.d-editor-button-bar[role="toolbar"]'
  );
  if (toolbar) {
    console.log("[Emoji Extension] Found toolbar");
    return toolbar;
  }

  console.log("[Emoji Extension] Toolbar not found");
  return null;
}

function injectButton(toolbar: Element) {
  console.log("[Emoji Extension] Injecting button into toolbar");

  const button = document.createElement("button");
  button.classList.add(
    "btn",
    "no-text",
    "btn-icon",
    "toolbar__button",
    "nacho-emoji-picker-button",
    "emoji-extension-button"
  );
  button.title = "表情包";
  button.type = "button";
  button.innerHTML = `🐈‍⬛`;

  let currentPicker: HTMLElement | null = null;

  button.addEventListener("click", (event) => {
    event.stopPropagation();

    if (currentPicker) {
      currentPicker.remove();
      currentPicker = null;
      document.removeEventListener("click", handleClickOutside);
      return;
    }

    currentPicker = createEmojiPicker();

    // Position picker relative to button like simple.js
    const buttonRect = button.getBoundingClientRect();
    const pickerElement = currentPicker;

    // Add to body first to get dimensions
    document.body.appendChild(pickerElement);

    // Position similar to simple.js logic
    const isOnMobile = /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(
      navigator.userAgent
    );
    const replyControl = document.querySelector("#reply-control");

    if (isOnMobile && replyControl) {
      const replyRect = replyControl.getBoundingClientRect();
      pickerElement.style.position = "fixed";
      pickerElement.style.bottom =
        window.innerHeight - replyRect.top + 5 + "px";
      pickerElement.style.left = replyRect.left + "px";
      pickerElement.style.right = replyRect.right + "px";
    } else {
      const editorWrapper = document.querySelector(
        ".d-editor-textarea-wrapper"
      );
      if (editorWrapper) {
        const editorRect = editorWrapper.getBoundingClientRect();
        const isMinireply =
          replyControl?.className.includes("hide-preview") &&
          window.innerWidth < 1600;

        pickerElement.style.position = "fixed";

        if (isMinireply) {
          // Center above editor
          pickerElement.style.bottom =
            window.innerHeight - editorRect.top + 10 + "px";
          pickerElement.style.left =
            editorRect.left + editorRect.width / 2 - 200 + "px";
        } else {
          // Position above the button, centered
          const pickerRect = pickerElement.getBoundingClientRect();
          pickerElement.style.top =
            buttonRect.top - pickerRect.height - 5 + "px";
          pickerElement.style.left =
            buttonRect.left +
            buttonRect.width / 2 -
            pickerRect.width / 2 +
            "px";

          // Fallback to below if not enough space on top
          if (pickerElement.getBoundingClientRect().top < 0) {
            pickerElement.style.top = buttonRect.bottom + 5 + "px";
          }
        }
      } else {
        // Fallback positioning
        pickerElement.style.position = "fixed";
        pickerElement.style.top = buttonRect.bottom + 5 + "px";
        pickerElement.style.left = buttonRect.left + "px";
      }
    }

    setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 100);
  });

  function handleClickOutside(e: Event) {
    if (
      currentPicker &&
      !currentPicker.contains(e.target as Node) &&
      e.target !== button
    ) {
      currentPicker.remove();
      currentPicker = null;
      document.removeEventListener("click", handleClickOutside);
    }
  }

  try {
    toolbar.appendChild(button);
    console.log("[Emoji Extension] Button injected successfully");
  } catch (e) {
    console.error("[Emoji Extension] Failed to inject button:", e);
  }
}

function createEmojiPicker(): HTMLElement {
  // Get current emoji data with proper validation
  const allEmojis = getAllEmojis();
  console.log('[Emoji Extension] Creating picker with emojis:', allEmojis?.length || 0);
  
  // Validate we have emojis
  if (!Array.isArray(allEmojis) || allEmojis.length === 0) {
    console.warn('[Emoji Extension] No valid emojis available for picker');
    // Return a minimal error div
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'padding: 20px; text-align: center; color: #666;';
    errorDiv.textContent = '暂无表情数据';
    return errorDiv;
  }

  // Create picker following simple.html structure
  const picker = document.createElement("div");
  picker.className = "fk-d-menu -animated -expanded";
  picker.setAttribute("data-identifier", "emoji-picker");
  picker.setAttribute("data-content", "");
  picker.setAttribute("aria-labelledby", "emoji-picker-label");
  picker.setAttribute("aria-expanded", "true");
  picker.setAttribute("role", "dialog");
  picker.style.cssText =
    "max-width: 400px; visibility: visible; z-index: 999999;";
  picker.setAttribute("data-strategy", "absolute");
  picker.setAttribute("data-placement", "top");

  const innerContent = document.createElement("div");
  innerContent.className = "fk-d-menu__inner-content";

  const emojiPickerDiv = document.createElement("div");
  emojiPickerDiv.className = "emoji-picker";

  // Filter container with search
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

  // Content area
  const content = document.createElement("div");
  content.className = "emoji-picker__content";

  // Section navigation
  const sectionsNav = document.createElement("div");
  sectionsNav.className = "emoji-picker__sections-nav";

  const favButton = document.createElement("button");
  favButton.className = "btn no-text btn-flat emoji-picker__section-btn active";
  favButton.setAttribute("tabindex", "-1");
  favButton.setAttribute("data-section", "favorites");
  favButton.type = "button";
  favButton.innerHTML = "⭐";

  sectionsNav.appendChild(favButton);

  // Scrollable content
  const scrollableContent = document.createElement("div");
  scrollableContent.className = "emoji-picker__scrollable-content";

  const sections = document.createElement("div");
  sections.className = "emoji-picker__sections";
  sections.setAttribute("role", "button");

  // Create section
  const section = document.createElement("div");
  section.className = "emoji-picker__section";
  section.setAttribute("data-section", "favorites");
  section.setAttribute("role", "region");
  section.setAttribute("aria-label", "表情");

  // Section title
  const titleContainer = document.createElement("div");
  titleContainer.className = "emoji-picker__section-title-container";

  const title = document.createElement("h2");
  title.className = "emoji-picker__section-title";
  title.textContent = "表情";

  titleContainer.appendChild(title);

  // Section emojis
  const sectionEmojis = document.createElement("div");
  sectionEmojis.className = "emoji-picker__section-emojis";

  // Populate with emojis - Additional safety check
  if (Array.isArray(allEmojis) && allEmojis.length > 0) {
    allEmojis.forEach((emoji) => {
      // Ensure emoji object has required properties
      if (!emoji || typeof emoji !== 'object' || !emoji.url || !emoji.name) {
        console.warn('[Emoji Extension] Skipping invalid emoji:', emoji);
        return;
      }
      
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
    });
  } else {
    // Add fallback message if no emojis are available
    const noEmojisMsg = document.createElement("div");
    noEmojisMsg.textContent = "暂无表情数据";
    noEmojisMsg.style.cssText = "padding: 20px; text-align: center; color: #666;";
    sectionEmojis.appendChild(noEmojisMsg);
  }

  // Search functionality
  searchInput.addEventListener("input", (e) => {
    const query = (e.target as HTMLInputElement).value.toLowerCase();
    const images = sectionEmojis.querySelectorAll("img");

    images.forEach((img) => {
      const emojiName = img.getAttribute("data-emoji")?.toLowerCase() || "";
      if (query === "" || emojiName.includes(query)) {
        (img as HTMLElement).style.display = "";
      } else {
        (img as HTMLElement).style.display = "none";
      }
    });
  });

  // Assemble structure
  section.appendChild(titleContainer);
  section.appendChild(sectionEmojis);
  sections.appendChild(section);
  scrollableContent.appendChild(sections);
  content.appendChild(sectionsNav);
  content.appendChild(scrollableContent);
  emojiPickerDiv.appendChild(filterContainer);
  emojiPickerDiv.appendChild(content);
  innerContent.appendChild(emojiPickerDiv);
  picker.appendChild(innerContent);

  return picker;
}

function insertEmojiIntoEditor(emoji: any) {
  console.log("[Emoji Extension] Inserting emoji:", emoji);

  const textArea = document.querySelector(
    "textarea.d-editor-input"
  ) as HTMLTextAreaElement;
  const richEle = document.querySelector(
    ".ProseMirror.d-editor-input"
  ) as HTMLElement;

  if (!textArea && !richEle) {
    console.error("找不到输入框");
    return;
  }

  // Get dimensions (following simple.js logic exactly)
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

  // Use current settings scale
  const scale = cachedSettings.imageScale || 30;

  if (textArea) {
    // Markdown format exactly like simple.js
    const emojiMarkdown = `![${emoji.name}|${width}x${height},${scale}%](${emoji.url}) `;
    const startPos = textArea.selectionStart;
    const endPos = textArea.selectionEnd;
    textArea.value =
      textArea.value.substring(0, startPos) +
      emojiMarkdown +
      textArea.value.substring(endPos, textArea.value.length);

    textArea.selectionStart = textArea.selectionEnd =
      startPos + emojiMarkdown.length;
    textArea.focus();

    const event = new Event("input", { bubbles: true, cancelable: true });
    textArea.dispatchEvent(event);
  } else if (richEle) {
    // Rich text format exactly like simple.js
    const numericWidth = Number(width) || 500;
    const pixelWidth = Math.max(1, Math.round(numericWidth * (scale / 100)));
    const imgTemplate = `<img src="${emoji.url}" alt="${emoji.name}" width="${width}" height="${height}" data-scale="${scale}" style="width: ${pixelWidth}px">`;

    try {
      const dt = new DataTransfer();
      dt.setData("text/html", imgTemplate);
      const evt = new ClipboardEvent("paste", {
        clipboardData: dt,
        bubbles: true,
      });
      richEle.dispatchEvent(evt);
    } catch (_) {
      try {
        document.execCommand("insertHTML", false, imgTemplate);
      } catch (e) {
        console.error("无法向富文本编辑器中插入表情", e);
      }
    }
  }
}

// Storage sync listener - updated for new storage system
if (chrome?.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local") {
      // Handle new storage system keys
      const relevantKeys = [
        'emojiGroups', 'emojiGroupIndex', 'appSettings'
      ];
      
      const hasRelevantChanges = Object.keys(changes).some(key => 
        relevantKeys.includes(key) || key.startsWith('emojiGroup_')
      );

      if (hasRelevantChanges) {
        console.log('[Emoji Extension] Storage change detected, reloading data');
        // Reload all data when any relevant storage changes
        loadDataFromStorage();
      }
    }
  });
}

// Initialize with interval checking and reload data periodically
setInterval(() => {
  const toolbar = document.querySelector(
    '.d-editor-button-bar[role="toolbar"]'
  );
  if (toolbar && !document.querySelector(".nacho-emoji-picker-button")) {
    injectButton(toolbar);
  }

  // Reload data every 30 seconds to stay in sync
  loadDataFromStorage();
}, 30000);

// More frequent check for toolbar injection
setInterval(() => {
  const toolbar = document.querySelector(
    '.d-editor-button-bar[role="toolbar"]'
  );
  if (toolbar && !document.querySelector(".nacho-emoji-picker-button")) {
    injectButton(toolbar);
  }
}, 500);

// Also initialize on load
initializeEmojiFeature();

() => {};
