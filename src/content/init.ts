import { loadDataFromStorage } from "./storage";
import { findToolbar, injectButton } from "./injector";
import { initOneClickAdd } from "./oneClickAdd";
import { logger } from "./buildFlags";

export async function initializeEmojiFeature() {
  logger.log("[Emoji Extension] Initializing (module)...");
  await loadDataFromStorage();

  // 初始化一键添加表情功能
  initOneClickAdd();

  let injectionAttempts = 0;
  const maxInjectionAttempts = 10;

  function attemptInjection() {
    injectionAttempts++;
    const toolbar = findToolbar();
    if (toolbar) {
      logger.log("[Emoji Extension] Toolbar found, injecting button.");
      injectButton(toolbar);
    } else if (injectionAttempts < maxInjectionAttempts) {
      logger.log(
        `[Emoji Extension] Toolbar not found, attempt ${injectionAttempts}/${maxInjectionAttempts}. Retrying in 1s.`
      );
      setTimeout(attemptInjection, 1000);
    } else {
      logger.error(
        "[Emoji Extension] Failed to find toolbar after multiple attempts. Button injection failed."
      );
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attemptInjection);
  } else {
    attemptInjection();
  }

  // storage change listener (using chrome.storage.onChanged if available)
  if ((window as any).chrome?.storage?.onChanged) {
    (window as any).chrome.storage.onChanged.addListener(
      (changes: any, namespace: string) => {
        if (namespace === "local") {
          const relevantKeys = [
            "emojiGroups",
            "emojiGroupIndex",
            "appSettings",
          ];
          const hasRelevant = Object.keys(changes).some(
            (k) => relevantKeys.includes(k) || k.startsWith("emojiGroup_")
          );
          if (hasRelevant) {
            logger.log(
              "[Emoji Extension] Storage change detected (module), reloading data"
            );
            loadDataFromStorage();
          }
        }
      }
    );
  }

  // Listen for settings updates from background script
  if ((window as any).chrome?.runtime?.onMessage) {
    (window as any).chrome.runtime.onMessage.addListener(
      (message: any, _sender: any, _sendResponse: any) => {
        if (message.type === 'SETTINGS_UPDATED') {
          logger.log(
            "[Emoji Extension] Settings updated from background, reloading data"
          );
          loadDataFromStorage();
        }
      }
    );
  }

  // periodic checks
  setInterval(() => {
    const toolbar = findToolbar();
    if (toolbar && !document.querySelector(".nacho-emoji-picker-button")) {
      logger.log(
        "[Emoji Extension] Toolbar found but button missing, injecting... (module)"
      );
      injectButton(toolbar);
    }
  }, 30000);

  setInterval(() => {
    logger.log("[Emoji Extension] Periodic data reload (module)");
    loadDataFromStorage();
  }, 120000);
}
