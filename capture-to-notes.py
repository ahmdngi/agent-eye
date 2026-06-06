#!/usr/bin/env python3
"""
Agent Eye — Capture pages shared via extension and save to user-notes.
Runs via cron. Checks the Agent Eye server for new pages and appends
them to ~/hermes-vault/user-notes/agent-eye-captures.md
"""
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

SERVER_URL = os.environ.get("AGENT_EYE_URL", "http://100.72.133.89:8788")
API_KEY_FILE = Path.home() / ".hermes" / "agent-eye" / ".api_key"
STATE_FILE = Path.home() / ".hermes" / "agent-eye" / "seen_ids.json"
NOTES_FILE = Path.home() / "hermes-vault" / "user-notes" / "agent-eye-captures.md"


def load_seen() -> set:
    if STATE_FILE.exists():
        with open(STATE_FILE) as f:
            return set(json.load(f))
    return set()


def save_seen(ids: set) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(STATE_FILE, "w") as f:
        json.dump(sorted(ids), f)


def fetch_pages(api_key: str) -> list[dict]:
    import urllib.request, urllib.error
    url = f"{SERVER_URL.rstrip('/')}/api/v1/pages?limit=50"
    req = urllib.request.Request(url, headers={"X-Api-Key": api_key})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())


def generate_summary(page: dict) -> str:
    """Generate a summary from the page data."""
    title = page.get("title", "Untitled")
    desc = page.get("description", "")
    excerpt = page.get("excerpt", "")
    words = page.get("words", 0)
    links = page.get("links", 0)
    images = page.get("images", 0)

    # Take first meaningful snippet from excerpt for summary
    snippet = excerpt.strip()[:300].rsplit(" ", 1)[0] + "…" if len(excerpt) > 300 else excerpt.strip()
    if not snippet:
        snippet = "(no content captured)"

    summary_parts = [f"**Page:** {title}"]
    if desc:
        summary_parts.append(f"**Description:** {desc}")
    summary_parts.append(f"**Stats:** {words} words, {links} links, {images} images")
    summary_parts.append(f"**Preview:** {snippet}")
    return "\n".join(summary_parts)


def format_entry(page: dict) -> str:
    page_data = page.get("page", {})
    url = page_data.get("url", "?")
    title = page_data.get("title", "Untitled")
    page_id = page.get("id", "unknown")
    ts = page.get("timestamp", "")[:10] if page.get("timestamp") else ""

    summary = generate_summary(page_data)
    tags = "agent-eye"

    lines = [
        f"## {title}",
        f"",
        f"- **Captured:** {ts}  ",
        f"- **URL:** [{url}]({url})  ",
        f"- **ID:** `{page_id}`  ",
        f"- **Tags:** `{tags}`  ",
        f"",
        f"{summary}",
        f"",
        f"---",
        f"",
    ]
    return "\n".join(lines)


def main():
    # Read API key
    if not API_KEY_FILE.exists():
        print("No API key found at", API_KEY_FILE)
        return

    api_key = API_KEY_FILE.read_text().strip()
    if not api_key:
        return

    # Fetch pages from server
    try:
        pages = fetch_pages(api_key)
    except Exception as e:
        print(f"Failed to fetch pages: {e}")
        return

    if not pages:
        print("No pages on server")
        return

    # Load already-seen IDs
    seen = load_seen()
    new_entries = []

    for p in pages:
        pid = p.get("id", "")
        if pid and pid not in seen:
            new_entries.append(p)
            seen.add(pid)

    if not new_entries:
        print("No new pages to capture")
        return

    # Ensure notes file exists
    NOTES_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not NOTES_FILE.exists():
        NOTES_FILE.write_text("# Agent Eye — Captured Pages\n\nPages shared via the Agent Eye extension, auto-captured by cron.\n\n---\n\n")

    # Append new entries
    with open(NOTES_FILE, "a") as f:
        for entry in reversed(new_entries):  # oldest first
            f.write(format_entry(entry))

    # Save seen IDs
    save_seen(seen)

    print(f"Saved {len(new_entries)} new page(s) to {NOTES_FILE}")


if __name__ == "__main__":
    main()
