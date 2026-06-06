// Hermes Page Viz — Background Service Worker

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Open options page on first install
    chrome.runtime.openOptionsPage();
  }
  console.log('[Hermes Page Viz] v1.0.0 ready');
});

// Open options from context menu or popup request
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openOptions') {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
  }
  return false;
});
