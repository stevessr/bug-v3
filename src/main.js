// Use dynamic imports so this script can be loaded as a non-module content script
console.log('[Nachoneko] Script loaded. Independent picker strategy active.');

(async () => {
    // ensure htmx is bundled and available
    await import('./htmx.ts');
    // Migrate existing settings from chrome.storage.sync to chrome.storage.local (if any)
    async function migrateStorage() {
        if (!chrome || !chrome.storage || !chrome.storage.sync) return;
        try {
            const keysToCheck = ['emojiData', 'insertScale'];
            const syncData = await chrome.storage.sync.get(keysToCheck);
            const toRemove = [];
            for (const k of keysToCheck) {
                if (syncData && Object.prototype.hasOwnProperty.call(syncData, k) && syncData[k] !== undefined) {
                    const payload = {};
                    payload[k] = syncData[k];
                    await chrome.storage.local.set(payload);
                    toRemove.push(k);
                }
            }
            if (toRemove.length) {
                try { await chrome.storage.sync.remove(toRemove); } catch (e) { /* best-effort */ }
                console.info('[Nachoneko] Migrated storage keys to local:', toRemove);
            }
        } catch (e) {
            console.warn('[Nachoneko] Storage migration failed:', e);
        }
    }
    await migrateStorage();
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

