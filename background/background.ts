console.log('Background script loaded.');

chrome.runtime.onInstalled.addListener(() => {
  console.log('Emoji extension installed.');
});
