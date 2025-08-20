import { createApp, ref } from "vue";
import EmojiPicker from "./EmojiPicker.vue";

function initializeEmojiFeature() {
  const targetNode = document.body;
  const config = { childList: true, subtree: true };

  const observer = new MutationObserver((mutationsList, obs) => {
    const toolbar = document.querySelector(".d-editor-button-bar");
    if (toolbar && !document.getElementById("custom-emoji-button")) {
      injectButton(toolbar);
      // We don't disconnect here to handle dynamic UI changes where the editor might be removed and re-added.
    }
  });

  observer.observe(targetNode, config);
}

function injectButton(toolbar: Element) {
  // 1. Create the button
  const button = document.createElement("button");
  button.id = "custom-emoji-button";
  button.className = "btn no-text btn-icon toolbar__button";
  button.title = "Insert Emoji";
  button.innerHTML = `<svg class="fa d-icon d-icon-far-face-smile svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#far-face-smile"></use></svg>`;

  // 2. Create the Vue app container
  let pickerContainer = document.getElementById("emoji-picker-app-container");
  if (!pickerContainer) {
    pickerContainer = document.createElement("div");
    pickerContainer.id = "emoji-picker-app-container";
    document.body.appendChild(pickerContainer);
  }

  // 3. Mount the Vue component
  const app = createApp(EmojiPicker, {
    visible: false, // Initially hidden
    onClose: () => {
      if (pickerContainer) {
        pickerContainer.style.display = "none";
      }
    },
  });
  app.mount(pickerContainer);
  pickerContainer.style.display = "none"; // Ensure it's hidden initially

  // 4. Add click listener to the button
  button.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (pickerContainer) {
      const isVisible = pickerContainer.style.display === "block";
      if (isVisible) {
        pickerContainer.style.display = "none";
      } else {
        const rect = button.getBoundingClientRect();
        const pickerContent = pickerContainer.firstChild as HTMLElement;
        const pickerHeight = pickerContent ? pickerContent.clientHeight : 250; // Fallback height

        pickerContainer.style.display = "block";
        pickerContainer.style.position = "absolute";
        pickerContainer.style.top = `${window.scrollY + rect.top - pickerHeight - 5}px`;
        pickerContainer.style.left = `${window.scrollX + rect.left}px`;
      }
    }
  });

  // 5. Hide picker when clicking outside
  document.addEventListener("click", (e) => {
    if (pickerContainer && pickerContainer.style.display === 'block') {
        if (!pickerContainer.contains(e.target as Node) && e.target !== button) {
            pickerContainer.style.display = "none";
        }
    }
  });

  // 6. Inject the button into the toolbar
  toolbar.appendChild(button);
}

initializeEmojiFeature();
