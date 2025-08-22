import { loadDataFromStorage } from "./storage";
import { findToolbar, injectButton } from "./injector";

export async function initializeEmojiFeature() {
  console.log('[Emoji Extension] Initializing (module)...');
  await loadDataFromStorage();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { setTimeout(() => { injectFeatures(); }, 500); });
  } else {
    setTimeout(() => { injectFeatures(); }, 500);
  }

  function injectFeatures() {
    const toolbar = findToolbar();
    if (toolbar && !document.querySelector('.nacho-emoji-picker-button')) {
      injectButton(toolbar);
    }
  }

  // storage change listener (using chrome.storage.onChanged if available)
  if ((window as any).chrome?.storage?.onChanged) {
    (window as any).chrome.storage.onChanged.addListener((changes: any, namespace: string) => {
      if (namespace === 'local') {
        const relevantKeys = ['emojiGroups','emojiGroupIndex','appSettings'];
        const hasRelevant = Object.keys(changes).some(k => relevantKeys.includes(k) || k.startsWith('emojiGroup_'));
        if (hasRelevant) {
          console.log('[Emoji Extension] Storage change detected (module), reloading data');
          loadDataFromStorage();
        }
      }
    });
  }

  // periodic checks
  setInterval(() => {
    const toolbar = findToolbar();
    if (toolbar && !document.querySelector('.nacho-emoji-picker-button')) {
      console.log('[Emoji Extension] Toolbar found but button missing, injecting... (module)');
      injectButton(toolbar);
    }
  }, 30000);

  setInterval(() => { console.log('[Emoji Extension] Periodic data reload (module)'); loadDataFromStorage(); }, 120000);

  setInterval(() => {
    const toolbar = findToolbar();
    if (toolbar && !document.querySelector('.nacho-emoji-picker-button')) {
      injectButton(toolbar);
    }
  }, 500);
}
