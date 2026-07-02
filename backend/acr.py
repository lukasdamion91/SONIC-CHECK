"""ACRCloud Music Recognition — audio fingerprinting against 90M+ licensed track catalog."""
import os
import base64
import hashlib
import hmac
import time
import logging
from typing import Any, Optional
import httpx

logger = logging.getLogger("soniccheck.acr")

ACR_HOST = os.environ.get("ACR_HOST")
ACR_ACCESS_KEY = os.environ.get("ACR_ACCESS_KEY")
ACR_ACCESS_SECRET = os.environ.get("ACR_ACCESS_SECRET")
ACR_TIMEOUT = float(os.environ.get("ACR_TIMEOUT", "20"))
MAX_BYTES = 5_000_000  # 5 MB per ACRCloud docs

ERROR_MAP = {
    0: "Success",
    1001: "No recognition result",
    2004: "Unable to generate fingerprint",
    3000: "Recognition service / network / host issue",
    3001: "Wrong Access Key",
    3002: "Invalid HTTP request",
    3003: "Request limit exceeded",
    3006: "Invalid arguments",
    3010: "Recognition service error",
    3014: "Invalid signature",
    3015: "QPS limit exceeded",
}


def is_configured() -> bool:
    return bool(ACR_HOST and ACR_ACCESS_KEY and ACR_ACCESS_SECRET)


def _sign(method: str, uri: str, data_type: str, signature_version: str, timestamp: str) -> str:
    string_to_sign = "\n".join([method, uri, ACR_ACCESS_KEY, data_type, signature_version, timestamp])
    digest = hmac.new(
        ACR_ACCESS_SECRET.encode("utf-8"),
        string_to_sign.encode("utf-8"),
        hashlib.sha1,
    ).digest()
    return base64.b64encode(digest).decode("utf-8")


async def identify_bytes(data: bytes, filename: str, content_type: str = "application/octet-stream") -> dict[str, Any]:
    if not is_configured():
        return {"status": {"code": 9999, "msg": "ACRCloud not configured"}, "metadata": {}}
    if len(data) > MAX_BYTES:
        # take first 5MB — usually the beginning of a track has enough for fingerprinting
        data = data[:MAX_BYTES]

    ts = str(int(time.time()))
    sig = _sign("POST", "/v1/identify", "audio", "1", ts)
    form = {
        "access_key": ACR_ACCESS_KEY,
        "sample_bytes": str(len(data)),
        "timestamp": ts,
        "signature": sig,
        "data_type": "audio",
        "signature_version": "1",
    }
    files = {"sample": (filename, data, content_type)}
    try:
        async with httpx.AsyncClient(timeout=ACR_TIMEOUT) as client:
            r = await client.post(f"https://{ACR_HOST}/v1/identify", data=form, files=files)
            r.raise_for_status()
            return r.json()
    except httpx.HTTPError as e:
        logger.error(f"ACRCloud network error: {e}")
        return {"status": {"code": 3000, "msg": f"Network error: {e}"}, "metadata": {}}


async def identify_url(url: str) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
            r = await client.get(url)
            r.raise_for_status()
            ctype = r.headers.get("content-type", "application/octet-stream")
            if "text/html" in ctype:
                return {"status": {"code": 4001, "msg": "URL is a page, not a direct audio file"}, "metadata": {}}
    except httpx.HTTPError as e:
        return {"status": {"code": 4002, "msg": f"Cannot fetch URL: {e}"}, "metadata": {}}
    filename = url.split("?")[0].rsplit("/", 1)[-1] or "sample.mp3"
    return await identify_bytes(r.content, filename, ctype)


def parse_tracks(acr: dict[str, Any]) -> list[dict[str, Any]]:
    music = (acr.get("metadata") or {}).get("music") or []
    tracks = []
    for item in music:
        result = item.get("result", item) if isinstance(item, dict) else item
        artists = result.get("artists", []) or []
        album = result.get("album") or {}
        ext = result.get("external_ids") or {}
        tracks.append({
            "title": result.get("title", "Unknown"),
            "artist": ", ".join([a.get("name", "") for a in artists if a.get("name")]) or "Unknown",
            "album": album.get("name") if isinstance(album, dict) else str(album or ""),
            "label": result.get("label", ""),
            "isrc": ext.get("isrc", "") if isinstance(ext, dict) else "",
            "release_date": result.get("release_date", ""),
            "confidence": result.get("score", 0),
            "play_offset_ms": result.get("play_offset_ms", 0),
            "duration_ms": result.get("duration_ms", 0),
            "acrid": result.get("acrid", ""),
        })
    return tracks


def error_message(code: int) -> str:
    return ERROR_MAP.get(code, f"ACRCloud error {code}")
