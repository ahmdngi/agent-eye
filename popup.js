// Agent Eye — Popup

const $ = (sel) => document.querySelector(sel);
const statusDot = $('#statusDot');
const statusText = $('#statusText');
const content = $('#content');
const shareBtn = $('#shareBtn');
const copyBtn = $('#copyBtn');
const toast = $('#toast');

function setStatus(text, state = 'ok') {
  statusText.textContent = text;
  statusDot.className = 'status-dot' + (state === 'loading' ? ' loading' : '');
}

function showToast(msg, isErr = false) {
  toast.textContent = msg;
  toast.className = 'toast show' + (isErr ? ' err' : '');
  setTimeout(() => { toast.className = 'toast'; }, 2500);
}

// ── read server config ──────────────────────────
async function getServerConfig() {
  const { serverUrl, apiKey } = await chrome.storage.sync.get(['serverUrl', 'apiKey']);
  return { serverUrl, apiKey };
}

// ── main ────────────────────────────────────────
(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    content.innerHTML = `<div class="error-msg"><p>❌ No active tab found</p></div>`;
    setStatus('No tab');
    shareBtn.disabled = true;
    return;
  }
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
    content.innerHTML = `<div class="error-msg"><p>🔒 Cannot inspect browser pages</p></div>`;
    setStatus('Restricted');
    shareBtn.disabled = true;
    return;
  }

  setStatus('Analyzing...', 'loading');

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageData,
    });
    const data = results[0]?.result;
    if (!data || data.error) throw new Error(data?.error || 'No data');

    render(data);

    // Check server config
    const config = await getServerConfig();
    const configured = !!(config.serverUrl && config.apiKey);
    if (!configured) {
      shareBtn.textContent = '⚙ Configure server first';
      shareBtn.disabled = false;
      shareBtn.onclick = () => chrome.runtime.openOptionsPage();
      setStatus('Not configured');
    } else {
      shareBtn.disabled = false;
      setStatus(data.title || 'Ready');
    }
  } catch (err) {
    content.innerHTML = `<div class="error-msg"><p>❌ ${err.message}</p></div>`;
    setStatus('Error', 'err');
    shareBtn.disabled = true;
  }
})();

// ── render ──────────────────────────────────────
function render(data) {
  const html = `
    <div class="section">
      <div class="section-title">Page Info</div>
      <div class="field">
        <div class="field-label">Title</div>
        <div class="field-value">${esc(data.title || '—')}</div>
      </div>
      <div class="field">
        <div class="field-label">URL</div>
        <div class="field-value url">${esc(data.url)}</div>
      </div>
      <div class="field">
        <div class="field-label">Description</div>
        <div class="field-value" style="color:var(--text-muted)">${esc(data.description || '—')}</div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">Meta & Open Graph</div>
      <div class="meta-grid">
        ${data.metaTags?.length
          ? data.metaTags.map(m => `
            <div class="field">
              <div class="field-label">${esc(m.name)}</div>
              <div class="field-value code" style="font-size:11px;color:var(--accent-hover)">${esc(m.content || '')}</div>
            </div>`).join('')
          : '<div class="field"><div class="field-value" style="color:var(--text-muted)">None found</div></div>'
        }
      </div>
    </div>
    ${data.headings?.length ? `
    <div class="section">
      <div class="section-title">Headings (${data.headings.length})</div>
      <ul class="headings-list">
        ${data.headings.map(h => `<li><span class="h-tag">${h.tag}</span>${esc(h.text || '…')}</li>`).join('')}
      </ul>
    </div>` : ''}
    ${data.words ? `
    <div class="section">
      <div class="section-title">Stats</div>
      <div class="tags">
        <span class="tag">${data.words} words</span>
        <span class="tag">${data.links} links</span>
        <span class="tag">${data.images} images</span>
      </div>
    </div>` : ''}
  `;
  content.innerHTML = html;
}

function esc(s) {
  const div = document.createElement('div');
  div.textContent = s || '';
  return div.innerHTML;
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

// ── Share: POST to server ───────────────────────
shareBtn.addEventListener('click', async () => {
  const config = await getServerConfig();
  if (!config.serverUrl || !config.apiKey) {
    chrome.runtime.openOptionsPage();
    return;
  }

  shareBtn.disabled = true;
  shareBtn.textContent = '⏳ Sending...';
  setStatus('Sharing...', 'loading');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
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
    showToast(`✅ Shared (${result.id})`);
    setStatus('Shared ✓');
  } catch (err) {
    showToast(`❌ ${err.message}`, true);
    if (err.message.includes('403') || err.message.includes('401')) {
      shareBtn.textContent = '⚙ Configure server';
      shareBtn.onclick = () => chrome.runtime.openOptionsPage();
      setStatus('Auth error');
    } else {
      shareBtn.textContent = '📤 Retry';
      setStatus('Error', 'err');
    }
  } finally {
    setTimeout(() => {
      shareBtn.disabled = false;
      if (shareBtn.textContent === '⏳ Sending...' || shareBtn.textContent.startsWith('Retry')) {
        shareBtn.textContent = '📤 Share';
        shareBtn.onclick = null; // reset
      }
    }, 1500);
  }
});

// ── Copy URL ────────────────────────────────────
copyBtn.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await navigator.clipboard.writeText(tab.url);
    showToast('✅ URL copied');
  } catch (err) {
    showToast('Failed to copy', true);
  }
});
