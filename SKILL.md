---
name: agent-eye
description: Chrome extension + authenticated FastAPI server that shares the current browsing page with your AI agent (URL, title, meta, headings, content).
usage: |
  1. Start the server: python3 -m server.main  (from cloned repo)
  2. User configures extension options with server URL + API key
  3. User clicks "Share" in the extension
  4. Read the shared data: python3 hermes-read-page.py
repo_url: https://github.com/ahmdngi/agent-eye
install_url: https://raw.githubusercontent.com/ahmdngi/agent-eye/main/SKILL.md
type: integration
---

# Agent Eye

Chrome extension + FastAPI server for sharing pages with your AI agent.

## Architecture

Extension → POST /api/v1/pages (X-Api-Key auth) → FastAPI server → ~/.hermes/agent-eye/*.json

## Quick Start

```bash
# 1. Start the server (binds to Tailscale IP 100.72.133.89)
cd /root/workspace/agent-eye && .venv/bin/python -m server.main

# 2. Get the API key
cat ~/.hermes/agent-eye/.api_key

# 3. Read a shared page
python3 /root/workspace/agent-eye/hermes-read-page.py
```

## Installation Steps (one-time)

1. Install deps: `.venv/bin/pip install fastapi uvicorn pydantic`
2. Chrome: `chrome://extensions` → Developer mode → Load unpacked
3. Select `/root/workspace/agent-eye/`
4. Right-click extension → Options → enter server URL + API key

## How to use

When the user shares a page:

1. **Read the shared data**:
   ```bash
   python3 /root/workspace/agent-eye/hermes-read-page.py
   ```

2. Output includes: `url`, `title`, `description`, `meta` (OpenGraph), `headings`, `stats` (words/links/images), `excerpt`

3. Use the URL to visit the page yourself via `web_extract` or `browser_navigate` if needed.

## File structure

```
/root/workspace/agent-eye/
├── manifest.json       # Chrome extension manifest v3
├── popup.html / .js    # Extension popup with page analysis
├── options.html / .js  # Server URL + API key config
├── background.js       # Service worker
├── icons/              # Extension icons (16/48/128)
├── server/main.py      # FastAPI server (API key auth)
├── hermes-read-page.py # Script to read latest share
├── pyproject.toml      # Python package metadata
├── requirements.txt    # Dependencies
├── Dockerfile          # Container
└── README.md           # Full docs
```

## API Endpoints

All require `X-Api-Key` header (except /health):

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check (no auth) |
| POST | /api/v1/pages | Share a page |
| GET | /api/v1/pages/latest | Get most recent share |
| GET | /api/v1/pages?limit=20 | List shares (paginated) |
| POST | /api/v1/auth/rotate | Generate new API key |

## Server CLI

```bash
AGENT_EYE_PORT=8788 .venv/bin/python -m server.main
```

Binds to Tailscale IP `100.72.133.89` by default — never localhost. Override with `AGENT_EYE_HOST` or `TAILSCALE_IP` env var if your Tailscale IP changes.

## Chrome Web Store

To publish the extension for non-technical users: package as `.zip`, prepare listing + screenshots, submit via the dev console. See `references/chrome-web-store-submission.md` for the full process.

## Security

- API key auto-generated (64 bytes, stored `0o600` in `~/.hermes/agent-eye/.api_key`)
- Extension stores creds in `chrome.storage.sync` (Chrome-encrypted)
- Server binds to Tailscale IP only — no localhost or public exposure

## Limitations

- Cannot read `chrome://`, `chrome-extension://`, `about:` pages
- Page excerpt capped at first 2000 chars
