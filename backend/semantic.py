"""AI semantic lyric similarity — Emergent LLM key via emergentintegrations."""
import os
import json
import re
import uuid
import logging
from typing import Any
from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger("soniccheck.semantic")

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

SYSTEM_PROMPT = """You are a forensic musicologist AI specializing in lyric plagiarism analysis for the music industry.
You compare a user's original lyrics against candidate reference songs and estimate similarity percentages.
Consider: verbatim phrase overlap, paraphrased lines, distinctive imagery/metaphors, hook/chorus resemblance, and structural copying.
Common words, generic phrases ("I love you", "baby", "tonight"), and standard song tropes do NOT count as plagiarism.
Respond ONLY with valid JSON, no markdown fences, no prose outside the JSON."""


def is_configured() -> bool:
    return bool(EMERGENT_LLM_KEY)


def _parse_json(text: str) -> Any:
    text = text.strip()
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                pass
    return None


async def analyze_lyrics(user_lyrics: str, candidates: list[dict], title: str = "") -> dict[str, Any]:
    """Returns {ok, matches:[{title,artist,year,lyric_similarity,matched_snippet,your_snippet,reasoning,confidence}], summary, originality_score}."""
    if not is_configured():
        return {"ok": False, "error": "LLM not configured", "matches": [], "summary": ""}

    if candidates:
        def _cand_text(c):
            base = f"Title: {c['title']}\nArtist: {c['artist']}\nYear: {c.get('year') or 'unknown'}"
            if c.get("lyrics"):
                return base + f"\nLyrics:\n{c['lyrics'][:2500]}"
            return base + "\nLyrics: (not available — use your own knowledge of this song's lyrics)"

        cand_block = "\n\n".join(f"CANDIDATE {i+1}:\n{_cand_text(c)}" for i, c in enumerate(candidates))
        task = f"""Compare the USER LYRICS against each CANDIDATE below.

USER LYRICS (title: "{title or 'untitled'}"):
{user_lyrics[:3000]}

{cand_block}

Return JSON:
{{
  "matches": [
    {{"title": "...", "artist": "...", "year": "...", "lyric_similarity": <0-100 float>, "matched_snippet": "<most similar line from candidate>", "your_snippet": "<corresponding line from user lyrics>", "reasoning": "<1 sentence>", "confidence": <0-1 float>}}
  ],
  "summary": "<2-3 sentence overall plagiarism assessment>",
  "originality_score": <0-100 float, how original the user lyrics are>
}}
Include one entry per candidate, ordered by lyric_similarity descending."""
    else:
        task = f"""Analyze these USER LYRICS for potential plagiarism against well-known commercially released songs from your knowledge.

USER LYRICS (title: "{title or 'untitled'}"):
{user_lyrics[:3000]}

Return JSON:
{{
  "matches": [
    {{"title": "...", "artist": "...", "year": "...", "lyric_similarity": <0-100 float>, "matched_snippet": "<the similar famous lyric>", "your_snippet": "<corresponding user line>", "reasoning": "<1 sentence>", "confidence": <0-1 float>}}
  ],
  "summary": "<2-3 sentence overall plagiarism assessment>",
  "originality_score": <0-100 float>
}}
Only include matches you genuinely recognize (0-4 entries). If lyrics appear fully original, return an empty matches array."""

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"lyric-scan-{uuid.uuid4().hex[:12]}",
            system_message=SYSTEM_PROMPT,
        ).with_model("openai", "gpt-5.4")
        response = await chat.send_message(UserMessage(text=task))
        parsed = _parse_json(str(response))
        if not parsed or "matches" not in parsed:
            logger.error(f"LLM returned unparseable output: {str(response)[:300]}")
            return {"ok": False, "error": "AI analysis returned invalid output", "matches": [], "summary": ""}
        for m in parsed["matches"]:
            m["lyric_similarity"] = round(float(m.get("lyric_similarity", 0)), 1)
            m["confidence"] = round(float(m.get("confidence", 0.5)), 2)
        parsed["matches"].sort(key=lambda m: -m["lyric_similarity"])
        return {"ok": True, **parsed}
    except Exception as e:
        logger.error(f"LLM analysis error: {e}")
        return {"ok": False, "error": str(e), "matches": [], "summary": ""}
