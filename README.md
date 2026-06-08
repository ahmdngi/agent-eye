# Agent Eye

**Share any web page you're browsing with your AI agent in one click.**  
Chrome extension + authenticated API server for secure, production-ready page sharing.

🌐 **Repo:** https://github.com/ahmdngi/agent-eye  
📦 **Install skill:** `hermes skills install https://raw.githubusercontent.com/ahmdngi/agent-eye/main/SKILL.md`

## Architecture

```
┌─────────────────┐     POST /api/v1/pages     ┌──────────────────┐
│  Chrome         │  ──────────────────────────→ │  Agent Eye       │
│  Extension      │     X-Api-Key: pv_...       │  FastAPI Server   │
│  (popup + opts) │  ←────────────────────────── │  (port 8788)     │
└─────────────────┘     { ok, id }              └───────┬──────────┘
                                                         │
                                                   ┌─────▼──────────┐
                                                   │  ~/.hermes/    │
                                                   │  agent-eye/  │
                                                   │  20250325_*.json│
                                                   │  latest.json → │
                                                   └────────────────┘
```

- **Extension** extracts page title, URL, meta tags, Open Graph, headings, word count, and a content excerpt.
- **Server** authenticates via API key, stores all shares with timestamps, and serves pages back via REST.
- **Your agent** reads the latest page via the server API or directly from the data directory.

## Quick Start

### 1. Install the server

```bash
# Via pip
pip install agent-eye

# Or from source
cd agent-eye
pip install -e .
```

### 2. Start the server

```bash
agent-eye
```

First run creates an API key in `~/.hermes/agent-eye/.api_key`.

```
  ┌─ Agent Eye Server ─────────────────────────────────┐
  │  Listening: http://100.72.133.89:8788              │
  │  API Key  : pv_MfTzJ...A3X8fMC                     │
  └────────────────────────────────────────────────────┘
```

### 3. Install the Chrome extension

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked** → select the `agent-eye/` directory
4. Pin the extension from the puzzle icon

### 4. Configure the extension

1. Click the extension icon → right-click → **Options**
2. Enter: `http://100.72.133.89:8788` as Server URL
3. Enter your API key (from the server output or `cat ~/.hermes/agent-eye/.api_key`)
4. Click **Save & Test**

### 5. Share a page

Click the extension on any page → hit **Share**. Or explore your full history by clicking **History** in the popup — view all captured pages with stats and delete unwanted ones with the 🗑️ button.

## v1.1.0 Updates

- **📋 History view** — popup now lists all captured pages with title, URL, date, and word stats
- **🗑️ Delete from popup** — each history entry has a delete button; removes the page from the server, the notes file (`agent-eye-captures.md`), and the seen-ids tracker
- **Docker vault mount** — the container needs `-v ~/hermes-vault:/root/hermes-vault` so delete can reach the notes file
- Bugfix: `_list_pages()` handles broken symlinks gracefully; health endpoint excludes `seen_ids.json` from page count

## Server Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `AGENT_EYE_PORT` | `8788` | Server port |
| `AGENT_EYE_HOST` | `100.72.133.89` | Tailscale IP to bind to |

The server **always binds to the Tailscale IP** (`100.72.133.89`) by default — never to localhost. This keeps page sharing accessible over your Tailnet without exposing anything to the open internet. Override with `AGENT_EYE_HOST` env var if your IP changes.

### Run with Docker

```bash
# Build the image
docker build -t agent-eye .

# Run it (bound to Tailscale IP, with vault mount for notes cleanup)
docker run -d \
  --name agent-eye \
  --restart unless-stopped \
  -e AGENT_EYE_HOST=0.0.0.0 \
  -p 100.72.133.89:8788:8788 \
  -v ~/.hermes/agent-eye:/root/.hermes/agent-eye \
  -v ~/hermes-vault:/root/hermes-vault \
  agent-eye
```

### Rotate API key

```bash
curl -X POST http://100.72.133.89:8788/api/v1/auth/rotate \
  -H "X-Api-Key: $(cat ~/.hermes/agent-eye/.api_key)"
```

## API Reference

All endpoints except `/health` require `X-Api-Key` header.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check (no auth) |
| `POST` | `/api/v1/pages` | Share a page |
| `GET` | `/api/v1/pages/latest` | Get most recent share |
| `GET` | `/api/v1/pages?limit=20&offset=0` | List shares (paginated) |
| `DELETE` | `/api/v1/pages/:id` | Delete a page (removes from server, notes, and seen-ids) |
| `POST` | `/api/v1/auth/rotate` | Generate new API key |

### Share payload

```json
{
  "timestamp": "2025-03-25T14:30:00Z",
  "sessionId": "webui",
  "client_version": "1.0.0",
  "page": {
    "title": "Example Page",
    "url": "https://example.com",
    "description": "An example page",
    "metaTags": [
      { "name": "og:title", "content": "Example" }
    ],
    "headings": [
      { "tag": "H1", "text": "Welcome" }
    ],
    "words": 450,
    "links": 12,
    "images": 3,
    "excerpt": "First 2000 characters of page content..."
  }
}
```

## Storage

All data lives in `~/.hermes/agent-eye/`:

- `{timestamp}.json` — individual page shares
- `latest.json` — symlink to the most recent share
- `.api_key` — auto-generated API key (permissions `600`)
- `.gitignore` — prevents credential leaks

## Security

- API key is auto-generated (64 bytes of `secrets.token_urlsafe`)
- Key stored with `0o600` permissions
- Key never logged or exposed in error messages
- Extension stores creds in `chrome.storage.sync` (Chrome-encrypted)
- All data is local by default; bound to your Tailscale IP with no exposure to the open internet
- If your Tailscale IP changes, set `TAILSCALE_IP` env var or `AGENT_EYE_HOST`

## Auto-Capture to Notes

Every 5 minutes, a cron job checks the Agent Eye server for new shared pages and saves them to `~/hermes-vault/user-notes/agent-eye-captures.md` with the URL, title, stats, and a content preview.

Duplicate pages are skipped (checked by both page ID and URL). Already-seen IDs/URLs tracked in `~/.hermes/agent-eye/seen_ids.json`.

Script: `capture-to-notes.py`

## Files

```
agent-eye/
├── manifest.json          # Chrome extension manifest (v3)
├── popup.html / popup.js  # Extension popup UI + logic
├── options.html / options.js  # Configuration page
├── background.js          # Service worker (context menu, keyboard shortcut)
├── icons/                 # Extension icons (16/48/128)
├── server/
│   ├── __init__.py        # Package init
│   └── main.py            # FastAPI server
├── hermes-read-page.py    # Read latest shared page from terminal
├── capture-to-notes.py    # Cron script — auto-saves shared pages to notes
├── SKILL.md               # Hermes skill for agent integration
├── store-listing.md       # Chrome Web Store listing guide
├── requirements.txt       # Python dependencies
├── pyproject.toml         # Python package metadata
├── Dockerfile             # Container build
└── README.md              # This file
```
