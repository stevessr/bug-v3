// Enhanced content script for Linux.do emoji injection
// Updated to use new storage system with conflict resolution

// Chrome API declaration for content script context
declare const chrome: any;

// Global state
let cachedEmojiGroups: any[] = [];
let cachedSettings: any = { imageScale: 30, gridColumns: 4 };
import { getDefaultEmojis } from "./default";

// Storage system adapter for content script
import { ContentStorageAdapter } from "./ContentStorageAdapter";

const contentStorage = new ContentStorageAdapter();

// Storage sync functionality using new storage system
async function loadDataFromStorage() {
  try {
    console.log('[Emoji Extension] Loading data using new storage system');
    
    // Load groups using new storage system
    const groups = await contentStorage.getAllEmojiGroups();
    console.log('[Emoji Extension] Loaded groups from storage:', groups?.length || 0);
    
    if (Array.isArray(groups) && groups.length > 0) {
      // Validate that groups have valid emoji data
      let validGroups = 0;
      let totalEmojis = 0;
      
      groups.forEach(group => {
        if (group && group.emojis && Array.isArray(group.emojis)) {
          validGroups++;
          totalEmojis += group.emojis.length;
        }
      });
      
      if (validGroups > 0 && totalEmojis > 0) {
        cachedEmojiGroups = groups;
        console.log(`[Emoji Extension] Successfully loaded ${validGroups} valid groups with ${totalEmojis} total emojis`);
      } else {
        console.warn('[Emoji Extension] Groups exist but contain no valid emojis, using defaults');
        cachedEmojiGroups = [];
      }
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

    // Final validation and fallback
    let finalEmojisCount = 0;
    if (Array.isArray(cachedEmojiGroups)) {
      cachedEmojiGroups.forEach(group => {
        if (group?.emojis?.length) {
          finalEmojisCount += group.emojis.length;
        }
      });
    }

    console.log('[Emoji Extension] Final cache state:', {
      groupsCount: cachedEmojiGroups.length,
      emojisCount: finalEmojisCount,
      settings: cachedSettings
    });

  } catch (error) {
    console.error('[Emoji Extension] Failed to load from storage:', error);
    // Ensure we have valid arrays even if loading fails
    cachedEmojiGroups = [];
    cachedSettings = { imageScale: 30, gridColumns: 4 };
  }
}


console.log("[Emoji Extension] Content script loaded");

function initializeEmojiFeature() {
  console.log("[Emoji Extension] Initializing...");

  // Load data from storage first
  loadDataFromStorage().then(() => {
    console.log("[Emoji Extension] Data loaded from storage, proceeding to inject features");

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        setTimeout(injectFeatures, 500);
      });
    } else {
      setTimeout(injectFeatures, 500);
    }
  }).catch(error => {
    console.error("[Emoji Extension] Failed to load data, proceeding with defaults:", error);
    // Even if loading fails, still try to inject features with defaults
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

  button.addEventListener("click", async (event) => {
    event.stopPropagation();

    if (currentPicker) {
      currentPicker.remove();
      currentPicker = null;
      document.removeEventListener("click", handleClickOutside);
      return;
    }

    // Create picker asynchronously to ensure fresh data
    currentPicker = await createEmojiPicker();

    // Position picker relative to button like simple.js
    const buttonRect = button.getBoundingClientRect();
    const pickerElement = currentPicker;

    // Add to body first to get dimensions
    if (pickerElement) {
      document.body.appendChild(pickerElement);
    }

    // Position similar to simple.js logic
    const isOnMobile = /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(
      navigator.userAgent
    );
    const replyControl = document.querySelector("#reply-control");

    if (pickerElement) {
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

async function createEmojiPicker(): Promise<HTMLElement> {
  // Refresh emoji data before creating picker to include latest favorites
  console.log('[Emoji Extension] Refreshing emoji data before creating picker');
  await loadDataFromStorage();
  
  // Get current groups data instead of all emojis
  console.log('[Emoji Extension] Creating picker with groups:', cachedEmojiGroups?.length || 0);
  
  // Validate we have groups and emojis
  let hasValidData = false;
  let totalEmojis = 0;
  let groupsToUse = cachedEmojiGroups;
  
  if (Array.isArray(cachedEmojiGroups) && cachedEmojiGroups.length > 0) {
    cachedEmojiGroups.forEach(group => {
      if (group?.emojis?.length > 0) {
        hasValidData = true;
        totalEmojis += group.emojis.length;
      }
    });
  }
  
  // If no valid cached data, create a default group
  if (!hasValidData || totalEmojis === 0) {
    console.warn('[Emoji Extension] No valid groups/emojis in cache, using default emojis');
    
    const defaultEmojis = getDefaultEmojis();
    groupsToUse = [{
      id: 'default',
      name: '默认表情',
      icon: '😀',
      order: 0,
      emojis: defaultEmojis
    }];
    
    totalEmojis = defaultEmojis.length;
    hasValidData = true;
  }

  console.log(`[Emoji Extension] Creating picker with ${groupsToUse.length} groups and ${totalEmojis} total emojis`);

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

  // Section navigation - create buttons for each group
  const sectionsNav = document.createElement("div");
  sectionsNav.className = "emoji-picker__sections-nav";

  // Create navigation buttons for each group
  groupsToUse.forEach((group, index) => {
    if (group?.emojis?.length > 0) {
  const navButton = document.createElement("button");
      navButton.className = `btn no-text btn-flat emoji-picker__section-btn ${index === 0 ? 'active' : ''}`;
      navButton.setAttribute("tabindex", "-1");
      navButton.setAttribute("data-section", group.id);
      navButton.type = "button";
      // Render icon: if it's an image URL, create an <img>, otherwise use text
      const iconVal = group.icon || "📁";
      const isImage = (val: any) => {
        try {
          const u = new URL(val);
          return (u.protocol === 'http:' || u.protocol === 'https:') && /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(u.pathname);
        } catch (e) {
          return false;
        }
      }
      if (isImage(iconVal)) {
        const img = document.createElement('img');
        img.src = iconVal;
        img.alt = group.name || '';
        img.className = 'emoji-group-icon';
        img.style.width = '18px';
        img.style.height = '18px';
        img.style.objectFit = 'contain';
        navButton.appendChild(img);
      } else {
        navButton.textContent = String(iconVal);
      }
      navButton.title = group.name;
      
      // Add click handler for navigation
      navButton.addEventListener('click', () => {
        // Remove active class from all buttons
        sectionsNav.querySelectorAll('.emoji-picker__section-btn').forEach(btn => {
          btn.classList.remove('active');
        });
        // Add active class to clicked button
        navButton.classList.add('active');
        
        // Scroll to corresponding section
        const targetSection = sections.querySelector(`[data-section="${group.id}"]`);
        if (targetSection) {
          targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
      
      sectionsNav.appendChild(navButton);
    }
  });

  // Scrollable content
  const scrollableContent = document.createElement("div");
  scrollableContent.className = "emoji-picker__scrollable-content";

  const sections = document.createElement("div");
  sections.className = "emoji-picker__sections";
  sections.setAttribute("role", "button");

  // Create sections for each group
  groupsToUse.forEach((group) => {
    if (group?.emojis?.length > 0) {
      console.log(`[Emoji Extension] Creating section for group: ${group.name} with ${group.emojis.length} emojis`);
      
      // Create section
      const section = document.createElement("div");
      section.className = "emoji-picker__section";
      section.setAttribute("data-section", group.id);
      section.setAttribute("role", "region");
      section.setAttribute("aria-label", group.name);

      // Section title
      const titleContainer = document.createElement("div");
      titleContainer.className = "emoji-picker__section-title-container";

      const title = document.createElement("h2");
      title.className = "emoji-picker__section-title";
      title.textContent = group.name;

      titleContainer.appendChild(title);

      // Section emojis
      const sectionEmojis = document.createElement("div");
      sectionEmojis.className = "emoji-picker__section-emojis";

      // Populate with emojis from this group
      let addedEmojis = 0;
      
      group.emojis.forEach((emoji: any, index: number) => {
        // Ensure emoji object has required properties
        if (!emoji || typeof emoji !== 'object') {
          console.warn(`[Emoji Extension] Skipping invalid emoji at index ${index} in group ${group.name}:`, emoji);
          return;
        }
        
        if (!emoji.url || !emoji.name) {
          console.warn(`[Emoji Extension] Skipping emoji with missing url/name at index ${index} in group ${group.name}:`, emoji);
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
        addedEmojis++;
      });
      
      console.log(`[Emoji Extension] Added ${addedEmojis} emojis to section ${group.name}`);
      
      if (addedEmojis === 0) {
        // Group has no valid emojis, show message
        const noEmojisMsg = document.createElement("div");
        noEmojisMsg.textContent = `${group.name} 组暂无有效表情`;
        noEmojisMsg.style.cssText = "padding: 20px; text-align: center; color: #999;";
        sectionEmojis.appendChild(noEmojisMsg);
      }

      // Assemble section
      section.appendChild(titleContainer);
      section.appendChild(sectionEmojis);
      sections.appendChild(section);
    }
  });

  // Search functionality - search across all sections
  searchInput.addEventListener("input", (e) => {
    const query = (e.target as HTMLInputElement).value.toLowerCase();
    const allImages = sections.querySelectorAll("img");

    allImages.forEach((img) => {
      const emojiName = img.getAttribute("data-emoji")?.toLowerCase() || "";
      if (query === "" || emojiName.includes(query)) {
        (img as HTMLElement).style.display = "";
      } else {
        (img as HTMLElement).style.display = "none";
      }
    });
    
    // Show/hide section titles based on whether they have visible emojis
    const allSections = sections.querySelectorAll(".emoji-picker__section");
    allSections.forEach((section) => {
      const visibleEmojis = section.querySelectorAll("img:not([style*='none'])");
      const titleContainer = section.querySelector(".emoji-picker__section-title-container");
      if (titleContainer) {
        (titleContainer as HTMLElement).style.display = visibleEmojis.length > 0 ? "" : "none";
      }
    });
  });

  // Assemble structure
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

  // Add emoji to favorites automatically
  chrome.runtime.sendMessage({
    action: "addToFavorites",
    emoji: emoji
  }).catch((error: any) => {
    console.log("[Emoji Extension] Failed to add to favorites:", error);
  });

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
  chrome.storage.onChanged.addListener((changes: any, namespace: string) => {
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
    console.log('[Emoji Extension] Toolbar found but button missing, injecting...');
    injectButton(toolbar);
  }
}, 30000);

// Reload data every 2 minutes to stay in sync with backend storage
setInterval(() => {
  console.log('[Emoji Extension] Periodic data reload');
  loadDataFromStorage();
}, 120000);

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
