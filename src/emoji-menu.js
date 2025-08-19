import { handleInsert } from "./emoji-input.js";

const EMOJI_STORAGE_KEY = 'emojiData';

const nachoCustomPickerHTML = `
<div
  id="nacho-custom-picker"
  class="fk-d-menu -animated"
  data-identifier="emoji-picker"
  aria-labelledby="ember161"
  aria-expanded="false"
  role="dialog"
  data-strategy="absolute"
  data-placement="top"
>
  <div class="fk-d-menu__inner-content">
    <div class="emoji-picker">
      <div class="emoji-picker__filter-container">
        <div class="emoji-picker__filter filter-input-container">
          <input
            class="filter-input"
            placeholder="按表情符号名称和别名搜索…"
            type="text"
          />
        </div>
      </div>
      <div class="emoji-picker__content">
        <div class="emoji-picker__sections-nav">
          <!-- Group navigation buttons will be injected here -->
        </div>
        <div class="emoji-picker__scrollable-content">
          <div class="emoji-picker__sections" role="button">
            <!-- Group sections will be injected here -->
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
`;

// Function to get emoji data from storage, or initialize it
async function getEmojiData(defaultEmojiSet) {
  let data = await chrome.storage.local.get(EMOJI_STORAGE_KEY);
  if (data && data[EMOJI_STORAGE_KEY]) {
    return data[EMOJI_STORAGE_KEY];
  } else {
    const initialData = [{
      group: 'Default Emojis',
      emojis: defaultEmojiSet
    }];
    await chrome.storage.local.set({ [EMOJI_STORAGE_KEY]: initialData });
    return initialData;
  }
}

export function createEmojiMenu(defaultEmojiSet) {
  document.body.insertAdjacentHTML("beforeend", nachoCustomPickerHTML);
  const nachoCustomPicker = document.getElementById("nacho-custom-picker");

  const navContainer = nachoCustomPicker.querySelector(".emoji-picker__sections-nav");
  const sectionsContainer = nachoCustomPicker.querySelector(".emoji-picker__sections");

  let allEmojiData = [];

  // Function to render the entire emoji menu from data
  function renderMenu(emojiData) {
    allEmojiData = emojiData;
    navContainer.innerHTML = '';
    sectionsContainer.innerHTML = '';

    emojiData.forEach((group, index) => {
      // Create nav button
      const navButton = document.createElement('button');
      navButton.className = 'btn no-text btn-flat emoji-picker__section-btn';
      navButton.title = group.group;
      navButton.textContent = group.group.substring(0, 2);
      navButton.dataset.groupIndex = index;
      navContainer.appendChild(navButton);

      // Create section
      const section = document.createElement('div');
      section.className = 'emoji-picker__section';
      section.dataset.groupIndex = index;
      section.innerHTML = `
        <div class="emoji-picker__section-title-container">
          <h2 class="emoji-picker__section-title">${group.group}</h2>
        </div>
        <div class="emoji-picker__section-emojis nacho-emojis-grid">
          ${group.emojis.map(emo => 
            `<img width="32" height="32" class="emoji nacho-emoji" src="${emo.url}" alt="${emo.name}" title=":${emo.name}:" data-emoji-name="${emo.name}" loading="lazy">`
          ).join('')}
        </div>
      `;
      sectionsContainer.appendChild(section);
    });

    // Set initial active group
    if (navContainer.firstChild) {
        navContainer.firstChild.classList.add('active');
    }
    if (sectionsContainer.firstChild) {
        sectionsContainer.childNodes.forEach(s => s.style.display = 'none');
        sectionsContainer.firstChild.style.display = 'block';
    }
  }

  // Load data and render the menu
  getEmojiData(defaultEmojiSet).then(renderMenu);

  // Category switching logic
  navContainer.addEventListener("click", (e) => {
    const targetButton = e.target.closest(".emoji-picker__section-btn");
    if (!targetButton) return;

    const groupIndex = targetButton.dataset.groupIndex;

    // Update nav buttons
    navContainer.querySelectorAll('.emoji-picker__section-btn').forEach(btn => btn.classList.remove('active'));
    targetButton.classList.add('active');

    // Update sections
    sectionsContainer.querySelectorAll('.emoji-picker__section').forEach(sec => {
        if (sec.dataset.groupIndex === groupIndex) {
            sec.style.display = 'block';
        } else {
            sec.style.display = 'none';
        }
    });
  });

  // Emoji click handler
  sectionsContainer.addEventListener("click", (e) => {
    const targetEmojiImg = e.target.closest("img.nacho-emoji");
    if (!targetEmojiImg) return;

    const imgSrc = targetEmojiImg.getAttribute('src');
    const imgAlt = targetEmojiImg.getAttribute('alt') || targetEmojiImg.getAttribute('title') || '';

    // Try to find original emoji data by src or name
    let clickedEmojiData = null;
    for (const group of allEmojiData) {
      const foundBySrc = group.emojis.find(emo => emo.url === imgSrc);
      if (foundBySrc) { clickedEmojiData = foundBySrc; break; }
      const foundByName = group.emojis.find(emo => emo.name === imgAlt);
      if (foundByName) { clickedEmojiData = foundByName; break; }
    }

    // Build an object compatible with handleInsert
    const payload = {
      alt: clickedEmojiData ? (clickedEmojiData.name || imgAlt) : imgAlt,
      src: clickedEmojiData ? (clickedEmojiData.url || imgSrc) : imgSrc,
      width: clickedEmojiData ? clickedEmojiData.width : undefined,
      height: clickedEmojiData ? clickedEmojiData.height : undefined,
    };

    if (!payload.src) {
      console.warn('[Nachoneko] Clicked emoji has no src, skipping insert.');
      return;
    }

    try {
      handleInsert(payload);
    } catch (err) {
      console.error('[Nachoneko] handleInsert failed:', err, payload);
    }
  });

  // Close on outside click
  document.addEventListener("click", (e) => {
    const toolbarButton = document.querySelector(".nacho-toolbar-btn");
    if (
      nachoCustomPicker.classList.contains("show-picker") &&
      !nachoCustomPicker.contains(e.target) &&
      (!toolbarButton || !toolbarButton.contains(e.target))
    ) {
      nachoCustomPicker.classList.remove("show-picker");
    }
  });

  return nachoCustomPicker;
}