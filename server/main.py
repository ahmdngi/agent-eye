"""
Agent Eye — API Server

FastAPI server that receives shared page data from the Chrome extension,
stores it with timestamps, and serves it back with API key authentication.

Run:
    python -m server.main          # dev
    hermes page-viz-server         # if installed via pip
"""
from __future__ import annotations

import json
import os
import secrets
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import uvicorn
from fastapi import FastAPI, HTTPException, Header, Depends, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ── Tailscale IP (never bind to localhost) ────────────────────────────
TAILSCALE_IP = os.environ.get("TAILSCALE_IP", "100.72.133.89")

# ── paths ──────────────────────────────────────────────────────────────
DATA_DIR = Path.home() / ".hermes" / "page-viz"
KEY_FILE = DATA_DIR / ".api_key"
LATEST_SYMLINK = DATA_DIR / "latest.json"

# ── models ─────────────────────────────────────────────────────────────
class PageMeta(BaseModel):
    name: str
    content: str

class PageHeading(BaseModel):
    tag: str
    text: str

class PageData(BaseModel):
    title: str
    url: str
    description: Optional[str] = ""
    metaTags: list[PageMeta] = []
    headings: list[PageHeading] = []
    words: int = 0
    links: int = 0
    images: int = 0
    excerpt: str = ""

class ShareRequest(BaseModel):
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    sessionId: str = ""
    page: PageData
    client_version: str = "1.0"

class ShareResponse(BaseModel):
    ok: bool
    id: str
    message: str = ""

class PageResponse(BaseModel):
    id: str
    timestamp: str
    sessionId: str
    page: PageData
    client_version: str

class HealthResponse(BaseModel):
    status: str
    version: str
    pages_stored: int
    data_dir: str


# ── app ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Agent Eye API",
    version="1.0.0",
    description="Receive and serve shared page data from the Agent Eye Chrome extension.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── helpers ────────────────────────────────────────────────────────────
def _ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    # ensure .gitignore so creds don't leak
    gitignore = DATA_DIR / ".gitignore"
    if not gitignore.exists():
        gitignore.write_text("*\n")


def _load_api_key() -> str:
    if KEY_FILE.exists():
        return KEY_FILE.read_text().strip()
    key = f"pv_{secrets.token_urlsafe(32)}"
    KEY_FILE.write_text(key)
    os.chmod(KEY_FILE, 0o600)
    return key


def _save_page(page_id: str, data: dict) -> Path:
    path = DATA_DIR / f"{page_id}.json"
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    os.chmod(path, 0o644)
    # update latest symlink
    if LATEST_SYMLINK.exists() or LATEST_SYMLINK.is_symlink():
        LATEST_SYMLINK.unlink(missing_ok=True)
    LATEST_SYMLINK.symlink_to(path.name)
    return path


def _list_pages() -> list[Path]:
    return sorted(DATA_DIR.glob("*.json"), key=os.path.getmtime, reverse=True)


# ── auth dependency ────────────────────────────────────────────────────
def verify_api_key(x_api_key: str = Header(..., alias="X-Api-Key")):
    stored = _load_api_key()
    if not secrets.compare_digest(stored, x_api_key):
        raise HTTPException(status_code=403, detail="Invalid API key")
    return x_api_key


# ── endpoints ──────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    _ensure_data_dir()
    key = _load_api_key()
    print(f"  ┌─ Agent Eye Server ─────────────────────────────────┐")
    print(f"  │  Listening: http://{TAILSCALE_IP}:{port}")
    print(f"  │  API Key  : {key[:16]}...{key[-8:]}                        │")
    print(f"  └──────────────────────────────────────────────────┘")


@app.get("/health", response_model=HealthResponse)
async def health():
    pages = [p for p in _list_pages() if p.name != "latest.json"]
    return HealthResponse(
        status="ok",
        version="1.0.0",
        pages_stored=len(pages),
        data_dir=str(DATA_DIR),
    )


@app.post("/api/v1/pages", response_model=ShareResponse)
async def share_page(
    req: ShareRequest,
    _api_key: str = Depends(verify_api_key),
):
    page_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")[:22]
    record = {
        "id": page_id,
        "timestamp": req.timestamp,
        "sessionId": req.sessionId,
        "page": req.page.model_dump(),
        "client_version": req.client_version,
        "stored_at": datetime.now(timezone.utc).isoformat(),
    }
    _save_page(page_id, record)
    return ShareResponse(ok=True, id=page_id, message="Page shared successfully")


@app.get("/api/v1/pages/latest", response_model=PageResponse)
async def get_latest(_api_key: str = Depends(verify_api_key)):
    if LATEST_SYMLINK.exists():
        path = DATA_DIR / LATEST_SYMLINK.read_text()
        if path.exists():
            with open(path) as f:
                return json.load(f)
    # fallback: find the most recent .json
    pages = [p for p in _list_pages() if p.suffix == ".json" and p.name != "latest.json"]
    if not pages:
        raise HTTPException(status_code=404, detail="No pages shared yet")
    path = pages[0]
    with open(path) as f:
        return json.load(f)


@app.get("/api/v1/pages", response_model=list[PageResponse])
async def list_pages(
    _api_key: str = Depends(verify_api_key),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    pages = [p for p in _list_pages() if p.suffix == ".json" and p.name != "latest.json"]
    batch = pages[offset : offset + limit]
    result = []
    for p in batch:
        with open(p) as f:
            result.append(json.load(f))
    return result


@app.post("/api/v1/auth/rotate")
async def rotate_key(_api_key: str = Depends(verify_api_key)):
    new_key = f"pv_{secrets.token_urlsafe(32)}"
    KEY_FILE.write_text(new_key)
    os.chmod(KEY_FILE, 0o600)
    return {"ok": True, "api_key": new_key}


# ── CLI entrypoint ─────────────────────────────────────────────────────
def main():
    port = int(os.environ.get("PAGE_VIZ_PORT", "8788"))
    host = os.environ.get("PAGE_VIZ_HOST", TAILSCALE_IP)
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
