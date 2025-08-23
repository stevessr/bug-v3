import { createEmojiPicker, isMobile } from "./picker";
import { cachedState } from "./state";
import { showImageUploadDialog } from "./uploader";

// Different toolbar selectors for different contexts
const TOOLBAR_SELECTORS = [
  '.d-editor-button-bar[role="toolbar"]', // Standard editor toolbar
  '.chat-composer__inner-container', // Chat composer
];

export function findToolbar(): Element | null {
  for (const selector of TOOLBAR_SELECTORS) {
    const toolbar = document.querySelector(selector);
    if (toolbar) {
      return toolbar;
    }
  }
  return null;
}

export function findAllToolbars(): Element[] {
  const toolbars: Element[] = [];
  for (const selector of TOOLBAR_SELECTORS) {
    const elements = document.querySelectorAll(selector);
    toolbars.push(...Array.from(elements));
  }
  return toolbars;
}

let currentPicker: HTMLElement | null = null;

function handleClickOutside(e: Event, button: HTMLElement) {
  if (
    currentPicker &&
    !currentPicker.contains(e.target as Node) &&
    e.target !== button
  ) {
    currentPicker.remove();
    currentPicker = null;
    document.removeEventListener("click", (event) =>
      handleClickOutside(event, button)
    );
  }
}

async function injectDesktopPicker(button: HTMLElement) {
  currentPicker = await createEmojiPicker(false);
  const buttonRect = button.getBoundingClientRect();
  const pickerElement = currentPicker;
  if (pickerElement) document.body.appendChild(pickerElement);

  const editorWrapper = document.querySelector(".d-editor-textarea-wrapper");
  if (editorWrapper) {
    const editorRect = editorWrapper.getBoundingClientRect();
    const replyControl = document.querySelector("#reply-control");
    const isMinireply =
      replyControl?.className.includes("hide-preview") &&
      window.innerWidth < 1600;
    pickerElement.style.position = "fixed";
    if (isMinireply) {
      pickerElement.style.bottom =
        window.innerHeight - editorRect.top + 10 + "px";
      pickerElement.style.left =
        editorRect.left + editorRect.width / 2 - 200 + "px";
    } else {
      const pickerRect = pickerElement.getBoundingClientRect();
      pickerElement.style.top = buttonRect.top - pickerRect.height - 5 + "px";
      pickerElement.style.left =
        buttonRect.left + buttonRect.width / 2 - pickerRect.width / 2 + "px";
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
    document.addEventListener("click", (event) =>
      handleClickOutside(event, button)
    );
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

  modalContainer.innerHTML = ""; // Clear any previous content

  const backdrop = document.createElement("div");
  backdrop.className = "d-modal__backdrop";
  backdrop.addEventListener("click", () => {
    modalContainer.remove();
    currentPicker = null;
  });

  modalContainer.appendChild(picker);
  modalContainer.appendChild(backdrop);

  currentPicker = modalContainer as HTMLElement;
}

function createUploadMenu(): HTMLElement {
  const menu = document.createElement('div');
  menu.className = 'upload-menu';
  menu.style.cssText = `
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    padding: 8px 0;
    min-width: 180px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  const uploadOption = document.createElement('div');
  uploadOption.className = 'upload-option';
  uploadOption.style.cssText = `
    padding: 12px 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    transition: background-color 0.2s;
  `;
  uploadOption.innerHTML = `
    <span style="margin-right: 8px;">📁</span>
    <span>上传本地图片</span>
  `;
  uploadOption.addEventListener('mouseenter', () => {
    uploadOption.style.backgroundColor = '#f5f5f5';
  });
  uploadOption.addEventListener('mouseleave', () => {
    uploadOption.style.backgroundColor = 'transparent';
  });
  uploadOption.addEventListener('click', async () => {
    menu.remove();
    await showImageUploadDialog();
  });

  const generateOption = document.createElement('div');
  generateOption.className = 'upload-option';
  generateOption.style.cssText = uploadOption.style.cssText;
  generateOption.innerHTML = `
    <span style="margin-right: 8px;">🎨</span>
    <span>AI 生成图片</span>
  `;
  generateOption.addEventListener('mouseenter', () => {
    generateOption.style.backgroundColor = '#f5f5f5';
  });
  generateOption.addEventListener('mouseleave', () => {
    generateOption.style.backgroundColor = 'transparent';
  });
  generateOption.addEventListener('click', () => {
    menu.remove();
    // Open image generator in new tab
    window.open(chrome.runtime.getURL('image-generator.html'), '_blank');
  });

  menu.appendChild(uploadOption);
  menu.appendChild(generateOption);

  return menu;
}

export function injectButton(toolbar: Element) {
  // Check if we already injected buttons in this toolbar
  if (toolbar.querySelector(".emoji-extension-button") || toolbar.querySelector(".image-upload-button")) {
    return;
  }

  const isChatComposer = toolbar.classList.contains('chat-composer__inner-container');
  
  // Create emoji button
  const emojiButton = document.createElement("button");
  emojiButton.classList.add(
    "btn",
    "no-text",
    "btn-icon",
    "toolbar__button",
    "nacho-emoji-picker-button",
    "emoji-extension-button"
  );
  
  // Add chat-specific classes if needed
  if (isChatComposer) {
    emojiButton.classList.add("fk-d-menu__trigger", "emoji-picker-trigger", "chat-composer-button", "btn-transparent", "-emoji");
    emojiButton.setAttribute("aria-expanded", "false");
    emojiButton.setAttribute("data-identifier", "emoji-picker");
    emojiButton.setAttribute("data-trigger", "");
  }
  
  emojiButton.title = "表情包";
  emojiButton.type = "button";
  emojiButton.innerHTML = `🐈‍⬛`;

  emojiButton.addEventListener("click", async (event) => {
    event.stopPropagation();
    if (currentPicker) {
      currentPicker.remove();
      currentPicker = null;
      document.removeEventListener("click", (event) =>
        handleClickOutside(event, emojiButton)
      );
      return;
    }

    // Use cached settings instead of reading from storage directly
    const forceMobile = (cachedState.settings as any)?.forceMobileMode || false;

    if (forceMobile) {
      injectMobilePicker();
    } else {
      injectDesktopPicker(emojiButton);
    }
  });

  // Create image upload button
  const uploadButton = document.createElement("button");
  uploadButton.classList.add(
    "btn",
    "no-text",
    "btn-icon",
    "toolbar__button", 
    "image-upload-button"
  );
  
  // Add chat-specific classes if needed
  if (isChatComposer) {
    uploadButton.classList.add("fk-d-menu__trigger", "chat-composer-button", "btn-transparent");
    uploadButton.setAttribute("aria-expanded", "false");
    uploadButton.setAttribute("data-trigger", "");
  }
  
  uploadButton.title = "上传图片";
  uploadButton.type = "button";
  uploadButton.innerHTML = `📷`;

  uploadButton.addEventListener("click", async (event) => {
    event.stopPropagation();
    
    // Show menu with upload options
    const menu = createUploadMenu();
    document.body.appendChild(menu);
    
    // Position menu near button
    const rect = uploadButton.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = rect.bottom + 5 + 'px';
    menu.style.left = rect.left + 'px';
    menu.style.zIndex = '10000';
    
    // Remove menu when clicking outside
    const removeMenu = (e: Event) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener('click', removeMenu);
      }
    };
    
    setTimeout(() => {
      document.addEventListener('click', removeMenu);
    }, 100);
  });

  try {
    // Insert buttons at appropriate positions
    if (isChatComposer) {
      // For chat composer, insert before the emoji picker button
      const emojiPickerBtn = toolbar.querySelector('.emoji-picker-trigger:not(.emoji-extension-button)');
      if (emojiPickerBtn) {
        toolbar.insertBefore(uploadButton, emojiPickerBtn);
        toolbar.insertBefore(emojiButton, emojiPickerBtn);
      } else {
        toolbar.appendChild(uploadButton);
        toolbar.appendChild(emojiButton);
      }
    } else {
      // For standard toolbar, append at the end
      toolbar.appendChild(uploadButton);
      toolbar.appendChild(emojiButton);
    }
  } catch (e) {
    console.error("[Emoji Extension] Failed to inject buttons (module):", e);
  }
}
