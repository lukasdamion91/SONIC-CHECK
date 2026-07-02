"""Free audio fingerprinting — Chromaprint (fpcalc) + AcoustID + MusicBrainz metadata."""
import os
import json
import asyncio
import logging
import tempfile
import subprocess
from typing import Any, Optional
import httpx

logger = logging.getLogger("soniccheck.fingerprint")

ACOUSTID_API_KEY = os.environ.get("ACOUSTID_API_KEY")
ACOUSTID_URL = "https://api.acoustid.org/v2/lookup"
MAX_BYTES = 25_000_000

ERROR_MAP = {
    0: "Success",
    1001: "No recognition result",
    2004: "Unable to generate fingerprint",
    3000: "Recognition service / network issue",
    9999: "AcoustID not configured",
}


def is_configured() -> bool:
    return bool(ACOUSTID_API_KEY)


def error_message(code: int) -> str:
    return ERROR_MAP.get(code, f"AcoustID error {code}")


def _run_fpcalc(path: str) -> Optional[dict]:
    try:
        proc = subprocess.run(["fpcalc", "-json", path], capture_output=True, timeout=60)
        try:
            result = json.loads(proc.stdout)
            if result.get("fingerprint"):
                return result
        except json.JSONDecodeError:
            pass
        logger.error(f"fpcalc failed: {proc.stderr.decode(errors='ignore')[:300]}")
        return None
    except Exception as e:
        logger.error(f"fpcalc error: {e}")
        return None


async def compute_fingerprint(data: bytes, suffix: str = ".mp3") -> Optional[dict]:
    """Returns {'duration': float, 'fingerprint': str} or None."""
    if len(data) > MAX_BYTES:
        data = data[:MAX_BYTES]
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name
    try:
        return await asyncio.to_thread(_run_fpcalc, tmp_path)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def _extract_waveform(path: str, buckets: int = 60) -> list:
    """Real waveform: decode to mono 8kHz PCM via ffmpeg, bucket RMS levels."""
    try:
        proc = subprocess.run(
            ["ffmpeg", "-v", "quiet", "-i", path, "-ac", "1", "-ar", "8000", "-f", "s16le", "-t", "300", "-"],
            capture_output=True, timeout=60,
        )
        raw = proc.stdout
        if len(raw) < 4000:
            return []
        import array
        samples = array.array("h")
        samples.frombytes(raw[: len(raw) - (len(raw) % 2)])
        n = len(samples)
        step = max(1, n // buckets)
        bars = []
        for i in range(buckets):
            chunk = samples[i * step : (i + 1) * step]
            if not chunk:
                bars.append(0.1)
                continue
            rms = (sum(s * s for s in chunk[::16]) / max(1, len(chunk[::16]))) ** 0.5
            bars.append(rms)
        peak = max(bars) or 1.0
        return [round(max(0.05, b / peak), 2) for b in bars]
    except Exception as e:
        logger.error(f"waveform extraction error: {e}")
        return []


async def compute_waveform(data: bytes, suffix: str = ".mp3") -> list:
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name
    try:
        return await asyncio.to_thread(_extract_waveform, tmp_path)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


async def acoustid_lookup(fingerprint: str, duration: float) -> dict[str, Any]:
    """Query AcoustID API, returns normalized {status:{code,msg}, matches:[...]}"""
    if not is_configured():
        return {"status": {"code": 9999, "msg": error_message(9999)}, "matches": []}
    params = {
        "client": ACOUSTID_API_KEY,
        "duration": str(int(duration)),
        "fingerprint": fingerprint,
        "meta": "recordings releasegroups",
        "format": "json",
    }
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(ACOUSTID_URL, data=params)
            r.raise_for_status()
            payload = r.json()
    except httpx.HTTPError as e:
        logger.error(f"AcoustID network error: {e}")
        return {"status": {"code": 3000, "msg": f"Network error: {e}"}, "matches": []}

    if payload.get("status") != "ok":
        msg = (payload.get("error") or {}).get("message", "AcoustID error")
        return {"status": {"code": 3000, "msg": msg}, "matches": []}

    matches = []
    for res in payload.get("results", []):
        score = res.get("score", 0)
        for rec in res.get("recordings", []) or []:
            artists = ", ".join(a.get("name", "") for a in rec.get("artists", []) or []) or "Unknown"
            year = ""
            rgs = rec.get("releasegroups") or []
            title = rec.get("title") or "Unknown"
            album = rgs[0].get("title", "") if rgs else ""
            matches.append({
                "title": title,
                "artist": artists,
                "album": album,
                "mbid": rec.get("id", ""),
                "acoustid": res.get("id", ""),
                "release_date": year,
                "confidence": round(score * 100, 1),
                "duration_ms": int((rec.get("duration") or 0) * 1000),
                "source": "AcoustID/MusicBrainz",
            })
    # dedupe by mbid, keep highest confidence
    seen, unique = set(), []
    for m in sorted(matches, key=lambda x: -x["confidence"]):
        key = m["mbid"] or (m["title"], m["artist"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(m)
    code = 0 if unique else 1001
    return {"status": {"code": code, "msg": error_message(code)}, "matches": unique[:5]}


async def identify_bytes(data: bytes, filename: str = "sample.mp3") -> dict[str, Any]:
    suffix = "." + (filename.rsplit(".", 1)[-1] if "." in filename else "mp3")
    fp = await compute_fingerprint(data, suffix)
    if not fp or not fp.get("fingerprint"):
        return {"status": {"code": 2004, "msg": error_message(2004)}, "matches": []}
    return await acoustid_lookup(fp["fingerprint"], fp.get("duration", 0))


async def download_audio(url: str) -> tuple[Optional[bytes], str, str]:
    """Returns (bytes|None, filename, error_msg)."""
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
            r = await client.get(url)
            r.raise_for_status()
            ctype = r.headers.get("content-type", "")
            if "text/html" in ctype:
                return None, "", "URL is a web page, not a direct audio file"
            filename = url.split("?")[0].rsplit("/", 1)[-1] or "sample.mp3"
            return r.content, filename, ""
    except httpx.HTTPError as e:
        return None, "", f"Cannot fetch URL: {e}"
