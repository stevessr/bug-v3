// Main userscript entry point - adapted from content script
import { loadDataFromLocalStorage, addEmojiToUserscript } from './userscript-storage';

// Global state for userscript
let userscriptState = {
  emojiGroups: [],
  settings: {
    imageScale: 30,
    gridColumns: 4,
    outputFormat: 'markdown' as const,
    forceMobileMode: false,
    defaultGroup: 'nachoneko',
    showSearchBar: true
  }
};

// Initialize from localStorage
function initializeUserscriptData() {
  const data = loadDataFromLocalStorage();
  userscriptState.emojiGroups = data.emojiGroups;
  userscriptState.settings = data.settings;
}

// Check if current page should have emoji injection (copied from content script)
function shouldInjectEmoji(): boolean {
  // Check for discourse meta tags
  const discourseMetaTags = document.querySelectorAll('meta[name*="discourse"], meta[content*="discourse"], meta[property*="discourse"]');
  if (discourseMetaTags.length > 0) {
    console.log('[Emoji Extension Userscript] Discourse detected via meta tags');
    return true;
  }
  
  // Check for common forum/discussion platforms
  const generatorMeta = document.querySelector('meta[name="generator"]');
  if (generatorMeta) {
    const content = generatorMeta.getAttribute('content')?.toLowerCase() || '';
    if (content.includes('discourse') || content.includes('flarum') || content.includes('phpbb')) {
      console.log('[Emoji Extension Userscript] Forum platform detected via generator meta');
      return true;
    }
  }
  
  // Check current domain - allow linux.do and other known sites
  const hostname = window.location.hostname.toLowerCase();
  const allowedDomains = ['linux.do', 'meta.discourse.org'];
  if (allowedDomains.some(domain => hostname.includes(domain))) {
    console.log('[Emoji Extension Userscript] Allowed domain detected:', hostname);
    return true;
  }
  
  // Check for editor elements that suggest a discussion platform
  const editors = document.querySelectorAll('textarea.d-editor-input, .ProseMirror.d-editor-input, .composer-input, .reply-area textarea');
  if (editors.length > 0) {
    console.log('[Emoji Extension Userscript] Discussion editor detected');
    return true;
  }
  
  console.log('[Emoji Extension Userscript] No compatible platform detected');
  return false;
}

// Insert emoji into editor (adapted from content script)
function insertEmojiIntoEditor(emoji: any) {
  console.log('[Emoji Extension Userscript] Inserting emoji:', emoji);

  const textarea = document.querySelector('textarea.d-editor-input') as HTMLTextAreaElement;
  const proseMirror = document.querySelector('.ProseMirror.d-editor-input') as HTMLElement;

  if (!textarea && !proseMirror) {
    console.error('找不到输入框');
    return;
  }

  // Extract dimensions from URL or use defaults
  const dimensionMatch = emoji.url?.match(/_(\d{3,})x(\d{3,})\./);
  let width = '500';
  let height = '500';
  
  if (dimensionMatch) {
    width = dimensionMatch[1];
    height = dimensionMatch[2];
  } else if (emoji.width && emoji.height) {
    width = emoji.width.toString();
    height = emoji.height.toString();
  }

  const scale = userscriptState.settings?.imageScale || 30;
  const outputFormat = userscriptState.settings?.outputFormat || 'markdown';

  if (textarea) {
    let insertText = '';
    
    if (outputFormat === 'html') {
      const scaledWidth = Math.max(1, Math.round(Number(width) * (scale / 100)));
      const scaledHeight = Math.max(1, Math.round(Number(height) * (scale / 100)));
      insertText = `<img src="${emoji.url}" title=":${emoji.name}:" class="emoji only-emoji" alt=":${emoji.name}:" loading="lazy" width="${scaledWidth}" height="${scaledHeight}" style="aspect-ratio: ${scaledWidth} / ${scaledHeight};"> `;
    } else {
      insertText = `![${emoji.name}|${width}x${height},${scale}%](${emoji.url}) `;
    }

    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    textarea.value = textarea.value.substring(0, selectionStart) + insertText + textarea.value.substring(selectionEnd, textarea.value.length);
    textarea.selectionStart = textarea.selectionEnd = selectionStart + insertText.length;
    textarea.focus();

    // Trigger input event
    const inputEvent = new Event('input', { bubbles: true, cancelable: true });
    textarea.dispatchEvent(inputEvent);
  } else if (proseMirror) {
    const imgWidth = Number(width) || 500;
    const scaledWidth = Math.max(1, Math.round(imgWidth * (scale / 100)));
    const htmlContent = `<img src="${emoji.url}" alt="${emoji.name}" width="${width}" height="${height}" data-scale="${scale}" style="width: ${scaledWidth}px">`;
    
    try {
      // Try clipboard approach first
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/html', htmlContent);
      const pasteEvent = new ClipboardEvent('paste', { clipboardData: dataTransfer, bubbles: true });
      proseMirror.dispatchEvent(pasteEvent);
    } catch (error) {
      try {
        // Fallback to execCommand
        document.execCommand('insertHTML', false, htmlContent);
      } catch (fallbackError) {
        console.error('无法向富文本编辑器中插入表情', fallbackError);
      }
    }
  }
}

// Find toolbars where we can inject buttons (copied from injector.ts)
const toolbarSelectors = [
  '.d-editor-button-bar[role="toolbar"]',
  '.chat-composer__inner-container'
];

function findAllToolbars(): HTMLElement[] {
  const toolbars: HTMLElement[] = [];
  for (const selector of toolbarSelectors) {
    const elements = document.querySelectorAll(selector);
    toolbars.push(...Array.from(elements) as HTMLElement[]);
  }
  return toolbars;
}

// Check if URL is an image
function isImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return /\.(jpg|jpeg|png|gif|bmp|webp|svg|ico)(\?.*)?$/i.test(pathname);
  } catch {
    return false;
  }
}

// Create emoji picker (simplified version)
async function createEmojiPicker(): Promise<HTMLElement> {
  const groups = userscriptState.emojiGroups;
  const picker = document.createElement('div');
  picker.className = 'fk-d-menu -animated -expanded';
  picker.setAttribute('data-identifier', 'emoji-picker');
  picker.setAttribute('role', 'dialog');
  picker.style.cssText = 'max-width: 400px; visibility: visible; z-index: 999999;';

  const innerContent = document.createElement('div');
  innerContent.className = 'fk-d-menu__inner-content';

  const emojiPicker = document.createElement('div');
  emojiPicker.className = 'emoji-picker';

  // Filter container
  const filterContainer = document.createElement('div');
  filterContainer.className = 'emoji-picker__filter-container';

  const filterInputContainer = document.createElement('div');
  filterInputContainer.className = 'emoji-picker__filter filter-input-container';

  const filterInput = document.createElement('input');
  filterInput.className = 'filter-input';
  filterInput.placeholder = '按表情符号名称搜索…';
  filterInput.type = 'text';
  filterInputContainer.appendChild(filterInput);
  filterContainer.appendChild(filterInputContainer);

  // Content
  const content = document.createElement('div');
  content.className = 'emoji-picker__content';

  const sectionsNav = document.createElement('div');
  sectionsNav.className = 'emoji-picker__sections-nav';

  const scrollableContent = document.createElement('div');
  scrollableContent.className = 'emoji-picker__scrollable-content';

  const sections = document.createElement('div');
  sections.className = 'emoji-picker__sections';
  sections.setAttribute('role', 'button');

  // Create sections for each group
  groups.forEach((group, index) => {
    if (!group?.emojis?.length) return;

    // Section navigation button
    const navButton = document.createElement('button');
    navButton.className = `btn no-text btn-flat emoji-picker__section-btn ${index === 0 ? 'active' : ''}`;
    navButton.setAttribute('tabindex', '-1');
    navButton.setAttribute('data-section', group.id);
    navButton.type = 'button';

    const icon = group.icon || '📁';
    if (isImageUrl(icon)) {
      const img = document.createElement('img');
      img.src = icon;
      img.alt = group.name || '';
      img.className = 'emoji-group-icon';
      img.style.width = '18px';
      img.style.height = '18px';
      img.style.objectFit = 'contain';
      navButton.appendChild(img);
    } else {
      navButton.textContent = String(icon);
    }

    navButton.title = group.name;
    navButton.addEventListener('click', () => {
      sectionsNav.querySelectorAll('.emoji-picker__section-btn').forEach(btn => 
        btn.classList.remove('active')
      );
      navButton.classList.add('active');
      const section = sections.querySelector(`[data-section="${group.id}"]`);
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    sectionsNav.appendChild(navButton);

    // Section content
    const section = document.createElement('div');
    section.className = 'emoji-picker__section';
    section.setAttribute('data-section', group.id);
    section.setAttribute('role', 'region');
    section.setAttribute('aria-label', group.name);

    const titleContainer = document.createElement('div');
    titleContainer.className = 'emoji-picker__section-title-container';

    const title = document.createElement('h2');
    title.className = 'emoji-picker__section-title';
    title.textContent = group.name;
    titleContainer.appendChild(title);

    const emojisContainer = document.createElement('div');
    emojisContainer.className = 'emoji-picker__section-emojis';

    let validEmojis = 0;
    group.emojis.forEach((emoji: any) => {
      if (!emoji || typeof emoji !== 'object' || !emoji.url || !emoji.name) return;

      const img = document.createElement('img');
      img.width = 32;
      img.height = 32;
      img.className = 'emoji';
      img.src = emoji.url;
      img.setAttribute('tabindex', '0');
      img.setAttribute('data-emoji', emoji.name);
      img.alt = emoji.name;
      img.title = `:${emoji.name}:`;
      img.loading = 'lazy';

      img.addEventListener('click', () => {
        insertEmojiIntoEditor(emoji);
        picker.remove();
      });

      img.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          insertEmojiIntoEditor(emoji);
          picker.remove();
        }
      });

      emojisContainer.appendChild(img);
      validEmojis++;
    });

    if (validEmojis === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.textContent = `${group.name} 组暂无有效表情`;
      emptyMessage.style.cssText = 'padding: 20px; text-align: center; color: #999;';
      emojisContainer.appendChild(emptyMessage);
    }

    section.appendChild(titleContainer);
    section.appendChild(emojisContainer);
    sections.appendChild(section);
  });

  // Filter functionality
  filterInput.addEventListener('input', (e) => {
    const query = ((e.target as HTMLInputElement).value || '').toLowerCase();
    sections.querySelectorAll('img').forEach(img => {
      const emojiName = img.getAttribute('data-emoji')?.toLowerCase() || '';
      img.style.display = query === '' || emojiName.includes(query) ? '' : 'none';
    });

    sections.querySelectorAll('.emoji-picker__section').forEach(section => {
      const visibleImages = section.querySelectorAll('img:not([style*="none"])');
      const titleContainer = section.querySelector('.emoji-picker__section-title-container');
      if (titleContainer) {
        titleContainer.style.display = visibleImages.length > 0 ? '' : 'none';
      }
    });
  });

  scrollableContent.appendChild(sections);
  content.appendChild(sectionsNav);
  content.appendChild(scrollableContent);
  emojiPicker.appendChild(filterContainer);
  emojiPicker.appendChild(content);
  innerContent.appendChild(emojiPicker);
  picker.appendChild(innerContent);

  return picker;
}

let currentPicker: HTMLElement | null = null;

function closeCurrentPicker() {
  if (currentPicker) {
    currentPicker.remove();
    currentPicker = null;
  }
}

// Inject emoji button into toolbar
function injectEmojiButton(toolbar: HTMLElement) {
  if (toolbar.querySelector('.emoji-extension-button')) {
    return; // Already injected
  }

  const isChatComposer = toolbar.classList.contains('chat-composer__inner-container');
  
  const button = document.createElement('button');
  button.classList.add('btn', 'no-text', 'btn-icon', 'toolbar__button', 'nacho-emoji-picker-button', 'emoji-extension-button');
  
  if (isChatComposer) {
    button.classList.add('fk-d-menu__trigger', 'emoji-picker-trigger', 'chat-composer-button', 'btn-transparent', '-emoji');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('data-identifier', 'emoji-picker');
    button.setAttribute('data-trigger', '');
  }

  button.title = '表情包';
  button.type = 'button';
  button.innerHTML = '🐈‍⬛';

  button.addEventListener('click', async (e) => {
    e.stopPropagation();
    
    if (currentPicker) {
      closeCurrentPicker();
      return;
    }

    currentPicker = await createEmojiPicker();
    document.body.appendChild(currentPicker);

    // Position the picker
    const buttonRect = button.getBoundingClientRect();
    currentPicker.style.position = 'fixed';
    currentPicker.style.top = buttonRect.bottom + 5 + 'px';
    currentPicker.style.left = buttonRect.left + 'px';

    // Close on outside click
    setTimeout(() => {
      const handleClick = (e: Event) => {
        if (currentPicker && !currentPicker.contains(e.target as Node) && e.target !== button) {
          closeCurrentPicker();
          document.removeEventListener('click', handleClick);
        }
      };
      document.addEventListener('click', handleClick);
    }, 100);
  });

  try {
    // Try to insert in the right place
    if (isChatComposer) {
      const existingEmojiTrigger = toolbar.querySelector('.emoji-picker-trigger:not(.emoji-extension-button)');
      if (existingEmojiTrigger) {
        toolbar.insertBefore(button, existingEmojiTrigger);
      } else {
        toolbar.appendChild(button);
      }
    } else {
      toolbar.appendChild(button);
    }
  } catch (error) {
    console.error('[Emoji Extension Userscript] Failed to inject button:', error);
  }
}

// Initialize one-click add functionality for image lightboxes
function initOneClickAdd() {
  console.log('[Emoji Extension Userscript] Initializing one-click add functionality');

  function extractEmojiFromImage(img: HTMLImageElement, titleElement: HTMLElement) {
    const url = img.src;
    if (!url || !url.startsWith('http')) return null;

    let name = '';
    const titleText = titleElement.textContent || '';
    const parts = titleText.split('·');
    if (parts.length > 0) {
      name = parts[0].trim();
    }

    if (!name || name.length < 2) {
      name = img.alt || img.title || extractNameFromUrl(url);
    }

    name = name.trim();
    if (name.length === 0) {
      name = '表情';
    }

    return { name, url };
  }

  function extractNameFromUrl(url: string): string {
    try {
      const filename = new URL(url).pathname.split('/').pop() || '';
      const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
      const decoded = decodeURIComponent(nameWithoutExt);
      
      if (/^[0-9a-f]{8,}$/i.test(decoded) || decoded.length < 2) {
        return '表情';
      }
      
      return decoded || '表情';
    } catch {
      return '表情';
    }
  }

  function createAddButton(emojiData: { name: string; url: string }) {
    const link = document.createElement('a');
    link.className = 'image-source-link emoji-add-link';
    link.style.cssText = `
      color: #ffffff;
      text-decoration: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      font-size: inherit;
      font-family: inherit;
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      border: 2px solid #ffffff;
      border-radius: 6px;
      padding: 4px 8px;
      margin: 0 2px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      transition: all 0.2s ease;
      font-weight: 600;
    `;

    link.addEventListener('mouseenter', () => {
      if (!link.innerHTML.includes('已添加') && !link.innerHTML.includes('失败')) {
        link.style.background = 'linear-gradient(135deg, #3730a3, #5b21b6)';
        link.style.transform = 'scale(1.05)';
        link.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
      }
    });

    link.addEventListener('mouseleave', () => {
      if (!link.innerHTML.includes('已添加') && !link.innerHTML.includes('失败')) {
        link.style.background = 'linear-gradient(135deg, #4f46e5, #7c3aed)';
        link.style.transform = 'scale(1)';
        link.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
      }
    });

    link.innerHTML = `
      <svg class="fa d-icon d-icon-plus svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 1em; height: 1em; fill: currentColor; margin-right: 4px;">
        <path d="M12 4c.55 0 1 .45 1 1v6h6c.55 0 1 .45 1 1s-.45 1-1 1h-6v6c0 .55-.45 1-1 1s-1-.45-1-1v-6H5c-.55 0-1-.45-1-1s.45-1 1-1h6V5c0-.55.45-1 1-1z"/>
      </svg>添加表情
    `;
    link.title = '添加到用户表情';

    link.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const originalHTML = link.innerHTML;
      const originalStyle = link.style.cssText;

      try {
        addEmojiToUserscript(emojiData);
        
        link.innerHTML = `
          <svg class="fa d-icon d-icon-check svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 1em; height: 1em; fill: currentColor; margin-right: 4px;">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>已添加
        `;
        link.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        link.style.color = '#ffffff';
        link.style.border = '2px solid #ffffff';
        link.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.3)';

        setTimeout(() => {
          link.innerHTML = originalHTML;
          link.style.cssText = originalStyle;
        }, 2000);
      } catch (error) {
        console.error('[Emoji Extension Userscript] Failed to add emoji:', error);
        
        link.innerHTML = `
          <svg class="fa d-icon d-icon-times svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 1em; height: 1em; fill: currentColor; margin-right: 4px;">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>失败
        `;
        link.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
        link.style.color = '#ffffff';
        link.style.border = '2px solid #ffffff';
        link.style.boxShadow = '0 2px 4px rgba(239, 68, 68, 0.3)';

        setTimeout(() => {
          link.innerHTML = originalHTML;
          link.style.cssText = originalStyle;
        }, 2000);
      }
    });

    return link;
  }

  function processLightbox(lightbox: HTMLElement) {
    if (lightbox.querySelector('.emoji-add-link')) return;

    const img = lightbox.querySelector('.mfp-img') as HTMLImageElement;
    const title = lightbox.querySelector('.mfp-title') as HTMLElement;

    if (!img || !title) return;

    const emojiData = extractEmojiFromImage(img, title);
    if (!emojiData) return;

    const addButton = createAddButton(emojiData);
    const sourceLink = title.querySelector('a.image-source-link');

    if (sourceLink) {
      const separator = document.createTextNode(' · ');
      title.insertBefore(separator, sourceLink);
      title.insertBefore(addButton, sourceLink);
    } else {
      title.appendChild(document.createTextNode(' · '));
      title.appendChild(addButton);
    }
  }

  function processAllLightboxes() {
    document.querySelectorAll('.mfp-wrap.mfp-gallery').forEach(lightbox => {
      if (lightbox.classList.contains('mfp-wrap') && 
          lightbox.classList.contains('mfp-gallery') && 
          lightbox.querySelector('.mfp-img')) {
        processLightbox(lightbox as HTMLElement);
      }
    });
  }

  // Initial processing
  setTimeout(processAllLightboxes, 500);

  // Watch for new lightboxes
  const observer = new MutationObserver(mutations => {
    let hasNewLightbox = false;
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            if (element.classList && element.classList.contains('mfp-wrap')) {
              hasNewLightbox = true;
            }
          }
        });
      }
    });

    if (hasNewLightbox) {
      setTimeout(processAllLightboxes, 100);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Also check when page becomes visible (for tab switching)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      setTimeout(processAllLightboxes, 200);
    }
  });
}

// Main initialization function
async function initializeEmojiFeature(maxAttempts: number = 10, delay: number = 1000) {
  console.log('[Emoji Extension Userscript] Initializing...');
  
  initializeUserscriptData();
  initOneClickAdd();

  let attempts = 0;

  function attemptInjection() {
    attempts++;
    
    const toolbars = findAllToolbars();
    let injectedCount = 0;
    
    toolbars.forEach(toolbar => {
      if (!toolbar.querySelector('.emoji-extension-button')) {
        console.log('[Emoji Extension Userscript] Toolbar found, injecting button.');
        injectEmojiButton(toolbar);
        injectedCount++;
      }
    });
    
    if (injectedCount > 0 || toolbars.length > 0) {
      return; // Success
    }
    
    if (attempts < maxAttempts) {
      console.log(`[Emoji Extension Userscript] Toolbar not found, attempt ${attempts}/${maxAttempts}. Retrying in ${delay / 1000}s.`);
      setTimeout(attemptInjection, delay);
    } else {
      console.error('[Emoji Extension Userscript] Failed to find toolbar after multiple attempts.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attemptInjection);
  } else {
    attemptInjection();
  }

  // Periodic checks for new toolbars
  setInterval(() => {
    const toolbars = findAllToolbars();
    toolbars.forEach(toolbar => {
      if (!toolbar.querySelector('.emoji-extension-button')) {
        console.log('[Emoji Extension Userscript] New toolbar found, injecting button.');
        injectEmojiButton(toolbar);
      }
    });
  }, 30000);
}

// Entry point
if (shouldInjectEmoji()) {
  console.log('[Emoji Extension Userscript] Initializing emoji feature');
  initializeEmojiFeature();
} else {
  console.log('[Emoji Extension Userscript] Skipping injection - incompatible platform');
}

export {};