;(async () => {
  const src = chrome.runtime.getURL('js/content.js')
  await import(src)
})()
