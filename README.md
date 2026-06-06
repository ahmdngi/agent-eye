# Hermes Page Viz

**Share any web page you're browsing with Hermes AI in one click.**  
Chrome extension + authenticated API server for secure, production-ready page sharing.

🌐 **Repo:** https://github.com/ahmdngi/agent-eye  
📦 **Install skill:** `hermes skills install https://raw.githubusercontent.com/ahmdngi/agent-eye/main/SKILL.md`

## Architecture

```
┌─────────────────┐     POST /api/v1/pages     ┌──────────────────┐
│  Chrome         │  ──────────────────────────→ │  Hermes Page Viz │
│  Extension      │     X-Api-Key: pv_...       │  FastAPI Server   │
│  (popup + opts) │  ←────────────────────────── │  (port 8788)     │
└─────────────────┘     { ok, id }              └───────┬──────────┘
                                                         │
                                                   ┌─────▼──────────┐
                                                   │  ~/.hermes/    │
                                                   │  page-viz/     │
                                                   │  20250325_*.json│
                                                   │  latest.json → │
                                                   └────────────────┘
```

- **Extension** extracts page title, URL, meta tags, Open Graph, headings, word count, and a content excerpt.
- **Server** authenticates via API key, stores all shares with timestamps, and serves pages back via REST.
- **Hermes** reads the latest page via the server API or directly from the data directory.

## Quick Start

### 1. Install the server

```bash
# Via pip
pip install hermes-page-viz

# Or from source
cd hermes-page-viz
pip install -e .
```

### 2. Start the server

```bash
hermes-pviz
```

First run creates an API key in `~/.hermes/page-viz/.api_key`.  
Server runs on `http://127.0.0.1:8788` by default.

```
  ┌─ Hermes Page Viz Server ──────────────────────────┐
  │  Data dir : /home/user/.hermes/page-viz            │
  │  API Key  : pv_MfTzJ...A3X8fMC                     │
  └────────────────────────────────────────────────────┘
```

### 3. Install the Chrome extension

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked** → select the `hermes-page-viz/` directory
4. Pin the extension from the puzzle icon

### 4. Configure the extension

1. Click the extension icon → right-click → **Options**
2. Enter: `http://127.0.0.1:8788` as Server URL
3. Enter your API key (from the server output or `cat ~/.hermes/page-viz/.api_key`)
4. Click **Save & Test**

### 5. Share a page

Click the extension on any page → hit **Share with Hermes**.

## Server Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `PAGE_VIZ_PORT` | `8788` | Server port |
| `PAGE_VIZ_HOST` | `100.72.133.89` | Tailscale IP to bind to |

The server **always binds to the Tailscale IP** (`100.72.133.89`) by default — never to localhost. This keeps page sharing accessible over your Tailnet without exposing anything to the open internet. You can override via `TAILSCALE_IP` env var or `PAGE_VIZ_HOST` if your IP changes.

### Production

```bash
# Use the Tailscale IP (default) — no extra config needed
PAGE_VIZ_PORT=8788 hermes-pviz

# Or via Docker with Tailscale
docker run -d \
  -p 100.72.133.89:8788:8788 \
  -v ~/.hermes/page-viz:/root/.hermes/page-viz \
  ghcr.io/ahmdngi/agent-eye
```

### Rotate API key

```bash
curl -X POST http://127.0.0.1:8788/api/v1/auth/rotate \
  -H "X-Api-Key: $(cat ~/.hermes/page-viz/.api_key)"
```

## API Reference

All endpoints except `/health` require `X-Api-Key` header.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check (no auth) |
| `POST` | `/api/v1/pages` | Share a page |
| `GET` | `/api/v1/pages/latest` | Get most recent share |
| `GET` | `/api/v1/pages?limit=20&offset=0` | List shares (paginated) |
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

All data lives in `~/.hermes/page-viz/`:

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
- If your Tailscale IP changes, set `TAILSCALE_IP` env var or `PAGE_VIZ_HOST`

## Files

```
hermes-page-viz/
├── manifest.json          # Chrome extension manifest (v3)
├── popup.html / popup.js  # Extension popup UI + logic
├── options.html / options.js  # Configuration page
├── background.js          # Service worker
├── icons/                 # Extension icons (16/48/128)
├── server/
│   ├── __init__.py        # Package init
│   └── main.py            # FastAPI server
├── requirements.txt       # Python dependencies
├── pyproject.toml         # Python package metadata
├── Dockerfile             # Container build
└── README.md              # This file
```
