// Agent Eye — Background Service Worker

const SHARE_CMD = 'share-page';

async function getServerConfig() {
  const { serverUrl, apiKey } = await chrome.storage.sync.get(['serverUrl', 'apiKey']);
  return { serverUrl, apiKey };
}

async function shareCurrentPage(tabId) {
  const config = await getServerConfig();
  if (!config.serverUrl || !config.apiKey) {
    chrome.action.setBadgeText({ text: '!cfg', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#f59e0b', tabId });
    setTimeout(() => chrome.action.setBadgeText({ text: '', tabId }), 3000);
    return;
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractPageData,
    });
    const data = results[0]?.result;
    if (!data) throw new Error('No page data');

    const payload = {
      timestamp: new Date().toISOString(),
      sessionId: 'webui',
      client_version: '1.0.0',
      page: data,
    };

    const baseUrl = config.serverUrl.replace(/\/+$/, '');
    const res = await fetch(`${baseUrl}/api/v1/pages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': config.apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}${errBody ? ': ' + errBody : ''}`);
    }

    const result = await res.json();
    chrome.action.setBadgeText({ text: '✓', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e', tabId });
    setTimeout(() => chrome.action.setBadgeText({ text: '', tabId }), 3000);
  } catch (err) {
    chrome.action.setBadgeText({ text: '✗', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444', tabId });
    setTimeout(() => chrome.action.setBadgeText({ text: '', tabId }), 3000);
  }
}

// ── content script (runs in page context) ───────
function extractPageData() {
  const getMeta = (name) => {
    const el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
    return el?.getAttribute('content') || null;
  };
  const metaTags = [];
  const seen = new Set();
  document.querySelectorAll('meta').forEach(el => {
    const name = el.getAttribute('name') || el.getAttribute('property') || '';
    const content = el.getAttribute('content') || '';
    if (name && content && !seen.has(name)) {
      seen.add(name);
      if (/^(description|keywords|og:|twitter:|author|viewport)/i.test(name)) {
        metaTags.push({ name, content });
      }
    }
  });
  const headings = [];
  document.querySelectorAll('h1, h2, h3').forEach(h => {
    const text = h.textContent.trim();
    if (text) headings.push({ tag: h.tagName, text: text.slice(0, 200) });
  });
  const bodyText = document.body?.innerText || '';
  const ws = bodyText.replace(/\s+/g, ' ').trim();
  return {
    title: document.title,
    url: window.location.href,
    description: getMeta('description') || getMeta('og:description') || '',
    metaTags,
    headings,
    words: ws ? ws.split(' ').length : 0,
    links: document.querySelectorAll('a[href]').length,
    images: document.querySelectorAll('img[src]').length,
    excerpt: ws.slice(0, 2000),
  };
}

// ── Install / update ────────────────────────────
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  }

  // Create context menu
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: SHARE_CMD,
      title: 'Share page with agent',
      contexts: ['page'],
    });
  });

  console.log('[Agent Eye] v1.0.0 ready');
});

// ── Context menu click handler ──────────────────
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === SHARE_CMD && tab?.id) {
    shareCurrentPage(tab.id);
  }
});

// ── Keyboard command handler ────────────────────
chrome.commands.onCommand.addListener((command) => {
  if (command === SHARE_CMD) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.id) {
        shareCurrentPage(tab.id);
      }
    });
  }
});

// Open options from popup request
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openOptions') {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
  }
  return false;
});
