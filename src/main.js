// Use dynamic imports so this script can be loaded as a non-module content script
console.log('[Nachoneko] Script loaded. Independent picker strategy active.');

(async () => {
    try {
        const { createEmojiMenu } = await import('./emoji-menu.js');
        const { injectEmojiButton } = await import('./emoji-button-injection.js');
        const { emojiSet } = await import('./emoji-data.js');

        const nachoCustomPicker = createEmojiMenu(emojiSet);
        injectEmojiButton(nachoCustomPicker);

        // Debugging: Check if the picker element exists and its initial display style
        console.log('Picker element exists:', !!nachoCustomPicker);
        if (nachoCustomPicker) {
            console.log('Picker initial display style:', nachoCustomPicker.style.display);
        }
    } catch (e) {
        console.error('[Nachoneko] Failed to initialize emoji picker:', e);
    }
})();

