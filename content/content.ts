import { createApp } from "vue";
import EmojiPicker from "./EmojiPicker.vue";

// Enhanced content script based on referense/simple.js

function initializeEmojiFeature() {
  console.log('[Emoji Extension] Initializing...');
  
  // Wait for page to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(injectFeatures, 500);
    });
  } else {
    setTimeout(injectFeatures, 500);
  }
}

function injectFeatures() {
  const toolbar = findToolbar();
  if (toolbar && !document.querySelector('#emoji-extension-button')) {
    injectButton(toolbar);
  }
}

function findToolbar(): Element | null {
  // Try to find various toolbar patterns based on simple.js
  const selectors = [
    '.d-editor-button-bar',
    '.toolbar',
    '.composer-action-bar',
    '.reply-area .d-editor .d-editor-button-bar',
    '.edit-form .d-editor .d-editor-button-bar'
  ];
  
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      console.log(`[Emoji Extension] Found toolbar: ${selector}`);
      return element;
    }
  }
  
  return null;
}

function injectButton(toolbar: Element) {
  console.log('[Emoji Extension] Injecting button into toolbar');
  
  // Create the button - following simple.js pattern
  const button = document.createElement("button");
  button.id = "emoji-extension-button";
  button.className = "btn no-text btn-icon toolbar__button emoji-extension-button";
  button.title = "表情包";
  button.type = "button";
  button.innerHTML = `🐈‍⬛`; // Cat emoji like in reference
  
  // Create picker container
  let pickerContainer = document.getElementById("emoji-picker-container");
  if (!pickerContainer) {
    pickerContainer = document.createElement("div");
    pickerContainer.id = "emoji-picker-container";
    pickerContainer.style.display = "none";
    pickerContainer.style.position = "fixed";
    pickerContainer.style.zIndex = "10001";
    document.body.appendChild(pickerContainer);
  }

  // Mount Vue component
  const app = createApp(EmojiPicker, {
    visible: false,
    onClose: () => {
      if (pickerContainer) {
        pickerContainer.style.display = "none";
      }
    },
    onSelect: (emoji: any) => {
      insertEmojiIntoEditor(emoji);
      if (pickerContainer) {
        pickerContainer.style.display = "none";
      }
    }
  });
  
  app.mount(pickerContainer);

  // Button click handler - based on simple.js logic
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    
    if (!pickerContainer) return;
    
    const isVisible = pickerContainer.style.display === "block";
    
    if (isVisible) {
      pickerContainer.style.display = "none";
      document.removeEventListener('click', handleClickOutside);
      return;
    }
    
    // Position picker - following simple.js responsive logic
    positionPicker(button, pickerContainer);
    pickerContainer.style.display = "block";
    
    // Add click outside handler
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);
  });

  // Click outside handler
  function handleClickOutside(e: Event) {
    if (pickerContainer && 
        !pickerContainer.contains(e.target as Node) && 
        e.target !== button) {
      pickerContainer.style.display = "none";
      document.removeEventListener('click', handleClickOutside);
    }
  }

  // Inject button into toolbar
  try {
    toolbar.appendChild(button);
    console.log('[Emoji Extension] Button injected successfully');
  } catch (e) {
    console.error('[Emoji Extension] Failed to inject button:', e);
    // Fallback: append to body and position near toolbar
    document.body.appendChild(button);
    const rect = toolbar.getBoundingClientRect();
    button.style.position = 'fixed';
    button.style.top = `${rect.top}px`;
    button.style.right = '10px';
    button.style.zIndex = '10000';
  }
}

function positionPicker(button: HTMLElement, picker: HTMLElement) {
  const buttonRect = button.getBoundingClientRect();
  const pickerHeight = 350; // Estimated picker height
  const pickerWidth = 320;
  
  // Check if we're on mobile
  const isMobile = window.innerWidth <= 768;
  
  if (isMobile) {
    // Mobile positioning - similar to simple.js mobile logic
    const replyControl = document.querySelector("#reply-control");
    if (replyControl) {
      const replyRect = replyControl.getBoundingClientRect();
      picker.style.position = 'fixed';
      picker.style.bottom = `${window.innerHeight - replyRect.top + 5}px`;
      picker.style.left = `${replyRect.left}px`;
      picker.style.width = `${Math.min(replyRect.width, pickerWidth)}px`;
    } else {
      // Fallback mobile positioning
      picker.style.position = 'fixed';
      picker.style.bottom = '10px';
      picker.style.left = '10px';
      picker.style.right = '10px';
      picker.style.width = 'auto';
    }
  } else {
    // Desktop positioning
    const isMiniReply = document.querySelector(".d-editor-textarea-wrapper")?.closest('.mini-reply');
    
    if (isMiniReply) {
      // Mini reply positioning
      const editorRect = document.querySelector(".d-editor-textarea-wrapper")?.getBoundingClientRect();
      if (editorRect) {
        picker.style.position = 'fixed';
        picker.style.top = `${editorRect.top}px`;
        picker.style.left = `${editorRect.left + editorRect.width / 2 - pickerWidth / 2}px`;
      }
    } else {
      // Regular reply positioning
      const editorRect = document.querySelector(".d-editor-textarea-wrapper")?.getBoundingClientRect();
      if (editorRect) {
        picker.style.position = 'fixed';
        picker.style.top = `${editorRect.top}px`;
        picker.style.left = `${editorRect.right + 10}px`;
      } else {
        // Fallback positioning near button
        picker.style.position = 'fixed';
        picker.style.top = `${Math.max(10, buttonRect.top - pickerHeight - 5)}px`;
        picker.style.left = `${Math.max(10, buttonRect.left)}px`;
      }
    }
  }
}

function insertEmojiIntoEditor(emoji: any) {
  console.log('[Emoji Extension] Inserting emoji:', emoji);
  
  // Try different editor selectors
  const editorSelectors = [
    '.d-editor-input',
    '.d-editor textarea',
    'textarea.d-editor-input',
    '[contenteditable="true"]'
  ];
  
  let targetElement: HTMLElement | null = null;
  
  for (const selector of editorSelectors) {
    targetElement = document.querySelector(selector) as HTMLElement;
    if (targetElement) break;
  }
  
  if (!targetElement) {
    console.warn('[Emoji Extension] No editor found, trying focused element');
    targetElement = document.activeElement as HTMLElement;
  }
  
  if (targetElement) {
    const scale = getImageScale();
    const width = emoji.width ? Math.round(emoji.width * (scale / 100)) : 'auto';
    const height = emoji.height ? Math.round(emoji.height * (scale / 100)) : 'auto';
    const emojiMarkdown = `![${emoji.name}|${width}x${height}](${emoji.url}) `;
    
    if (targetElement.tagName === 'TEXTAREA' || targetElement.tagName === 'INPUT') {
      // Handle textarea/input
      const textarea = targetElement as HTMLTextAreaElement;
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      
      textarea.value = textarea.value.substring(0, start) + 
                     emojiMarkdown + 
                     textarea.value.substring(end);
      
      textarea.selectionStart = textarea.selectionEnd = start + emojiMarkdown.length;
      textarea.focus();
      
      // Trigger input event for frameworks
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (targetElement.contentEditable === 'true') {
      // Handle contenteditable
      try {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          range.insertNode(document.createTextNode(emojiMarkdown));
          range.collapse(false);
        } else {
          targetElement.innerHTML += emojiMarkdown;
        }
        
        // Trigger input event
        targetElement.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (e) {
        console.error('[Emoji Extension] ContentEditable insertion failed:', e);
        // Fallback to execCommand
        try {
          document.execCommand("insertHTML", false, emojiMarkdown);
        } catch (e2) {
          console.error('[Emoji Extension] execCommand failed:', e2);
        }
      }
    }
  } else {
    console.warn('[Emoji Extension] No suitable editor element found');
  }
}

function getImageScale(): number {
  // Get scale from storage or default to 100%
  return new Promise<number>((resolve) => {
    chrome.storage.local.get(['appSettings'], (result) => {
      const scale = result.appSettings?.imageScale || 100;
      resolve(scale);
    });
  }) as any || 100;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'INSERT_EMOJI') {
    const scale = message.scale || 100;
    const emoji = {
      ...message.emoji,
      width: message.emoji.width ? Math.round(message.emoji.width * (scale / 100)) : undefined,
      height: message.emoji.height ? Math.round(message.emoji.height * (scale / 100)) : undefined
    };
    insertEmojiIntoEditor(emoji);
    sendResponse({ success: true });
  }
});

// Initialize
initializeEmojiFeature();

// Re-inject on dynamic content changes
const observer = new MutationObserver((mutations) => {
  let shouldReinject = false;
  
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          if (element.querySelector('.d-editor-button-bar') || 
              element.classList.contains('d-editor-button-bar')) {
            shouldReinject = true;
            break;
          }
        }
      }
    }
  });
  
  if (shouldReinject) {
    setTimeout(injectFeatures, 100);
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
