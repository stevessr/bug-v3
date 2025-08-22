import { createEmojiPicker } from './picker';

export function findToolbar(): Element | null {
  const toolbar = document.querySelector('.d-editor-button-bar[role="toolbar"]');
  if (toolbar) {
    // no noisy log here; init module will log when needed
    return toolbar;
  }
  return null;
}

export function injectButton(toolbar: Element) {
  const button = document.createElement('button');
  button.classList.add('btn','no-text','btn-icon','toolbar__button','nacho-emoji-picker-button','emoji-extension-button');
  button.title = '表情包'; button.type = 'button'; button.innerHTML = `🐈‍⬛`;

  let currentPicker: HTMLElement | null = null;

  button.addEventListener('click', async (event) => {
    event.stopPropagation();
    if (currentPicker) { currentPicker.remove(); currentPicker = null; document.removeEventListener('click', handleClickOutside); return; }
    currentPicker = await createEmojiPicker();
    const buttonRect = button.getBoundingClientRect();
    const pickerElement = currentPicker;
    if (pickerElement) document.body.appendChild(pickerElement);

    const isOnMobile = /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);
    const replyControl = document.querySelector('#reply-control');
    if (pickerElement) {
      if (isOnMobile && replyControl) {
        const replyRect = replyControl.getBoundingClientRect();
        pickerElement.style.position = 'fixed';
        pickerElement.style.bottom = window.innerHeight - replyRect.top + 5 + 'px';
        pickerElement.style.left = replyRect.left + 'px';
        pickerElement.style.right = replyRect.right + 'px';
      } else {
        const editorWrapper = document.querySelector('.d-editor-textarea-wrapper');
        if (editorWrapper) {
          const editorRect = editorWrapper.getBoundingClientRect();
          const isMinireply = replyControl?.className.includes('hide-preview') && window.innerWidth < 1600;
          pickerElement.style.position = 'fixed';
          if (isMinireply) {
            pickerElement.style.bottom = window.innerHeight - editorRect.top + 10 + 'px';
            pickerElement.style.left = editorRect.left + editorRect.width / 2 - 200 + 'px';
          } else {
            const pickerRect = pickerElement.getBoundingClientRect();
            pickerElement.style.top = buttonRect.top - pickerRect.height - 5 + 'px';
            pickerElement.style.left = buttonRect.left + buttonRect.width / 2 - pickerRect.width / 2 + 'px';
            if (pickerElement.getBoundingClientRect().top < 0) {
              pickerElement.style.top = buttonRect.bottom + 5 + 'px';
            }
          }
        } else {
          pickerElement.style.position = 'fixed';
          pickerElement.style.top = buttonRect.bottom + 5 + 'px';
          pickerElement.style.left = buttonRect.left + 'px';
        }
      }
    }

    setTimeout(() => { document.addEventListener('click', handleClickOutside); }, 100);
  });

  function handleClickOutside(e: Event) {
    if (currentPicker && !currentPicker.contains(e.target as Node) && e.target !== button) {
      currentPicker.remove(); currentPicker = null; document.removeEventListener('click', handleClickOutside);
    }
  }

  try { toolbar.appendChild(button); } catch (e) { console.error('[Emoji Extension] Failed to inject button (module):', e); }
}
