import { createEmojiPicker, isMobile } from "./picker";
import { cachedState } from "./state";

export function findToolbar(): Element | null {
  const toolbar = document.querySelector(
    '.d-editor-button-bar[role="toolbar"]'
  );
  if (toolbar) {
    return toolbar;
  }
  return null;
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

export function injectButton(toolbar: Element) {
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

  button.addEventListener("click", async (event) => {
    event.stopPropagation();
    if (currentPicker) {
      currentPicker.remove();
      currentPicker = null;
      document.removeEventListener("click", (event) =>
        handleClickOutside(event, button)
      );
      return;
    }

    // Use cached settings instead of reading from storage directly
    const forceMobile = (cachedState.settings as any)?.forceMobileMode || false;

    if (forceMobile || isMobile()) {
      injectMobilePicker();
    } else {
      injectDesktopPicker(button);
    }
  });

  try {
    toolbar.appendChild(button);
  } catch (e) {
    console.error("[Emoji Extension] Failed to inject button (module):", e);
  }
}
