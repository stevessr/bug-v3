// Enhanced content script based on referense/simple.js
// Specifically optimized for Linux.do injection

import { defaultEmojiSet } from './emoji-data';

console.log('[Emoji Extension] Content script loaded');

// Load CSS styles
async function loadStyles() {
  try {
    const w: any = window as any;
    const chromeApi = w.chrome;
    if (chromeApi && chromeApi.runtime && chromeApi.runtime.getURL) {
      const response = await fetch(chromeApi.runtime.getURL('content/picker-styles.css'));
      const css = await response.text();
      const styleSheet = document.createElement("style");
      styleSheet.type = "text/css";
      styleSheet.textContent = css;
      document.head.appendChild(styleSheet);
    } else {
      throw new Error('Chrome API not available');
    }
  } catch (error) {
    console.error('[Emoji Extension] Failed to load styles:', error);
    // Fallback inline styles
    const fallbackCSS = `
      .fk-d-menu { position: fixed; background: #fff; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 9999; max-width: 400px; }
      .emoji-picker__section-emojis { display: grid; grid-template-columns: repeat(auto-fill, minmax(40px, 1fr)); gap: 4px; }
      .emoji-picker__section-emojis .emoji { width: 32px; height: 32px; cursor: pointer; border-radius: 4px; padding: 4px; box-sizing: border-box; }
      .emoji-picker__section-emojis .emoji:hover { transform: scale(1.1); background-color: rgba(0, 124, 186, 0.1); }
    `;
    const styleSheet = document.createElement("style");
    styleSheet.textContent = fallbackCSS;
    document.head.appendChild(styleSheet);
  }
}

// Initialize styles
loadStyles();

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
  if (toolbar && !document.querySelector('.nacho-emoji-picker-button')) {
    injectButton(toolbar);
  }
}

function findToolbar(): Element | null {
  // Following simple.js - look for d-editor-button-bar specifically
  const toolbar = document.querySelector('.d-editor-button-bar[role="toolbar"]');
  if (toolbar) {
    console.log('[Emoji Extension] Found toolbar');
    return toolbar;
  }
  
  console.log('[Emoji Extension] Toolbar not found');
  return null;
}

function injectButton(toolbar: Element) {
  console.log('[Emoji Extension] Injecting button into toolbar');
  
  // Create the button - following simple.js pattern exactly
  const button = document.createElement("button");
  button.classList.add('btn', 'no-text', 'btn-icon', 'toolbar__button', 'nacho-emoji-picker-button', 'emoji-extension-button');
  button.title = "表情包";
  button.type = "button";
  button.innerHTML = `🐈‍⬛`; // Cat emoji like in reference

  // Create picker container
  let currentPicker: HTMLElement | null = null;

  // Button click handler - based on simple.js logic
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    
    // Remove existing picker
    if (currentPicker) {
      currentPicker.remove();
      currentPicker = null;
      document.removeEventListener('click', handleClickOutside);
      return;
    }
    
    // Create new picker following simple.html structure
    currentPicker = createEmojiPicker();
    document.body.appendChild(currentPicker);
    
    // Position picker - following simple.js responsive logic
    positionPicker(button, currentPicker);
    
    // Add click outside handler
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);
  });

  // Click outside handler
  function handleClickOutside(e: Event) {
    if (currentPicker && 
        !currentPicker.contains(e.target as Node) && 
        e.target !== button) {
      currentPicker.remove();
      currentPicker = null;
      document.removeEventListener('click', handleClickOutside);
    }
  }

  // Inject button into toolbar
  try {
    toolbar.appendChild(button);
    console.log('[Emoji Extension] Button injected successfully');
  } catch (e) {
    console.error('[Emoji Extension] Failed to inject button:', e);
  }
}

function createEmojiPicker(): HTMLElement {
  // Create main container following simple.html structure
  const menuWrapper = document.createElement('div');
  menuWrapper.className = 'fk-d-menu -animated -expanded';
  menuWrapper.setAttribute('data-identifier', 'emoji-picker');
  menuWrapper.setAttribute('role', 'dialog');
  menuWrapper.style.maxWidth = '400px';
  menuWrapper.style.visibility = 'visible';

  const innerContent = document.createElement('div');
  innerContent.className = 'fk-d-menu__inner-content';

  const emojiPicker = document.createElement('div');
  emojiPicker.className = 'emoji-picker';

  // Filter container with search
  const filterContainer = document.createElement('div');
  filterContainer.className = 'emoji-picker__filter-container';

  const filterDiv = document.createElement('div');
  filterDiv.className = 'emoji-picker__filter filter-input-container';

  const searchInput = document.createElement('input');
  searchInput.className = 'filter-input';
  searchInput.type = 'text';
  searchInput.placeholder = '按表情符号名称和别名搜索…';

  const searchIcon = document.createElement('svg');
  searchIcon.className = 'fa d-icon d-icon-magnifying-glass svg-icon -right svg-string';
  searchIcon.setAttribute('aria-hidden', 'true');
  searchIcon.innerHTML = '<use href="#magnifying-glass"></use>';

  filterDiv.appendChild(searchInput);
  filterDiv.appendChild(searchIcon);

  // Diversity trigger button (placeholder)
  const diversityTrigger = document.createElement('button');
  diversityTrigger.className = 'btn no-text fk-d-menu__trigger -trigger emoji-picker__diversity-trigger btn-transparent';
  diversityTrigger.type = 'button';
  diversityTrigger.innerHTML = '<img width="20" height="20" src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyUzYuNDggMjIgMTIgMjJTMjIgMTcuNTIgMjIgMTJTMTcuNTIgMiAxMiAyWk0xNyAxM0gxMVY3SDEzVjExSDE3VjEzWiIgZmlsbD0iIzMzMzMzMyIvPgo8L3N2Zz4K" title="diversity" alt="diversity" class="emoji" />';

  filterContainer.appendChild(filterDiv);
  filterContainer.appendChild(diversityTrigger);

  // Content area
  const content = document.createElement('div');
  content.className = 'emoji-picker__content';

  // Sections navigation
  const sectionsNav = document.createElement('div');
  sectionsNav.className = 'emoji-picker__sections-nav';

  const favoritesBtn = document.createElement('button');
  favoritesBtn.className = 'btn no-text btn-flat emoji-picker__section-btn active';
  favoritesBtn.setAttribute('tabindex', '-1');
  favoritesBtn.setAttribute('data-section', 'favorites');
  favoritesBtn.type = 'button';
  favoritesBtn.innerHTML = '<img width="20" height="20" src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMSA5TDE0IDEyTDE1IDIwTDEyIDEyTDkgMjBMMTAgMTJMMyA5TDEwLjkxIDguMjZMMTIgMloiIGZpbGw9IiNGRkM0MzEiLz4KPC9zdmc+" title="star" alt="star" class="emoji" />';

  sectionsNav.appendChild(favoritesBtn);

  // Scrollable content
  const scrollableContent = document.createElement('div');
  scrollableContent.className = 'emoji-picker__scrollable-content';

  const sections = document.createElement('div');
  sections.className = 'emoji-picker__sections';
  sections.setAttribute('role', 'button');

  // Main section
  const section = document.createElement('div');
  section.className = 'emoji-picker__section';
  section.setAttribute('data-section', 'favorites');
  section.setAttribute('role', 'region');
  section.setAttribute('aria-label', '常用');

  // Section title container
  const sectionTitleContainer = document.createElement('div');
  sectionTitleContainer.className = 'emoji-picker__section-title-container';

  const sectionTitle = document.createElement('h2');
  sectionTitle.className = 'emoji-picker__section-title';
  sectionTitle.textContent = '常用';

  const trashBtn = document.createElement('button');
  trashBtn.className = 'btn no-text btn-icon btn-transparent';
  trashBtn.type = 'button';
  trashBtn.innerHTML = '<svg class="fa d-icon d-icon-trash-can svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#trash-can"></use></svg><span aria-hidden="true"> &ZeroWidthSpace; </span>';

  sectionTitleContainer.appendChild(sectionTitle);
  sectionTitleContainer.appendChild(trashBtn);

  // Section emojis container
  const sectionEmojis = document.createElement('div');
  sectionEmojis.className = 'emoji-picker__section-emojis';

  // Populate emojis
  defaultEmojiSet.forEach((emoji, index) => {
    const img = document.createElement('img');
    img.width = 32;
    img.height = 32;
    img.className = 'emoji';
    img.src = emoji.url;
    img.setAttribute('tabindex', index === 0 ? '0' : '-1');
    img.setAttribute('data-emoji', emoji.name);
    img.alt = emoji.name;
    img.title = `:${emoji.name}:`;
    img.loading = 'lazy';

    img.addEventListener('click', () => {
      insertEmojiIntoEditor(emoji);
      menuWrapper.remove();
    });

    sectionEmojis.appendChild(img);
  });

  // Add search functionality
  searchInput.addEventListener('input', (e) => {
    const query = (e.target as HTMLInputElement).value.toLowerCase();
    const allEmojis = sectionEmojis.querySelectorAll('.emoji');
    
    allEmojis.forEach(emoji => {
      const name = emoji.getAttribute('data-emoji')?.toLowerCase() || '';
      const title = emoji.getAttribute('title')?.toLowerCase() || '';
      if (name.includes(query) || title.includes(query)) {
        (emoji as HTMLElement).style.display = 'block';
      } else {
        (emoji as HTMLElement).style.display = 'none';
      }
    });
  });

  // Assemble the structure
  section.appendChild(sectionTitleContainer);
  section.appendChild(sectionEmojis);
  sections.appendChild(section);
  scrollableContent.appendChild(sections);
  content.appendChild(sectionsNav);
  content.appendChild(scrollableContent);
  emojiPicker.appendChild(filterContainer);
  emojiPicker.appendChild(content);
  innerContent.appendChild(emojiPicker);
  menuWrapper.appendChild(innerContent);

  return menuWrapper;
}

function positionPicker(button: HTMLElement, picker: HTMLElement) {
  const buttonRect = button.getBoundingClientRect();
  
  // Check if we're on mobile - from simple.js
  const isMobile = /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);
  
  if (isMobile) {
    // Mobile positioning - similar to simple.js mobile logic
    const replyControl = document.querySelector("#reply-control");
    if (replyControl) {
      const replyRect = replyControl.getBoundingClientRect();
      picker.style.position = 'fixed';
      picker.style.bottom = `${window.innerHeight - replyRect.top + 5}px`;
      picker.style.left = `${replyRect.left}px`;
      picker.style.width = `${Math.min(replyRect.width, 320)}px`;
      
      // Mobile emoji size adjustment
      const images = picker.querySelectorAll('img');
      images.forEach(img => {
        (img as HTMLElement).style.width = '60px';
        (img as HTMLElement).style.height = '60px';
      });
    } else {
      // Fallback mobile positioning
      picker.style.position = 'fixed';
      picker.style.bottom = '10px';
      picker.style.left = '10px';
      picker.style.right = '10px';
      picker.style.width = 'auto';
    }
  } else {
    // Desktop positioning - check for mini reply like simple.js
    const replyEle = document.querySelector("#reply-control");
    const isMiniReply = replyEle?.className.includes('hide-preview') && window.innerWidth < 1600;
    
    if (isMiniReply) {
      // Mini reply positioning
      const editorRect = document.querySelector(".d-editor-textarea-wrapper")?.getBoundingClientRect();
      if (editorRect) {
        picker.style.position = 'fixed';
        picker.style.top = `${editorRect.top}px`;
        picker.style.left = `${editorRect.left + editorRect.width / 2 - 160}px`; // 160 = picker width / 2
      }
    } else {
      // Regular reply positioning - place to the right of editor
      const editorRect = document.querySelector(".d-editor-textarea-wrapper")?.getBoundingClientRect();
      if (editorRect) {
        picker.style.position = 'fixed';
        picker.style.top = `${editorRect.top}px`;
        picker.style.left = `${editorRect.right + 10}px`;
      } else {
        // Fallback positioning near button
        picker.style.position = 'fixed';
        picker.style.top = `${Math.max(10, buttonRect.top - 300)}px`;
        picker.style.left = `${Math.max(10, buttonRect.left)}px`;
      }
    }
  }
}

function insertEmojiIntoEditor(emoji: any) {
  console.log('[Emoji Extension] Inserting emoji:', emoji);
  
  // Find the active editor - following simple.js exactly
  const textArea = document.querySelector('textarea.d-editor-input') as HTMLTextAreaElement;
  const richEle = document.querySelector('.ProseMirror.d-editor-input') as HTMLElement;
  
  if (!textArea && !richEle) {
    console.error("找不到输入框");
    return;
  }

  // Get dimensions - following simple.js logic
  const match = emoji.url.match(/_(\d{3,})x(\d{3,})\./);
  let width = '500';
  let height = '500';
  if (match) {
    width = match[1];
    height = match[2];
  } else {
    if (emoji.width && emoji.height) {
      width = emoji.width.toString();
      height = emoji.height.toString();
    }
  }

  // Read configured image scale from storage (default 30)
  getImageScale().then((scale) => {
    const s = typeof scale === 'number' && !isNaN(scale) ? scale : 30;

    if (textArea) {
      // Handle textarea - apply configured scale
      const emojiMarkdown = `![${emoji.name}|${width}x${height},${s}%](${emoji.url}) `;

      const startPos = textArea.selectionStart;
      const endPos = textArea.selectionEnd;
      textArea.value = textArea.value.substring(0, startPos) +
          emojiMarkdown +
          textArea.value.substring(endPos, textArea.value.length);

      textArea.selectionStart = textArea.selectionEnd = startPos + emojiMarkdown.length;
      textArea.focus();

      const event = new Event('input', {
          bubbles: true,
          cancelable: true,
      });
      textArea.dispatchEvent(event);
    } else if (richEle) {
      // Handle rich text editor - apply configured scale and insert pixel width accordingly
      const numericWidth = Number(width) || 500;
      const pixelWidth = Math.max(1, Math.round(numericWidth * (s / 100)));
      const imgTemplate = `<img src="${emoji.url}" alt="${emoji.name}" width="${width}" height="${height}" data-scale="${s}" style="width: ${pixelWidth}px">`;
      try {
          const dt = new DataTransfer();
          dt.setData("text/html", imgTemplate);
          const evt = new ClipboardEvent("paste", { clipboardData: dt, bubbles: true });
          richEle.dispatchEvent(evt);
      } catch (_) {
          try {
              document.execCommand("insertHTML", false, imgTemplate);
          } catch (e) {
              console.error("无法向富文本编辑器中插入表情", e);
          }
      }
    }
  }).catch(err => {
    console.error('[Emoji Extension] Failed to read image scale from storage', err);
  });
}

function getImageScale(): Promise<number> {
  return new Promise((resolve) => {
    try {
      const w: any = window as any;
      const chromeApi = w.chrome;
      if (chromeApi && chromeApi.storage && chromeApi.storage.local && typeof chromeApi.storage.local.get === 'function') {
        chromeApi.storage.local.get(['appSettings'], (data: any) => {
          const scale = data?.appSettings?.imageScale;
          resolve(typeof scale === 'number' ? scale : 30);
        });
      } else {
        resolve(30);
      }
    } catch (e) {
      resolve(30);
    }
  });
}

// Initialize - exactly like simple.js with interval checking
setInterval(() => {
  const toolbar = document.querySelector('.d-editor-button-bar[role="toolbar"]');
  if (toolbar && !document.querySelector('.nacho-emoji-picker-button')) {
    injectButton(toolbar);
  }
}, 500);

// Also initialize on load
initializeEmojiFeature();
