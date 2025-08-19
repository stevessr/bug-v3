import { createEmojiMenu } from './emoji-menu.js';
import { injectEmojiButton } from './emoji-button-injection.js';

console.log('[Nachoneko] Script loaded. Independent picker strategy active.');

const nachoCustomPicker = createEmojiMenu();
injectEmojiButton(nachoCustomPicker);

// Debugging: Check if the picker element exists and its initial display style
console.log('Picker element exists:', !!nachoCustomPicker);
if (nachoCustomPicker) {
    console.log('Picker initial display style:', nachoCustomPicker.style.display);
}

