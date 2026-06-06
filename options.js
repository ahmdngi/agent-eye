// Agent Eye — Options Page

const serverUrlInput = document.getElementById('serverUrl');
const apiKeyInput = document.getElementById('apiKey');
const toggleKeyBtn = document.getElementById('toggleKey');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const saveBtn = document.getElementById('saveBtn');
const testBtn = document.getElementById('testBtn');
const toast = document.getElementById('toast');

// ── load saved config ───────────────────────────
(async () => {
  const { serverUrl, apiKey } = await chrome.storage.sync.get(['serverUrl', 'apiKey']);
  if (serverUrl) serverUrlInput.value = serverUrl;
  if (apiKey) apiKeyInput.value = apiKey;
  if (serverUrl && apiKey) testConnection(serverUrl, apiKey, false);
})();

// ── toggle key visibility ───────────────────────
toggleKeyBtn.addEventListener('click', () => {
  const t = apiKeyInput;
  t.type = t.type === 'password' ? 'text' : 'password';
  toggleKeyBtn.textContent = t.type === 'password' ? '👁' : '🙈';
});

// ── test connection ─────────────────────────────
async function testConnection(url, key, showToastMsg = true) {
  statusDot.className = 'dot unknown';
  statusText.textContent = 'Testing...';

  try {
    const res = await fetch(`${url.replace(/\/+$/, '')}/health`, {
      headers: { 'X-Api-Key': key },
    });
    if (res.ok) {
      const data = await res.json();
      statusDot.className = 'dot ok';
      statusText.textContent = `Connected ✓  (${data.pages_stored} pages stored)`;
      if (showToastMsg) showToast(`✅ Connected — ${data.pages_stored} pages stored`, 'ok');
      return true;
    } else if (res.status === 403) {
      statusDot.className = 'dot err';
      statusText.textContent = 'Invalid API key ✗';
      if (showToastMsg) showToast('❌ Invalid API key', 'err');
      return false;
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    statusDot.className = 'dot err';
    statusText.textContent = `Cannot reach server: ${err.message}`;
    if (showToastMsg) showToast(`❌ ${err.message}`, 'err');
    return false;
  }
}

testBtn.addEventListener('click', async () => {
  const url = serverUrlInput.value.trim();
  const key = apiKeyInput.value.trim();
  if (!url || !key) {
    showToast('Please enter both server URL and API key', 'err');
    return;
  }
  await testConnection(url, key, true);
});

// ── save ────────────────────────────────────────
saveBtn.addEventListener('click', async () => {
  const url = serverUrlInput.value.trim();
  const key = apiKeyInput.value.trim();

  if (!url || !key) {
    showToast('Please enter both server URL and API key', 'err');
    return;
  }

  // Test first, then save
  const ok = await testConnection(url, key, true);
  if (!ok) return;

  await chrome.storage.sync.set({ serverUrl: url, apiKey: key });
  showToast('✅ Saved successfully', 'ok');
});

// ── toast helper ────────────────────────────────
function showToast(msg, type) {
  toast.textContent = msg;
  toast.className = `toast show ${type}`;
  setTimeout(() => { toast.className = 'toast'; }, 3000);
}
