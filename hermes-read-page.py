#!/usr/bin/env python3
"""
Read the latest page shared via Hermes Page Viz Chrome extension.

Reads from the server API by default, or from the local data directory.

Usage:
    python3 hermes-read-page.py
    python3 hermes-read-page.py --path ~/.hermes/page-viz/latest.json
    python3 hermes-read-page.py --server http://127.0.0.1:8788 --key <api-key>
"""
import json
import os
import sys
from pathlib import Path

DATA_DIR = Path.home() / ".hermes" / "page-viz"
KEY_FILE = DATA_DIR / ".api_key"
LATEST = DATA_DIR / "latest.json"


TAILSCALE_IP = "100.72.133.89"

def read_local(path: Path) -> dict:
    if not path.exists():
        return {"found": False, "error": "No shared page found"}
    with open(path) as f:
        return json.load(f)


def read_from_server(server_url: str, api_key: str) -> dict:
    import urllib.request

    url = f"{server_url.rstrip('/')}/api/v1/pages/latest"
    req = urllib.request.Request(url, headers={"X-Api-Key": api_key})
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"found": False, "error": f"HTTP {e.code}: {e.reason}"}
    except Exception as e:
        return {"found": False, "error": str(e)}


def format_output(data: dict) -> dict:
    page = data.get("page", data)
    return {
        "found": data.get("id") is not None or data.get("found", False),
        "shared_at": data.get("timestamp", ""),
        "title": page.get("title", ""),
        "url": page.get("url", ""),
        "description": page.get("description", ""),
        "meta": page.get("metaTags", []),
        "headings": page.get("headings", []),
        "stats": {
            "words": page.get("words", 0),
            "links": page.get("links", 0),
            "images": page.get("images", 0),
        },
        "excerpt": (page.get("excerpt") or "")[:500],
    }


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Read latest shared page")
    parser.add_argument("--path", help="Path to a specific page JSON file")
    parser.add_argument("--server", help="Server URL (default: reads local file)")
    parser.add_argument("--key", help="API key (required with --server)")
    args = parser.parse_args()

    if args.path:
        raw = read_local(Path(args.path))
    elif args.server:
        key = args.key or (KEY_FILE.read_text().strip() if KEY_FILE.exists() else "")
        if not key:
            print(json.dumps({"found": False, "error": "No API key provided. Pass --key or configure ~/.hermes/page-viz/.api_key"}))
            sys.exit(1)
        raw = read_from_server(args.server, key)
    else:
        if LATEST.exists():
            raw = read_local(LATEST)
        elif KEY_FILE.exists():
            raw = read_from_server(f"http://{TAILSCALE_IP}:8788", KEY_FILE.read_text().strip())
        else:
            raw = {"found": False, "error": "No shared page found. Click 'Share with Hermes' in the extension first."}

    print(json.dumps(format_output(raw), indent=2))
