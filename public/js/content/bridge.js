window.addEventListener("message", (event) => {
  if (!event.source || event.source !== window) return;
  const msg = event.data;
  if (!msg || msg.__emoji_ext_bridge !== true) return;
  try {
    chrome.runtime.sendMessage(msg.payload);
  } catch (e) {
    console.warn("[injectedBridge] sendMessage failed", e);
  }
});
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  try {
    window.postMessage({ __emoji_ext_bridge: true, from: "background", payload: message }, "*");
  } catch (e) {
  }
  return false;
});
window.__emojiExtensionBridge = {
  request(payload) {
    return new Promise((resolve) => {
      try {
        const listener = (ev) => {
          if (ev.source !== window) return;
          const data = ev.data;
          if (data && data.__emoji_ext_bridge_response === true && data.requestId === requestId) {
            window.removeEventListener("message", listener);
            resolve(data.payload);
          }
        };
        const requestId = Math.random().toString(36).slice(2);
        window.addEventListener("message", listener);
        window.postMessage({ __emoji_ext_bridge: true, payload, requestId, from: "page" }, "*");
      } catch (e) {
        resolve(null);
      }
    });
  }
};
