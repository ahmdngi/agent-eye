# Hermes Page Viz — Chrome Web Store Submission

## Basic Info

- **Name:** Hermes Page Viz
- **Description (short, 132 chars):** Share web pages with your Hermes AI — one-click page data extraction with secure API key authentication.
- **Description (full):**

  > **Share any web page you're browsing with Hermes AI in one click.**
  >
  > Hermes Page Viz is a developer tool that extracts page metadata, Open Graph tags, headings, and content from any web page and shares it with your Hermes AI agent via a secure, authenticated API server.
  >
  > **How it works:**
  >
  > 1. Install the companion server on your Hermes machine
  > 2. Configure the extension with your server URL + API key
  > 3. Click the extension on any page to see title, URL, meta tags, headings, and stats
  > 4. Click "Share with Hermes" to send the page data to your Hermes server
  >
  > **What's extracted from each page:**
  > - Page title and URL
  > - Meta description and Open Graph tags
  > - All H1–H3 headings (as a tree)
  > - Word count, link count, image count
  > - Full page content excerpt
  >
  > **Security:**
  > - API key authentication (64-byte auto-generated token)
  > - Configurable server endpoint — data goes only where you choose
  > - Credentials stored in Chrome's encrypted sync storage
  >
  > **Requires:** A running Hermes Page Viz server (FastAPI) on your Hermes machine. See the GitHub repo for setup.

- **Category:** Developer Tools
- **Language:** English
- **Homepage URL:** https://github.com/ahmdngi/agent-eye

## Screenshots (1280x800)

### Screenshot 1: Popup showing page analysis
- Open the extension on any website (e.g., a tech blog or docs page)
- Capture the popup showing: page title, URL, meta description, Open Graph tags, headings list, and stats
- Shows the "Share with Hermes" and "Copy URL" buttons

### Screenshot 2: Options page configuration
- Show the options page with the server URL field and API key field
- Connection status showing "Connected ✓"
- The "Save & Test" and "Test Connection" buttons

### Screenshot 3: Server running
- Terminal window showing the server startup output
- Shows the API key and listening address

## Promo Images (optional)

- 440x280 small promo tile
- 920x680 marquee promo tile

## Icons

Already included in the extension package:
- 16x16: `icons/icon16.png`
- 48x48: `icons/icon48.png`
- 128x128: `icons/icon128.png`

## Additional Info

- **Permissions justification:**
  - `activeTab` — Needed to read the current page's URL, title, and content when the user clicks the extension
  - `storage` — Stores server URL and API key configuration via `chrome.storage.sync`
  - `scripting` — Injects a lightweight content script to extract page metadata (title, meta tags, headings, word count)
  - `host_permissions` (`http://*/*`, `https://*/*`) — Required for `scripting` to work on any page the user visits
- **No user data collected or transmitted externally** — data goes only to the user's own configured server
- **No analytics, no telemetry, no third-party services**

## Publishing Steps

1. Go to https://chrome.google.com/webstore/devconsole
2. Pay the one-time $5 registration fee
3. Click "New item"
4. Upload `agent-eye.zip`
5. Fill in the details from above
6. Upload screenshots
7. Submit for review

Review typically takes 1–3 business days for first submission.
