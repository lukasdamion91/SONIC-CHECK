"""Emergent Object Storage — persistent audio file storage for paid plans."""
import os
import logging
import httpx

logger = logging.getLogger("soniccheck.storage")

STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "soniccheck"

_storage_key = None

AUDIO_MIME = {
    "mp3": "audio/mpeg", "wav": "audio/wav", "m4a": "audio/mp4", "aac": "audio/aac",
    "flac": "audio/flac", "ogg": "audio/ogg", "opus": "audio/opus", "webm": "audio/webm",
    "aiff": "audio/aiff", "wma": "audio/x-ms-wma",
}


def mime_for(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return AUDIO_MIME.get(ext, "application/octet-stream")


async def init_storage() -> str:
    global _storage_key
    if _storage_key:
        return _storage_key
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY})
        resp.raise_for_status()
        _storage_key = resp.json()["storage_key"]
    return _storage_key


async def _refresh_key() -> str:
    global _storage_key
    _storage_key = None
    return await init_storage()


async def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = await init_storage()
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, content=data)
        if resp.status_code == 403:
            key = await _refresh_key()
            resp = await client.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, content=data)
        resp.raise_for_status()
        return resp.json()


async def get_object(path: str) -> tuple[bytes, str]:
    key = await init_storage()
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key})
        if resp.status_code == 403:
            key = await _refresh_key()
            resp = await client.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key})
        resp.raise_for_status()
        return resp.content, resp.headers.get("Content-Type", "application/octet-stream")
