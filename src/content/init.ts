import { loadDataFromStorage } from "./storage";
import { findToolbar, injectButton } from "./injector";
import { initOneClickAdd } from "./oneClickAdd";
import { logger } from "./buildFlags";

export async function initializeEmojiFeature(
  maxInjectionAttempts: number = 10,
  delay: number = 1000
) {
  logger.log("[Emoji Extension] Initializing (module)...");
  await loadDataFromStorage();

  // 初始化一键添加表情功能
  initOneClickAdd();

  let injectionAttempts = 0;

  function attemptInjection() {
    injectionAttempts++;
    const toolbar = findToolbar();
    if (toolbar) {
      logger.log("[Emoji Extension] Toolbar found, injecting button.");
      injectButton(toolbar);
    } else if (injectionAttempts < maxInjectionAttempts) {
      logger.log(
        `[Emoji Extension] Toolbar not found, attempt ${injectionAttempts}/${maxInjectionAttempts}. Retrying ${
          delay / 1000
        } s.`
      );
      setTimeout(attemptInjection, delay);
    } else if (maxInjectionAttempts < 20) {
      initializeEmojiFeature(20, 2000);
    } else if (maxInjectionAttempts < 40) {
      initializeEmojiFeature(40, 4000);
    } else if (maxInjectionAttempts < 80) {
      initializeEmojiFeature(80, 8000);
    } else if (maxInjectionAttempts < 160) {
      initializeEmojiFeature(160, 16000);
    } else if (maxInjectionAttempts < 320) {
      initializeEmojiFeature(320, 32000);
    } else if (maxInjectionAttempts < 640) {
      initializeEmojiFeature(640, 64000);
    } else {
      logger.error(
        "[Emoji Extension] Failed to find toolbar after multiple attempts. Button injection failed. 我感觉你是人机"
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
        if (message.type === "SETTINGS_UPDATED") {
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
