"""Free lyric candidate discovery — Genius API search + page lyric extraction."""
import os
import re
import logging
from typing import Any, Optional
import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger("soniccheck.lyrics")

GENIUS_ACCESS_TOKEN = os.environ.get("GENIUS_ACCESS_TOKEN")
GENIUS_API = "https://api.genius.com"


def is_configured() -> bool:
    return bool(GENIUS_ACCESS_TOKEN)


async def genius_search(query: str, limit: int = 5) -> list[dict[str, Any]]:
    if not is_configured() or not query.strip():
        return []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"{GENIUS_API}/search",
                params={"q": query},
                headers={"Authorization": f"Bearer {GENIUS_ACCESS_TOKEN}"},
            )
            r.raise_for_status()
            hits = (r.json().get("response") or {}).get("hits") or []
    except httpx.HTTPError as e:
        logger.error(f"Genius search error: {e}")
        return []
    results = []
    for h in hits[:limit]:
        s = h.get("result") or {}
        results.append({
            "genius_id": s.get("id"),
            "title": s.get("title", ""),
            "artist": (s.get("primary_artist") or {}).get("name", ""),
            "url": s.get("url", ""),
            "year": (s.get("release_date_components") or {}).get("year") or "",
        })
    return results


async def fetch_lyrics(url: str) -> Optional[str]:
    """Scrape lyrics text from a Genius song page."""
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
            r = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (compatible; SonicCheck/1.0)"})
            r.raise_for_status()
    except httpx.HTTPError as e:
        logger.error(f"Genius page fetch error: {e}")
        return None
    soup = BeautifulSoup(r.text, "html.parser")
    containers = soup.select("div[data-lyrics-container='true']")
    if not containers:
        return None
    parts = []
    for c in containers:
        for br in c.find_all("br"):
            br.replace_with("\n")
        parts.append(c.get_text())
    text = "\n".join(parts)
    text = re.sub(r"\[[^\]]*\]", "", text)  # strip [Verse 1] section markers
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text or None


def _distinctive_lines(lyrics: str, n: int = 2) -> list[str]:
    lines = [ln.strip() for ln in lyrics.splitlines() if len(ln.strip().split()) >= 4]
    lines.sort(key=len, reverse=True)
    return lines[:n]


async def find_candidates(lyrics: str, title: str = "", artist: str = "", max_candidates: int = 3) -> list[dict[str, Any]]:
    """Search Genius using distinctive lyric lines; return candidates (with lyrics when scrapable)."""
    if not is_configured():
        return []
    queries = _distinctive_lines(lyrics)
    if title:
        queries.append(title)
    seen_ids, candidates = set(), []
    for q in queries:
        if len(candidates) >= max_candidates:
            break
        for hit in await genius_search(q, limit=3):
            if hit["genius_id"] in seen_ids or len(candidates) >= max_candidates:
                continue
            seen_ids.add(hit["genius_id"])
            text = await fetch_lyrics(hit["url"])
            hit["lyrics"] = text[:3000] if text else None
            candidates.append(hit)
    return candidates
