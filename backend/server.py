from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import bcrypt
import jwt
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File, Form
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from bson import ObjectId

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionResponse,
    CheckoutStatusResponse,
    CheckoutSessionRequest,
)

from acr import identify_bytes as acr_identify_bytes, parse_tracks as acr_parse_tracks, is_configured as acr_configured
import fingerprint as fp_engine
import lyrics_free
import semantic
import report as report_pdf
import storage as obj_storage
import asyncio

# ----------------------------------------------------------------------------
# Config
# ----------------------------------------------------------------------------
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 day for convenience
REFRESH_TOKEN_EXPIRE_DAYS = 7

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("soniccheck")

# Subscription tiers — server-defined, never trust frontend
PLANS: Dict[str, Dict[str, Any]] = {
    "artist_pro": {"name": "Artist Pro", "price": 19.0, "currency": "usd", "scans_per_month": 50, "features": ["Unlimited lyric checks", "50 audio scans/mo", "Regional thresholds", "PDF reports"]},
    "producer_pro": {"name": "Producer Pro", "price": 49.0, "currency": "usd", "scans_per_month": 250, "features": ["Everything in Artist Pro", "250 audio scans/mo", "Stem-level analysis", "Priority queue"]},
    "student": {"name": "Student", "price": 8.0, "currency": "usd", "scans_per_month": 20, "features": ["Verify your edu email", "20 scans/mo", "Educational reports"]},
}

# Regional jurisdiction thresholds (% similarity considered "fair use" / acceptable)
REGIONS: Dict[str, Dict[str, Any]] = {
    "US": {"name": "United States", "doctrine": "Fair Use", "lyric_threshold": 15, "melody_threshold": 12, "notes": "US courts evaluate purpose, nature, amount, market effect (17 U.S.C. § 107)."},
    "EU": {"name": "European Union", "doctrine": "Quotation Exception", "lyric_threshold": 10, "melody_threshold": 10, "notes": "InfoSoc Directive 2001/29 — quotation must be 'in accordance with fair practice'."},
    "UK": {"name": "United Kingdom", "doctrine": "Fair Dealing", "lyric_threshold": 10, "melody_threshold": 10, "notes": "CDPA 1988 — fair dealing is narrowly defined (criticism, review, news reporting)."},
    "CA": {"name": "Canada", "doctrine": "Fair Dealing", "lyric_threshold": 12, "melody_threshold": 12, "notes": "Copyright Act §29 — fair dealing for enumerated purposes."},
    "AU": {"name": "Australia", "doctrine": "Fair Dealing", "lyric_threshold": 10, "melody_threshold": 10, "notes": "Copyright Act 1968 — fair dealing for specific purposes."},
    "JP": {"name": "Japan", "doctrine": "Quotation (Art. 32)", "lyric_threshold": 8, "melody_threshold": 8, "notes": "JASRAC enforcement — strict quotation requirements."},
    "IN": {"name": "India", "doctrine": "Fair Dealing", "lyric_threshold": 12, "melody_threshold": 12, "notes": "Section 52 of the Copyright Act — fair dealing exceptions."},
    "BR": {"name": "Brazil", "doctrine": "Limitations (Art. 46)", "lyric_threshold": 10, "melody_threshold": 10, "notes": "Brazilian Copyright Law Law 9.610/98 — short excerpts permitted."},
}


# ----------------------------------------------------------------------------
# FastAPI app + router
# ----------------------------------------------------------------------------
app = FastAPI(title="SonicCheck API")
api = APIRouter(prefix="/api")


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "type": "refresh",
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str) -> None:
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=REFRESH_TOKEN_EXPIRE_DAYS * 86400, path="/")


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


def serialize_user(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user.get("name", ""),
        "role": user.get("role", "user"),
        "plan": user.get("plan", "free"),
        "scans_used": user.get("scans_used", 0),
        "region": user.get("region", "US"),
        "email_verified": user.get("email_verified", False),
        "student_eligible": user.get("student_eligible", False),
        "created_at": user.get("created_at").isoformat() if isinstance(user.get("created_at"), datetime) else user.get("created_at"),
    }


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ----------------------------------------------------------------------------
# Models
# ----------------------------------------------------------------------------
class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    role: str = Field(default="artist")  # artist | producer | student


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ScanCreate(BaseModel):
    title: str
    artist_name: Optional[str] = ""
    lyrics: Optional[str] = ""
    region: str = "US"
    audio_filename: Optional[str] = None
    audio_size_bytes: Optional[int] = 0
    audio_url: Optional[str] = None  # direct downloadable audio URL


class CheckoutCreate(BaseModel):
    plan_id: str
    origin_url: str


# ----------------------------------------------------------------------------
# Real plagiarism engine — AcoustID/MusicBrainz + Genius + AI semantic matching
# ----------------------------------------------------------------------------
async def _analyze_audio(audio_bytes: bytes, audio_filename: str) -> tuple[dict, list, list]:
    """Returns (fingerprint_block, waveform, fingerprint_matches)."""
    fp_result, waveform = await asyncio.gather(
        fp_engine.identify_bytes(audio_bytes, audio_filename),
        fp_engine.compute_waveform(audio_bytes, "." + (audio_filename.rsplit(".", 1)[-1] if "." in audio_filename else "mp3")),
    )
    engine = "AcoustID + MusicBrainz"
    tracks = fp_result["matches"]
    code = fp_result["status"]["code"]
    msg = fp_result["status"]["msg"]

    if not tracks and acr_configured() and code != 0:
        acr_resp = await acr_identify_bytes(audio_bytes, audio_filename, "audio/mpeg")
        acr_code = (acr_resp.get("status") or {}).get("code", 9999)
        if acr_code == 0:
            acr_tracks = acr_parse_tracks(acr_resp)
            if acr_tracks:
                engine = "ACRCloud (fallback)"
                code, msg = 0, "Success"
                tracks = [{
                    "title": t.get("title", "Unknown"),
                    "artist": t.get("artist", "Unknown"),
                    "album": t.get("album", ""),
                    "mbid": "",
                    "acoustid": t.get("acrid", ""),
                    "release_date": t.get("release_date", ""),
                    "confidence": round(min(99.0, float(t.get("confidence") or 90)), 1),
                    "duration_ms": t.get("duration_ms", 0),
                    "source": "ACRCloud",
                    "isrc": t.get("isrc", ""),
                    "label": t.get("label", ""),
                } for t in acr_tracks]

    fingerprint_block = {
        "engine": engine,
        "status_code": code,
        "status_msg": msg,
        "matches": tracks,
        "match_count": len(tracks),
    }

    fp_matches = []
    for t in tracks:
        conf = float(t.get("confidence") or 0)
        fp_matches.append({
            "reference_id": t.get("mbid") or t.get("acoustid") or f"fp-{len(fp_matches)}",
            "reference_title": t.get("title", "Unknown"),
            "reference_artist": t.get("artist", "Unknown"),
            "reference_year": (t.get("release_date") or "").split("-")[0] or "—",
            "genre": "Commercial catalog",
            "lyric_similarity": 0,
            "melodic_similarity": round(min(99.0, conf), 1),
            "chord_progression_similarity": round(min(95.0, conf * 0.92), 1),
            "matched_snippet": f"Fingerprint match · {t.get('source', 'AcoustID')}" + (f" · MBID {t['mbid'][:8]}…" if t.get("mbid") else ""),
            "your_snippet": "(audio fingerprint match — your recording matches this released track)",
            "timestamp_start_sec": 0,
            "timestamp_end_sec": int((t.get("duration_ms") or 10000) / 1000),
            "confidence": round(conf / 100, 2),
            "is_fingerprint_match": True,
        })
    return fingerprint_block, waveform, fp_matches


async def _analyze_lyrics(lyrics: str, title: str) -> tuple[dict, list]:
    """Returns (lyric_analysis_block, lyric_matches)."""
    candidates = await lyrics_free.find_candidates(lyrics, title)
    llm = await semantic.analyze_lyrics(lyrics, candidates, title)
    block = {
        "engine": "Genius + AI Semantic" if candidates else "AI Semantic",
        "candidates_checked": len(candidates),
        "ok": llm.get("ok", False),
        "summary": llm.get("summary", ""),
        "originality_score": llm.get("originality_score"),
        "error": llm.get("error"),
    }
    matches = []
    for i, m in enumerate(llm.get("matches", [])):
        matches.append({
            "reference_id": f"lyric-{i}",
            "reference_title": m.get("title", "Unknown"),
            "reference_artist": m.get("artist", "Unknown"),
            "reference_year": str(m.get("year") or "—"),
            "genre": "Lyric reference",
            "lyric_similarity": m.get("lyric_similarity", 0),
            "melodic_similarity": 0,
            "chord_progression_similarity": 0,
            "matched_snippet": m.get("matched_snippet", ""),
            "your_snippet": m.get("your_snippet", ""),
            "reasoning": m.get("reasoning", ""),
            "timestamp_start_sec": 0,
            "timestamp_end_sec": 0,
            "confidence": m.get("confidence", 0.5),
        })
    return block, matches


async def run_analysis(title: str, lyrics: str, region: str, audio_bytes: Optional[bytes] = None, audio_filename: Optional[str] = None) -> Dict[str, Any]:
    has_audio = bool(audio_bytes)
    has_lyrics = bool(lyrics and lyrics.strip())
    region_data = REGIONS.get(region, REGIONS["US"])
    lyric_threshold = region_data["lyric_threshold"]
    melody_threshold = region_data["melody_threshold"]

    tasks = []
    tasks.append(_analyze_audio(audio_bytes, audio_filename or "sample.mp3") if has_audio else None)
    tasks.append(_analyze_lyrics(lyrics, title) if has_lyrics else None)
    results = await asyncio.gather(*[t for t in tasks if t is not None])

    fingerprint_block, waveform, matches, lyric_block = None, [], [], None
    idx = 0
    if has_audio:
        fingerprint_block, waveform, fp_matches = results[idx]
        matches.extend(fp_matches)
        idx += 1
    if has_lyrics:
        lyric_block, lyric_matches = results[idx]
        matches.extend(lyric_matches)

    matches.sort(key=lambda m: max(m["lyric_similarity"], m["melodic_similarity"]), reverse=True)

    top_lyric = max((m["lyric_similarity"] for m in matches), default=0)
    top_melody = max((m["melodic_similarity"] for m in matches), default=0)
    overall = round(max(top_lyric, top_melody), 1)

    lyric_verdict = "VIOLATION" if top_lyric > lyric_threshold else "WITHIN_LIMITS"
    melody_verdict = "VIOLATION" if top_melody > melody_threshold else "WITHIN_LIMITS"
    overall_verdict = "VIOLATION" if "VIOLATION" in (lyric_verdict, melody_verdict) else ("REVIEW" if overall > 8 else "CLEAR")

    flagged_segments = list(range(len(waveform))) if (fingerprint_block and fingerprint_block["match_count"] > 0) else []

    return {
        "overall_score": overall,
        "verdict": overall_verdict,
        "lyric_verdict": lyric_verdict,
        "melody_verdict": melody_verdict,
        "lyric_threshold": lyric_threshold,
        "melody_threshold": melody_threshold,
        "top_lyric_similarity": round(top_lyric, 1),
        "top_melody_similarity": round(top_melody, 1),
        "matches": matches,
        "waveform": waveform,
        "flagged_segments": flagged_segments,
        "region": region,
        "region_name": region_data["name"],
        "doctrine": region_data["doctrine"],
        "regional_notes": region_data["notes"],
        "scan_modes": {"audio": has_audio, "lyrics": has_lyrics},
        "fingerprint": fingerprint_block,
        "lyric_analysis": lyric_block,
    }


# ----------------------------------------------------------------------------
# Auth routes
# ----------------------------------------------------------------------------
def is_edu_email(email: str) -> bool:
    domain = email.rsplit("@", 1)[-1]
    return domain.endswith(".edu") or ".edu." in domain or domain.endswith(".ac.uk")


def log_verification_link(email: str, token: str) -> None:
    base = os.environ.get("FRONTEND_URL", "").rstrip("/")
    link = f"{base}/verify-email?token={token}"
    logger.info(f"[EMAIL VERIFICATION] To: {email} — Verify link: {link}")


@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    role = payload.role if payload.role in ("artist", "producer", "student") else "artist"
    verify_token = uuid.uuid4().hex
    doc = {
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.name.strip(),
        "role": role,
        "plan": "free",
        "scans_used": 0,
        "region": "US",
        "email_verified": False,
        "verify_token": verify_token,
        "student_eligible": is_edu_email(email),
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    log_verification_link(email, verify_token)
    access = create_access_token(str(result.inserted_id), email)
    refresh = create_refresh_token(str(result.inserted_id))
    set_auth_cookies(response, access, refresh)
    return serialize_user(doc)


@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    access = create_access_token(str(user["_id"]), email)
    refresh = create_refresh_token(str(user["_id"]))
    set_auth_cookies(response, access, refresh)
    return serialize_user(user)


@api.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return serialize_user(user)


@api.post("/auth/verify-email")
async def verify_email(payload: dict):
    token = (payload.get("token") or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="Missing verification token")
    user = await db.users.find_one({"verify_token": token})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification link")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"email_verified": True}, "$unset": {"verify_token": ""}})
    return {"ok": True, "email": user["email"]}


@api.post("/auth/resend-verification")
async def resend_verification(user: dict = Depends(get_current_user)):
    if user.get("email_verified"):
        return {"ok": True, "already_verified": True}
    token = user.get("verify_token") or uuid.uuid4().hex
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"verify_token": token}})
    log_verification_link(user["email"], token)
    return {"ok": True, "message": "Verification link sent (check server console — free tier uses console delivery)"}


@api.patch("/auth/region")
async def update_region(payload: dict, user: dict = Depends(get_current_user)):
    region = payload.get("region", "US")
    if region not in REGIONS:
        raise HTTPException(status_code=400, detail="Invalid region")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"region": region}})
    user["region"] = region
    return serialize_user(user)


# ----------------------------------------------------------------------------
# Regions & plans
# ----------------------------------------------------------------------------
@api.get("/regions")
async def get_regions():
    return [{"code": code, **info} for code, info in REGIONS.items()]


@api.get("/plans")
async def get_plans():
    return [{"id": pid, **p} for pid, p in PLANS.items()]


# ----------------------------------------------------------------------------
# Scans
# ----------------------------------------------------------------------------
async def store_audio_if_paid(user: dict, audio_bytes: Optional[bytes], audio_filename: Optional[str]) -> Optional[dict]:
    """Persist audio to object storage for paid plans. Returns file record or None."""
    if not audio_bytes:
        return None
    plan = user.get("plan", "free")
    if plan == "free" and user.get("role") != "admin":
        return None
    ext = (audio_filename or "audio.mp3").rsplit(".", 1)[-1].lower() if "." in (audio_filename or "") else "mp3"
    content_type = obj_storage.mime_for(audio_filename or "audio.mp3")
    path = f"{obj_storage.APP_NAME}/uploads/{str(user['_id'])}/{uuid.uuid4().hex}.{ext}"
    try:
        result = await obj_storage.put_object(path, audio_bytes, content_type)
    except Exception as e:
        logger.error(f"Audio storage upload failed: {e}")
        return None
    record = {
        "storage_path": result["path"],
        "user_id": str(user["_id"]),
        "original_filename": audio_filename or "audio",
        "content_type": content_type,
        "size": result.get("size", len(audio_bytes)),
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.files.insert_one(dict(record))
    return record


@api.post("/scans/upload")
async def create_scan_upload(
    request: Request,
    title: str = Form(...),
    artist_name: str = Form(""),
    lyrics: str = Form(""),
    region: str = Form("US"),
    audio_url: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    user: dict = Depends(get_current_user),
):
    plan = user.get("plan", "free")
    scans_used = user.get("scans_used", 0)
    if plan == "free" and scans_used >= 3:
        raise HTTPException(status_code=402, detail="Free quota reached — upgrade to continue scanning")
    plan_limit = PLANS.get(plan, {}).get("scans_per_month")
    if plan_limit is not None and scans_used >= plan_limit:
        raise HTTPException(status_code=402, detail="Plan quota reached for this month")
    if region not in REGIONS:
        raise HTTPException(status_code=400, detail="Invalid region")
    if not (lyrics and lyrics.strip()) and not file and not audio_url:
        raise HTTPException(status_code=400, detail="Provide lyrics, upload audio, or paste an audio URL")

    audio_bytes = None
    audio_filename = None
    audio_size = 0

    if file is not None:
        audio_bytes = await file.read()
        audio_filename = file.filename
        audio_size = len(audio_bytes)
    elif audio_url:
        audio_bytes, audio_filename, err = await fp_engine.download_audio(audio_url)
        if audio_bytes is None:
            raise HTTPException(status_code=400, detail=err or "Could not download audio from URL")
        audio_size = len(audio_bytes)

    result = await run_analysis(title, lyrics or "", region, audio_bytes, audio_filename)

    file_record = await store_audio_if_paid(user, audio_bytes, audio_filename)

    scan_doc = {
        "user_id": str(user["_id"]),
        "title": title,
        "artist_name": artist_name or user.get("name", ""),
        "lyrics": lyrics or "",
        "audio_filename": audio_filename,
        "audio_size_bytes": audio_size,
        "audio_url": audio_url,
        "audio_storage_path": file_record["storage_path"] if file_record else None,
        "audio_content_type": file_record["content_type"] if file_record else None,
        "region": region,
        "result": result,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    inserted = await db.scans.insert_one(scan_doc)
    scan_doc["id"] = str(inserted.inserted_id)
    scan_doc.pop("_id", None)
    await db.users.update_one({"_id": user["_id"]}, {"$inc": {"scans_used": 1}})
    return scan_doc


@api.post("/scans")
async def create_scan(payload: ScanCreate, user: dict = Depends(get_current_user)):
    # Free tier: 3 scans
    plan = user.get("plan", "free")
    scans_used = user.get("scans_used", 0)
    if plan == "free" and scans_used >= 3:
        raise HTTPException(status_code=402, detail="Free quota reached — upgrade to continue scanning")
    plan_limit = PLANS.get(plan, {}).get("scans_per_month")
    if plan_limit is not None and scans_used >= plan_limit:
        raise HTTPException(status_code=402, detail="Plan quota reached for this month")
    if payload.region not in REGIONS:
        raise HTTPException(status_code=400, detail="Invalid region")
    if not (payload.lyrics and payload.lyrics.strip()) and not payload.audio_filename and not payload.audio_url:
        raise HTTPException(status_code=400, detail="Provide lyrics or upload an audio file")

    audio_bytes = None
    audio_filename = payload.audio_filename
    if payload.audio_url:
        audio_bytes, dl_filename, err = await fp_engine.download_audio(payload.audio_url)
        if audio_bytes is None:
            raise HTTPException(status_code=400, detail=err or "Could not download audio from URL")
        audio_filename = audio_filename or dl_filename

    result_data = await run_analysis(payload.title, payload.lyrics or "", payload.region, audio_bytes, audio_filename)

    file_record = await store_audio_if_paid(user, audio_bytes, audio_filename)

    scan_doc = {
        "user_id": str(user["_id"]),
        "title": payload.title,
        "artist_name": payload.artist_name or user.get("name", ""),
        "lyrics": payload.lyrics or "",
        "audio_filename": audio_filename,
        "audio_size_bytes": payload.audio_size_bytes or (len(audio_bytes) if audio_bytes else 0),
        "audio_storage_path": file_record["storage_path"] if file_record else None,
        "audio_content_type": file_record["content_type"] if file_record else None,
        "region": payload.region,
        "result": result_data,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    inserted = await db.scans.insert_one(scan_doc)
    scan_doc["id"] = str(inserted.inserted_id)
    scan_doc.pop("_id", None)
    await db.users.update_one({"_id": user["_id"]}, {"$inc": {"scans_used": 1}})
    return scan_doc


@api.get("/scans")
async def list_scans(user: dict = Depends(get_current_user)):
    cursor = db.scans.find({"user_id": str(user["_id"])}).sort("created_at", -1).limit(100)
    items = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        items.append(doc)
    return items


@api.get("/scans/{scan_id}")
async def get_scan(scan_id: str, user: dict = Depends(get_current_user)):
    try:
        doc = await db.scans.find_one({"_id": ObjectId(scan_id), "user_id": str(user["_id"])})
    except Exception:
        raise HTTPException(status_code=404, detail="Scan not found")
    if not doc:
        raise HTTPException(status_code=404, detail="Scan not found")
    doc["id"] = str(doc.pop("_id"))
    return doc


@api.get("/scans/{scan_id}/report")
async def download_report(scan_id: str, user: dict = Depends(get_current_user)):
    if user.get("plan", "free") == "free" and user.get("role") != "admin":
        raise HTTPException(status_code=402, detail="PDF reports are a Pro feature — upgrade to Artist Pro, Producer Pro or Student")
    try:
        doc = await db.scans.find_one({"_id": ObjectId(scan_id), "user_id": str(user["_id"])})
    except Exception:
        raise HTTPException(status_code=404, detail="Scan not found")
    if not doc:
        raise HTTPException(status_code=404, detail="Scan not found")
    doc["id"] = str(doc.pop("_id"))
    pdf_bytes, integrity_hash = await asyncio.to_thread(report_pdf.build_pdf, doc, user)
    safe_title = "".join(c for c in (doc.get("title") or "scan") if c.isalnum() or c in " -_").strip().replace(" ", "_")[:40]
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="soniccheck_report_{safe_title}.pdf"',
            "X-Integrity-Hash": integrity_hash,
        },
    )


@api.get("/scans/{scan_id}/audio")
async def get_scan_audio(scan_id: str, user: dict = Depends(get_current_user)):
    try:
        doc = await db.scans.find_one({"_id": ObjectId(scan_id), "user_id": str(user["_id"])})
    except Exception:
        raise HTTPException(status_code=404, detail="Scan not found")
    if not doc:
        raise HTTPException(status_code=404, detail="Scan not found")
    path = doc.get("audio_storage_path")
    if not path:
        raise HTTPException(status_code=404, detail="No stored audio for this scan — audio storage is a Pro feature")
    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="Audio file not found")
    try:
        data, content_type = await obj_storage.get_object(path)
    except Exception as e:
        logger.error(f"Audio storage fetch failed: {e}")
        raise HTTPException(status_code=502, detail="Could not retrieve audio from storage")
    return Response(
        content=data,
        media_type=doc.get("audio_content_type") or content_type,
        headers={"Content-Disposition": f'inline; filename="{doc.get("audio_filename") or "audio"}"', "Accept-Ranges": "bytes"},
    )


@api.delete("/scans/{scan_id}")
async def delete_scan(scan_id: str, user: dict = Depends(get_current_user)):
    try:
        doc = await db.scans.find_one({"_id": ObjectId(scan_id), "user_id": str(user["_id"])})
    except Exception:
        raise HTTPException(status_code=404, detail="Scan not found")
    if not doc:
        raise HTTPException(status_code=404, detail="Scan not found")
    if doc.get("audio_storage_path"):
        await db.files.update_one({"storage_path": doc["audio_storage_path"]}, {"$set": {"is_deleted": True}})
    await db.scans.delete_one({"_id": doc["_id"]})
    return {"ok": True}


# ----------------------------------------------------------------------------
# Stripe checkout
# ----------------------------------------------------------------------------
def _stripe_client(http_request: Request) -> StripeCheckout:
    api_key = os.environ["STRIPE_API_KEY"]
    host_url = str(http_request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    return StripeCheckout(api_key=api_key, webhook_url=webhook_url)


@api.post("/checkout/session")
async def create_checkout(payload: CheckoutCreate, request: Request, user: dict = Depends(get_current_user)):
    if payload.plan_id not in PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan")
    if payload.plan_id == "student" and not user.get("student_eligible"):
        raise HTTPException(status_code=403, detail="Student plan requires a verified .edu email address — register with your school email")
    plan = PLANS[payload.plan_id]
    origin = payload.origin_url.rstrip("/")
    success_url = f"{origin}/payment-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/pricing"
    metadata = {"user_id": str(user["_id"]), "plan_id": payload.plan_id, "email": user["email"]}

    sc = _stripe_client(request)
    req = CheckoutSessionRequest(
        amount=float(plan["price"]),
        currency=plan["currency"],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )
    session: CheckoutSessionResponse = await sc.create_checkout_session(req)

    await db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "user_id": str(user["_id"]),
        "email": user["email"],
        "plan_id": payload.plan_id,
        "amount": float(plan["price"]),
        "currency": plan["currency"],
        "metadata": metadata,
        "payment_status": "initiated",
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"url": session.url, "session_id": session.session_id}


@api.get("/checkout/status/{session_id}")
async def checkout_status(session_id: str, request: Request, user: dict = Depends(get_current_user)):
    sc = _stripe_client(request)
    status: CheckoutStatusResponse = await sc.get_checkout_status(session_id)

    record = await db.payment_transactions.find_one({"session_id": session_id})
    already_processed = bool(record and record.get("payment_status") == "paid")

    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {"payment_status": status.payment_status, "status": status.status, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )

    if status.payment_status == "paid" and not already_processed:
        plan_id = record.get("plan_id") if record else None
        if plan_id in PLANS:
            await db.users.update_one(
                {"_id": ObjectId(record["user_id"])},
                {"$set": {"plan": plan_id, "scans_used": 0, "plan_activated_at": datetime.now(timezone.utc).isoformat()}},
            )

    return {
        "session_id": session_id,
        "payment_status": status.payment_status,
        "status": status.status,
        "amount_total": status.amount_total,
        "currency": status.currency,
    }


@app.post("/api/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    sc = StripeCheckout(api_key=os.environ["STRIPE_API_KEY"], webhook_url=f"{request.base_url}api/webhook/stripe")
    try:
        webhook_response = await sc.handle_webhook(body, signature)
    except Exception as e:
        logger.error(f"Stripe webhook error: {e}")
        raise HTTPException(status_code=400, detail="Invalid webhook")

    sid = webhook_response.session_id
    if sid:
        record = await db.payment_transactions.find_one({"session_id": sid})
        already_processed = bool(record and record.get("payment_status") == "paid")
        await db.payment_transactions.update_one(
            {"session_id": sid},
            {"$set": {"payment_status": webhook_response.payment_status, "event_type": webhook_response.event_type, "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
        if webhook_response.payment_status == "paid" and not already_processed and record:
            plan_id = record.get("plan_id")
            if plan_id in PLANS:
                await db.users.update_one(
                    {"_id": ObjectId(record["user_id"])},
                    {"$set": {"plan": plan_id, "scans_used": 0, "plan_activated_at": datetime.now(timezone.utc).isoformat()}},
                )
    return {"received": True}


# ----------------------------------------------------------------------------
# Health
# ----------------------------------------------------------------------------
@api.get("/")
async def root():
    return {"app": os.environ.get("APP_NAME", "SonicCheck"), "ok": True}


# ----------------------------------------------------------------------------
# Startup
# ----------------------------------------------------------------------------
@app.on_event("startup")
async def startup_tasks():
    await db.users.create_index("email", unique=True)
    await db.scans.create_index("user_id")
    await db.payment_transactions.create_index("session_id", unique=True)
    await db.files.create_index("storage_path")
    try:
        await obj_storage.init_storage()
        logger.info("Object storage initialized")
    except Exception as e:
        logger.error(f"Object storage init failed: {e}")

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "admin",
            "plan": "producer_pro",
            "scans_used": 0,
            "region": "US",
            "email_verified": True,
            "student_eligible": False,
            "created_at": datetime.now(timezone.utc),
        })
        logger.info(f"Seeded admin user: {admin_email}")
    else:
        updates = {}
        if not verify_password(admin_password, existing["password_hash"]):
            updates["password_hash"] = hash_password(admin_password)
        if not existing.get("email_verified"):
            updates["email_verified"] = True
        if updates:
            await db.users.update_one({"email": admin_email}, {"$set": updates})


@app.on_event("shutdown")
async def shutdown():
    client.close()


# Mount router & CORS
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)
