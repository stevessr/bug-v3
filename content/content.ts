import { Emoji } from '../store/emoji-data';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'INSERT_EMOJI') {
    insertEmoji(request.emoji);
    sendResponse({ status: 'success' });
  }
});

function insertEmoji(emoji: Emoji) {
  const activeElement = document.activeElement;

  if (activeElement && (activeElement.tagName === 'TEXTAREA' || (activeElement.tagName === 'INPUT' && /text|search|email|password|url/.test((activeElement as HTMLInputElement).type)))) {
    const textArea = activeElement as HTMLTextAreaElement | HTMLInputElement;
    const emojiMarkdown = `![${emoji.name}|${emoji.width || '500'}x${emoji.height || '500'},30%](${emoji.url}) `;

    const startPos = textArea.selectionStart ?? 0;
    const endPos = textArea.selectionEnd ?? 0;
    
    textArea.value = textArea.value.substring(0, startPos) + emojiMarkdown + textArea.value.substring(endPos);
    
    const newCursorPos = startPos + emojiMarkdown.length;
    textArea.selectionStart = newCursorPos;
    textArea.selectionEnd = newCursorPos;

    // Dispatch an input event to notify frameworks of the change
    const event = new Event('input', { bubbles: true, cancelable: true });
    textArea.dispatchEvent(event);
    
    textArea.focus();
  }
}
