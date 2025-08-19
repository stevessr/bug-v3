import { emojiSet } from "./emoji-data.js";
import { handleInsert } from "./emoji-input.js";

const nachoCustomPickerHTML = `
<div
  id="nacho-custom-picker"
  class="fk-d-menu -animated"
  data-identifier="emoji-picker"
  data-content=""
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
          <svg
            class="fa d-icon d-icon-magnifying-glass svg-icon -right svg-string"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
          >
            <use href="#magnifying-glass"></use>
          </svg>
        </div>

        <button
          class="btn no-text fk-d-menu__trigger -trigger emoji-picker__diversity-trigger btn-transparent"
          aria-expanded="false"
          data-trigger=""
          type="button"
          id="ember162"
        >
          <img
            width="20"
            height="20"
            src="/images/emoji/twemoji/clap.png?v=14"
            title="clap"
            alt="clap"
            class="emoji"
          />
        </button>
      </div>
      <div class="emoji-picker__content">
        <div class="emoji-picker__sections-nav">
          <!-- My Nacho button will be injected here -->
          <button class="btn no-text btn-flat emoji-picker__section-btn nacho-section-btn" type="button" title="Nachoneko">🐈‍⬛</button>
        </div>
        <div class="emoji-picker__scrollable-content">
          <div class="emoji-picker__sections" role="button">
            <!-- My Nacho section will go here -->
            <div class="emoji-picker__section nacho-section-container" data-section="nachoneko" role="region" aria-label="Nachoneko表情包">
                <div class="emoji-picker__section-title-container">
                    <h2 class="emoji-picker__section-title">Nachoneko表情包</h2>
                </div>
                <div class="emoji-picker__section-emojis nacho-emojis-grid">
                    <!-- Emojis will be injected here -->
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
`;

export function createEmojiMenu() {
  // 1. Inject the independent picker HTML structure once
  document.body.insertAdjacentHTML("beforeend", nachoCustomPickerHTML);
  const nachoCustomPicker = document.getElementById("nacho-custom-picker");

  // 2. Populate the Nacho emoji grid (once)
  const nachoEmojisGrid = nachoCustomPicker.querySelector(".nacho-emojis-grid");
  let emojiGridHTML = "";
  emojiSet.forEach((emo) => {
    emojiGridHTML += `<img width="32" height="32" class="emoji nacho-emoji" src="${emo.url}" alt="${emo.name}" title=":${emo.name}:" tabindex="-1" data-emoji="${emo.name}" loading="lazy">`;
  });
  nachoEmojisGrid.innerHTML = emojiGridHTML;

  // 3. Get references to key elements within the custom picker
  const pickerNavContainer = nachoCustomPicker.querySelector(
    ".emoji-picker__sections-nav"
  );
  const nachoSectionButton =
    nachoCustomPicker.querySelector(".nacho-section-btn");
  const nachoSectionContainer = nachoCustomPicker.querySelector(
    ".nacho-section-container"
  );

  // 6. Category switching logic (within independent picker)
  pickerNavContainer.addEventListener("click", (e) => {
    const targetButton = e.target.closest(".emoji-picker__section-btn");
    if (!targetButton) return;

    const allSections = nachoCustomPicker.querySelectorAll(
      ".emoji-picker__section"
    );
    const allNavButtons = nachoCustomPicker.querySelectorAll(
      ".emoji-picker__section-btn"
    );

    // Hide all sections first
    allSections.forEach((s) => (s.style.display = "none"));

    if (targetButton.classList.contains("nacho-section-btn")) {
      nachoSectionContainer.style.display = "block";
    } else {
      // This part is tricky. We need to find the native section corresponding to the clicked button.
      // Assuming native sections have data-section attribute matching the button's data-section.
      const nativeSectionData = targetButton.getAttribute("data-section");
      const nativeSection = nachoCustomPicker.querySelector(
        `.emoji-picker__section[data-section="${nativeSectionData}"]`
      );
      if (nativeSection) {
        nativeSection.style.display = "block";
      }
    }

    // Update active state for nav buttons
    allNavButtons.forEach((b) => b.classList.remove("active"));
    targetButton.classList.add("active");
  });

  // 7. Emoji click handler (within independent picker)
  nachoEmojisGrid.addEventListener("click", (e) => {
    const targetEmojiImg = e.target.closest("img.nacho-emoji");
    if (!targetEmojiImg) return;

    const emojiData = emojiSet.find(
      (emo) => ":" + emo.name + ":" === targetEmojiImg.title
    );
    if (emojiData) {
      handleInsert(emojiData);
    }
  });

  // 8. Close on outside click
  document.addEventListener("click", (e) => {
    const toolbarButton = document.querySelector(".nacho-toolbar-btn");
    if (
      nachoCustomPicker.classList.contains("show-picker") &&
      !nachoCustomPicker.contains(e.target) &&
      !toolbarButton.contains(e.target)
    ) {
      nachoCustomPicker.classList.remove("show-picker");
    }
  });

  return nachoCustomPicker;
}
