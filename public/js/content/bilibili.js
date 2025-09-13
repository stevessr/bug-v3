console.log("[Emoji Extension] content-bilibili loaded");
try {
  const init = window.__emoji_bilibili_init;
  if (typeof init === "function") {
    init();
  } else {
    console.warn("[content-bilibili] init function not available on window");
  }
} catch (e) {
  console.error("[content-bilibili] initBilibili failed", e);
}
