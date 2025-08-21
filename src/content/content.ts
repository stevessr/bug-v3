// Enhanced content script for Linux.do emoji injection
// Optimized for Chrome Extension MV3 with storage sync

// Global state
let cachedEmojiGroups: any[] = [];
let cachedSettings: any = { imageScale: 30, gridColumns: 4 };

// Storage sync functionality
async function loadDataFromStorage() {
  try {
    if (chrome?.storage?.local) {
      const data = await chrome.storage.local.get(['emojiGroups', 'appSettings']);
      cachedEmojiGroups = data.emojiGroups || [];
      cachedSettings = { ...cachedSettings, ...(data.appSettings || {}) };
    }
  } catch (error) {
    console.error('[Emoji Extension] Failed to load from storage:', error);
  }
}

// Get all emojis from cached groups
function getAllEmojis() {
  const allEmojis: any[] = [];
  cachedEmojiGroups.forEach(group => {
    if (group.emojis && Array.isArray(group.emojis)) {
      allEmojis.push(...group.emojis);
    }
  });
  
  // Fallback to default if no emojis loaded
  if (allEmojis.length === 0) {
    return getDefaultEmojis();
  }
  
  return allEmojis;
}

// Fallback emoji data
function getDefaultEmojis() {
  return [
    { packet: 1, name: '瞌睡', url: 'https://linux.do/uploads/default/optimized/4X/5/9/f/59ffbc2c53dd2a07dc30d4368bd5c9e01ca57d80_2_490x500.jpeg' },
    { packet: 2, name: '哭泣', url: 'https://linux.do/uploads/default/optimized/4X/5/d/9/5d932c05a642396335f632a370bd8d45463cf2e2_2_503x500.jpeg' },
    { packet: 3, name: '疑问', url: 'https://linux.do/uploads/default/optimized/4X/f/a/a/faa5afe1749312bc4a326feff0eca6fb39355300_2_518x499.jpeg' },
    { packet: 4, name: '干嘛', url: 'https://linux.do/uploads/default/optimized/4X/5/5/2/552f13479e7bff2ce047d11ad821da4963c467f2_2_500x500.jpeg' },
    { packet: 5, name: '吃东西', url: 'https://linux.do/uploads/default/optimized/4X/0/d/1/0d125de02c201128bf6a3f78ff9450e48a3e27de_2_532x500.jpeg' },
    { packet: 6, name: '是我', url: 'https://linux.do/uploads/default/optimized/4X/2/3/f/23fac94d8858a23cbd49879f2b037a2be020c87e_2_500x500.jpeg' },
    { packet: 7, name: '玩吗', url: 'https://linux.do/uploads/default/optimized/4X/3/1/a/31a38450e22d42f9d4b683b190a40b9a94727681_2_493x500.jpeg' },
    { packet: 8, name: '嘻嘻', url: 'https://linux.do/uploads/default/optimized/4X/6/a/3/6a3619da1dbb63cc0420fbf1f6f2316b5503ab09_2_413x500.jpeg' },
    { packet: 9, name: '洗澡', url: 'https://linux.do/uploads/default/optimized/4X/e/1/4/e1429fd845288aa4c75e30829efe4696a1f4b1f9_2_636x500.jpeg' },
    { packet: 11, name: '困了', url: 'https://linux.do/uploads/default/optimized/4X/7/f/4/7f4d50105aefec0efa80c498179a7d0901b54a7a_2_564x500.jpeg' },
    { packet: 12, name: '我汗', url: 'https://linux.do/uploads/default/optimized/4X/8/a/b/8ab3b1fb6c7d990c9070e010f915fb237093f67f_2_490x500.jpeg' },
    { packet: 13, name: '哇哦', url: 'https://linux.do/uploads/default/optimized/4X/2/9/c/29ce5a00273ba10ae9c1a8abf7a3b42abcccdd66_2_533x499.jpeg' },
    { packet: 14, name: '无聊', url: 'https://linux.do/uploads/default/optimized/4X/1/0/6/1063e1803fa965cd1604bda0e6d7705376f9963f_2_500x500.jpeg' },
    { packet: 15, name: '盯着', url: 'https://linux.do/uploads/default/optimized/4X/6/e/6/6e68786e64c4260746d02d2e308168b200185d7d_2_613x500.jpeg' },
    { packet: 16, name: 'ok', url: 'https://linux.do/uploads/default/optimized/4X/1/a/b/1ab685b8f2948689a917aa1c0d7ce9bfa2ec48bd_2_594x500.jpeg' },
    { packet: 17, name: '沉默', url: 'https://linux.do/uploads/default/optimized/4X/1/c/3/1c39b615e9ef831568ede182ecdec0e749bbd202_2_503x499.jpeg' },
    { packet: 18, name: '开心', url: 'https://linux.do/uploads/default/optimized/4X/6/5/0/650110fc5845e915cf4aefec11e4a058f4aff731_2_500x500.png' },
    { packet: 19, name: '睡觉', url: 'https://linux.do/uploads/default/optimized/4X/9/0/9/90957308d24a9c79257425ff0f8a14411b6aaad6_2_500x500.png' },
    { packet: 20, name: '生气', url: 'https://linux.do/uploads/default/optimized/4X/8/1/9/81909951f915b3e969c93d433b9fd6935a431d9a_2_500x500.png' },
    { packet: 21, name: '抱抱', url: 'https://linux.do/uploads/default/optimized/4X/2/5/6/256411726c9680d821da26ad699e7d2d574ab24c_2_500x500.png' },
    { packet: 22, name: '花痴', url: 'https://linux.do/uploads/default/optimized/4X/1/e/a/1eaf593a62462e72a4193f6c646f51898e85f53d_2_500x500.png' },
    { packet: 23, name: '彩色', url: 'https://linux.do/uploads/default/optimized/4X/5/7/b/57b21409decd4258dc93ce93cff40ef3b631de46_2_500x500.png' },
    { packet: 24, name: '惊讶', url: 'https://linux.do/uploads/default/optimized/4X/9/8/9/989df0f7b3b9683974162f491a517305711e28ce_2_500x500.png' },
    { packet: 25, name: '真诚', url: 'https://linux.do/uploads/default/optimized/4X/b/8/5/b85433e17a79846cf2ec8a9458506ce6f48d25b2_2_500x500.png' },
    { packet: 26, name: '流口水', url: 'https://linux.do/uploads/default/optimized/4X/3/9/9/399d86225dadc703fabb1a8df48be5b36908320c_2_488x500.png' },
    { packet: 27, name: '尴尬', url: 'https://linux.do/uploads/default/original/4X/1/d/5/1d58ac97d5e63b36083a5eadb67a3f3404f0b063.png', width: 512, height: 493 },
    { packet: 28, name: '是的', url: 'https://linux.do/uploads/default/original/4X/c/3/b/c3bcb5be07dd54b84038568d6ae9762afb86c8f9.png', width: 512, height: 481 },
    { packet: 29, name: 'nya', url: 'https://linux.do/uploads/default/original/4X/8/f/e/8fe82a64472dc96eaf9b27dc86f0655fee325572.png', width: 512, height: 477 },
    { packet: 30, name: '脸红', url: 'https://linux.do/uploads/default/optimized/4X/3/f/6/3f6c5ed37cb8a5b4c06d1c9b1e8aab38ddfe9878_2_500x500.png' },
    { packet: 31, name: '大哭', url: 'https://linux.do/uploads/default/optimized/4X/8/2/2/8220d4c92b848b15d642dd22973bd0854d734aa9_2_500x500.png' },
    { packet: 32, name: 'hi', url: 'https://linux.do/uploads/default/optimized/4X/f/2/2/f228b317d9c333833ccf3a81fee705024a548963_2_500x500.png' },
    { packet: 33, name: '爱心', url: 'https://linux.do/uploads/default/optimized/4X/f/9/9/f99df315a1cdba0897bc6f4776ebdcc360ddf562_2_500x500.png' },
    { packet: 34, name: '眼罩', url: 'https://linux.do/uploads/default/optimized/4X/a/e/5/ae56ca1c5ee8ab2c47104c54077efcedbbdc474e_2_500x500.png' },
    { packet: 35, name: '委屈', url: 'https://linux.do/uploads/default/optimized/4X/e/1/e/e1e37eca93601022f3efcd91cb477b88ee350e07_2_500x500.png' },
    { packet: 36, name: '害羞', url: 'https://linux.do/uploads/default/optimized/4X/7/8/0/78015ed5ccdc87e5769eb2d1af5cdaf466c1cb07_2_500x500.png' },
    { packet: 37, name: '打哈欠', url: 'https://linux.do/uploads/default/optimized/4X/2/f/4/2f453be9d3d69d459637f3cd824b6f9641b6f592_2_500x500.png' },
    { packet: 38, name: '红温', url: 'https://linux.do/uploads/default/optimized/4X/2/4/c/24cac75d64461ba1d1b0c3c8560a1c10acb3f3ad_2_500x500.png' },
    { packet: 39, name: '愤怒', url: 'https://linux.do/uploads/default/optimized/4X/3/d/2/3d245f6de7d3549174cef112560dec8ae3a768d7_2_500x500.png' },
    { packet: 40, name: '猫猫の福利', url: 'https://linux.do/uploads/default/optimized/4X/c/0/b/c0bb1d42d12ef192657896abccf05d97c6298bdd_2_500x500.jpeg' }
  ];
}

console.log('[Emoji Extension] Content script loaded');

// Load CSS styles following simple.html structure
function addSimpleHTMLStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .fk-d-menu.-animated.-expanded {
      position: fixed !important;
      background: white !important;
      border-radius: 8px !important;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15) !important;
      max-width: 400px !important;
      width: 90vw !important;
      z-index: 999999 !important;
      overflow: hidden !important;
    }
    
    .fk-d-menu__inner-content {
      background: white !important;
    }
    
    .emoji-picker {
      max-height: 400px !important;
      overflow-y: auto !important;
    }
    
    .emoji-picker__filter-container {
      padding: 12px !important;
      border-bottom: 1px solid #e5e7eb !important;
      background: #f9fafb !important;
    }
    
    .emoji-picker__filter {
      position: relative !important;
    }
    
    .filter-input {
      width: 100% !important;
      padding: 8px 12px !important;
      border: 1px solid #d1d5db !important;
      border-radius: 6px !important;
      font-size: 14px !important;
      outline: none !important;
    }
    
    .filter-input:focus {
      border-color: #3b82f6 !important;
      box-shadow: 0 0 0 1px #3b82f6 !important;
    }
    
    .emoji-picker__content {
      padding: 0 !important;
    }
    
    .emoji-picker__sections-nav {
      display: flex !important;
      padding: 8px !important;
      border-bottom: 1px solid #e5e7eb !important;
      background: #f9fafb !important;
    }
    
    .emoji-picker__section-btn {
      padding: 6px !important;
      margin-right: 4px !important;
      border: none !important;
      background: none !important;
      border-radius: 4px !important;
      cursor: pointer !important;
    }
    
    .emoji-picker__section-btn.active {
      background: #e5e7eb !important;
    }
    
    .emoji-picker__scrollable-content {
      max-height: 280px !important;
      overflow-y: auto !important;
    }
    
    .emoji-picker__section {
      padding: 12px !important;
    }
    
    .emoji-picker__section-title-container {
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      margin-bottom: 8px !important;
    }
    
    .emoji-picker__section-title {
      font-size: 14px !important;
      font-weight: 600 !important;
      color: #374151 !important;
      margin: 0 !important;
    }
    
    .emoji-picker__section-emojis {
      display: grid !important;
      grid-template-columns: repeat(6, 1fr) !important;
      gap: 8px !important;
    }
    
    .emoji-picker__section-emojis img {
      width: 32px !important;
      height: 32px !important;
      cursor: pointer !important;
      border-radius: 4px !important;
      padding: 4px !important;
      transition: background-color 0.15s !important;
    }
    
    .emoji-picker__section-emojis img:hover {
      background-color: #f3f4f6 !important;
    }
    
    .emoji-picker__section-emojis img:focus {
      background-color: #e5e7eb !important;
      outline: none !important;
    }
  `;
  document.head.appendChild(style);
}

// Initialize styles matching simple.html
addSimpleHTMLStyles();

function initializeEmojiFeature() {
  console.log('[Emoji Extension] Initializing...');
  
  // Load data from storage first
  loadDataFromStorage().then(() => {
    console.log('[Emoji Extension] Data loaded from storage');
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(injectFeatures, 500);
      });
    } else {
      setTimeout(injectFeatures, 500);
    }
  });
}

function injectFeatures() {
  const toolbar = findToolbar();
  if (toolbar && !document.querySelector('.nacho-emoji-picker-button')) {
    injectButton(toolbar);
  }
}

function findToolbar(): Element | null {
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
  
  const button = document.createElement("button");
  button.classList.add('btn', 'no-text', 'btn-icon', 'toolbar__button', 'nacho-emoji-picker-button', 'emoji-extension-button');
  button.title = "表情包";
  button.type = "button";
  button.innerHTML = `🐈‍⬛`;

  let currentPicker: HTMLElement | null = null;

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    
    if (currentPicker) {
      currentPicker.remove();
      currentPicker = null;
      document.removeEventListener('click', handleClickOutside);
      return;
    }
    
    currentPicker = createEmojiPicker();
    
    // Position picker relative to button like simple.js
    const buttonRect = button.getBoundingClientRect();
    const pickerElement = currentPicker;
    
    // Add to body first to get dimensions
    document.body.appendChild(pickerElement);
    
    // Position similar to simple.js logic
    const isOnMobile = /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);
    const replyControl = document.querySelector("#reply-control");
    
    if (isOnMobile && replyControl) {
      const replyRect = replyControl.getBoundingClientRect();
      pickerElement.style.position = 'fixed';
      pickerElement.style.bottom = (window.innerHeight - replyRect.top + 5) + 'px';
      pickerElement.style.left = replyRect.left + 'px';
      pickerElement.style.right = replyRect.right + 'px';
    } else {
      const editorWrapper = document.querySelector(".d-editor-textarea-wrapper");
      if (editorWrapper) {
        const editorRect = editorWrapper.getBoundingClientRect();
        const isMinireply = replyControl?.className.includes('hide-preview') && window.innerWidth < 1600;
        
        pickerElement.style.position = 'fixed';
        
        if (isMinireply) {
          // Center above editor
          pickerElement.style.bottom = (window.innerHeight - editorRect.top + 10) + 'px';
          pickerElement.style.left = (editorRect.left + editorRect.width / 2 - 200) + 'px';
        } else {
          // Position to the right of editor
          pickerElement.style.top = editorRect.top + 'px';
          pickerElement.style.left = (editorRect.right + 10) + 'px';
        }
      } else {
        // Fallback positioning
        pickerElement.style.position = 'fixed';
        pickerElement.style.top = (buttonRect.bottom + 5) + 'px';
        pickerElement.style.left = buttonRect.left + 'px';
      }
    }
    
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);
  });

  function handleClickOutside(e: Event) {
    if (currentPicker && 
        !currentPicker.contains(e.target as Node) && 
        e.target !== button) {
      currentPicker.remove();
      currentPicker = null;
      document.removeEventListener('click', handleClickOutside);
    }
  }

  try {
    toolbar.appendChild(button);
    console.log('[Emoji Extension] Button injected successfully');
  } catch (e) {
    console.error('[Emoji Extension] Failed to inject button:', e);
  }
}

function createEmojiPicker(): HTMLElement {
  // Get current emoji data
  const allEmojis = getAllEmojis();
  
  // Create picker following simple.html structure
  const picker = document.createElement('div');
  picker.className = 'fk-d-menu -animated -expanded';
  picker.setAttribute('data-identifier', 'emoji-picker');
  picker.setAttribute('data-content', '');
  picker.setAttribute('aria-labelledby', 'emoji-picker-label');
  picker.setAttribute('aria-expanded', 'true');
  picker.setAttribute('role', 'dialog');
  picker.style.cssText = 'max-width: 400px; visibility: visible; z-index: 999999;';
  picker.setAttribute('data-strategy', 'absolute');
  picker.setAttribute('data-placement', 'top');

  const innerContent = document.createElement('div');
  innerContent.className = 'fk-d-menu__inner-content';

  const emojiPickerDiv = document.createElement('div');
  emojiPickerDiv.className = 'emoji-picker';

  // Filter container with search
  const filterContainer = document.createElement('div');
  filterContainer.className = 'emoji-picker__filter-container';

  const filterDiv = document.createElement('div');
  filterDiv.className = 'emoji-picker__filter filter-input-container';

  const searchInput = document.createElement('input');
  searchInput.className = 'filter-input';
  searchInput.placeholder = '按表情符号名称搜索…';
  searchInput.type = 'text';

  filterDiv.appendChild(searchInput);
  filterContainer.appendChild(filterDiv);

  // Content area
  const content = document.createElement('div');
  content.className = 'emoji-picker__content';

  // Section navigation
  const sectionsNav = document.createElement('div');
  sectionsNav.className = 'emoji-picker__sections-nav';

  const favButton = document.createElement('button');
  favButton.className = 'btn no-text btn-flat emoji-picker__section-btn active';
  favButton.setAttribute('tabindex', '-1');
  favButton.setAttribute('data-section', 'favorites');
  favButton.type = 'button';
  favButton.innerHTML = '⭐';

  sectionsNav.appendChild(favButton);

  // Scrollable content
  const scrollableContent = document.createElement('div');
  scrollableContent.className = 'emoji-picker__scrollable-content';

  const sections = document.createElement('div');
  sections.className = 'emoji-picker__sections';
  sections.setAttribute('role', 'button');

  // Create section
  const section = document.createElement('div');
  section.className = 'emoji-picker__section';
  section.setAttribute('data-section', 'favorites');
  section.setAttribute('role', 'region');
  section.setAttribute('aria-label', '表情');

  // Section title
  const titleContainer = document.createElement('div');
  titleContainer.className = 'emoji-picker__section-title-container';

  const title = document.createElement('h2');
  title.className = 'emoji-picker__section-title';
  title.textContent = '表情';

  titleContainer.appendChild(title);

  // Section emojis
  const sectionEmojis = document.createElement('div');
  sectionEmojis.className = 'emoji-picker__section-emojis';

  // Populate with emojis
  allEmojis.forEach((emoji) => {
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

    sectionEmojis.appendChild(img);
  });

  // Search functionality
  searchInput.addEventListener('input', (e) => {
    const query = (e.target as HTMLInputElement).value.toLowerCase();
    const images = sectionEmojis.querySelectorAll('img');
    
    images.forEach((img) => {
      const emojiName = img.getAttribute('data-emoji')?.toLowerCase() || '';
      if (query === '' || emojiName.includes(query)) {
        (img as HTMLElement).style.display = '';
      } else {
        (img as HTMLElement).style.display = 'none';
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
  console.log('[Emoji Extension] Inserting emoji:', emoji);
  
  const textArea = document.querySelector('textarea.d-editor-input') as HTMLTextAreaElement;
  const richEle = document.querySelector('.ProseMirror.d-editor-input') as HTMLElement;
  
  if (!textArea && !richEle) {
    console.error("找不到输入框");
    return;
  }

  // Get dimensions (following simple.js logic exactly)
  const match = emoji.url.match(/_(\d{3,})x(\d{3,})\./);
  let width = '500';
  let height = '500';
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
    textArea.value = textArea.value.substring(0, startPos) +
        emojiMarkdown +
        textArea.value.substring(endPos, textArea.value.length);

    textArea.selectionStart = textArea.selectionEnd = startPos + emojiMarkdown.length;
    textArea.focus();

    const event = new Event('input', { bubbles: true, cancelable: true });
    textArea.dispatchEvent(event);
  } else if (richEle) {
    // Rich text format exactly like simple.js
    const numericWidth = Number(width) || 500;
    const pixelWidth = Math.max(1, Math.round(numericWidth * (scale / 100)));
    const imgTemplate = `<img src="${emoji.url}" alt="${emoji.name}" width="${width}" height="${height}" data-scale="${scale}" style="width: ${pixelWidth}px">`;
    
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
}

// Storage sync listener
if (chrome?.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.emojiGroups) {
        cachedEmojiGroups = changes.emojiGroups.newValue || [];
        console.log('[Emoji Extension] Emoji groups updated from storage');
      }
      if (changes.appSettings) {
        cachedSettings = { ...cachedSettings, ...(changes.appSettings.newValue || {}) };
        console.log('[Emoji Extension] Settings updated from storage');
      }
    }
  });
}

// Initialize with interval checking and reload data periodically
setInterval(() => {
  const toolbar = document.querySelector('.d-editor-button-bar[role="toolbar"]');
  if (toolbar && !document.querySelector('.nacho-emoji-picker-button')) {
    injectButton(toolbar);
  }
  
  // Reload data every 30 seconds to stay in sync
  loadDataFromStorage();
}, 30000);

// More frequent check for toolbar injection
setInterval(() => {
  const toolbar = document.querySelector('.d-editor-button-bar[role="toolbar"]');
  if (toolbar && !document.querySelector('.nacho-emoji-picker-button')) {
    injectButton(toolbar);
  }
}, 500);

// Also initialize on load
initializeEmojiFeature();
