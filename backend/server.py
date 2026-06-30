from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import bcrypt
import jwt
import logging
import random
import hashlib
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


class CheckoutCreate(BaseModel):
    plan_id: str
    origin_url: str


# ----------------------------------------------------------------------------
# Mock plagiarism engine
# ----------------------------------------------------------------------------
# A small seeded reference catalog so results feel plausible & deterministic
REFERENCE_CATALOG = [
    {"id": "ref-001", "title": "Blurred Lines", "artist": "Robin Thicke", "year": 2013, "genre": "Pop", "snippet": "I know you want it, I know you want it"},
    {"id": "ref-002", "title": "Stay With Me", "artist": "Sam Smith", "year": 2014, "genre": "Soul", "snippet": "Won't you stay with me, 'cause you're all I need"},
    {"id": "ref-003", "title": "Photograph", "artist": "Ed Sheeran", "year": 2014, "genre": "Pop", "snippet": "Loving can hurt sometimes, but it's the only thing that I know"},
    {"id": "ref-004", "title": "Dark Horse", "artist": "Katy Perry", "year": 2013, "genre": "Pop", "snippet": "Are you ready for, ready for, a perfect storm"},
    {"id": "ref-005", "title": "Ice Ice Baby", "artist": "Vanilla Ice", "year": 1990, "genre": "Hip-Hop", "snippet": "Stop, collaborate and listen, Ice is back with a brand new invention"},
    {"id": "ref-006", "title": "Bitter Sweet Symphony", "artist": "The Verve", "year": 1997, "genre": "Rock", "snippet": "'Cause it's a bittersweet symphony, this life"},
    {"id": "ref-007", "title": "My Sweet Lord", "artist": "George Harrison", "year": 1970, "genre": "Rock", "snippet": "My sweet lord, hmm, my lord"},
    {"id": "ref-008", "title": "Levitating", "artist": "Dua Lipa", "year": 2020, "genre": "Pop", "snippet": "If you wanna run away with me, I know a galaxy"},
]


def deterministic_score(seed_text: str, mod: int = 100) -> int:
    h = hashlib.sha256(seed_text.encode("utf-8")).hexdigest()
    return int(h, 16) % mod


def run_mock_analysis(title: str, lyrics: str, audio_filename: Optional[str], region: str) -> Dict[str, Any]:
    seed = f"{title}|{lyrics[:200]}|{audio_filename or ''}"
    rng = random.Random(deterministic_score(seed, 10_000_000))

    has_audio = bool(audio_filename)
    has_lyrics = bool(lyrics and lyrics.strip())

    # Generate 3-5 matches
    n_matches = rng.randint(3, 5)
    refs = rng.sample(REFERENCE_CATALOG, n_matches)
    matches = []
    for ref in refs:
        lyric_sim = rng.uniform(2, 30) if has_lyrics else 0
        melody_sim = rng.uniform(3, 35) if has_audio else 0
        chord_sim = rng.uniform(5, 45) if has_audio else 0
        timestamp_start = rng.randint(0, 120)
        matches.append({
            "reference_id": ref["id"],
            "reference_title": ref["title"],
            "reference_artist": ref["artist"],
            "reference_year": ref["year"],
            "genre": ref["genre"],
            "lyric_similarity": round(lyric_sim, 1),
            "melodic_similarity": round(melody_sim, 1),
            "chord_progression_similarity": round(chord_sim, 1),
            "matched_snippet": ref["snippet"],
            "your_snippet": (lyrics[:80] + "...") if has_lyrics and len(lyrics) > 80 else (lyrics or "(audio-only segment)"),
            "timestamp_start_sec": timestamp_start,
            "timestamp_end_sec": timestamp_start + rng.randint(4, 12),
            "confidence": round(rng.uniform(0.55, 0.97), 2),
        })

    # Sort by combined similarity
    matches.sort(key=lambda m: m["lyric_similarity"] + m["melodic_similarity"] + m["chord_progression_similarity"], reverse=True)

    # Overall scores
    if has_audio and has_lyrics:
        overall = round(max(m["lyric_similarity"] for m in matches) * 0.4 + max(m["melodic_similarity"] for m in matches) * 0.35 + max(m["chord_progression_similarity"] for m in matches) * 0.25, 1)
    elif has_audio:
        overall = round(max(m["melodic_similarity"] for m in matches) * 0.55 + max(m["chord_progression_similarity"] for m in matches) * 0.45, 1)
    else:
        overall = round(max(m["lyric_similarity"] for m in matches), 1)

    # Waveform data (60 segments)
    waveform = [round(rng.uniform(0.2, 1.0), 2) for _ in range(60)]
    # Flag 3-8 segments as suspicious
    n_flags = rng.randint(3, 8) if has_audio else 0
    flagged_segments = sorted(rng.sample(range(60), n_flags))

    # Region verdict
    region_data = REGIONS.get(region, REGIONS["US"])
    lyric_threshold = region_data["lyric_threshold"]
    melody_threshold = region_data["melody_threshold"]
    top_lyric = max((m["lyric_similarity"] for m in matches), default=0)
    top_melody = max((m["melodic_similarity"] for m in matches), default=0)
    lyric_verdict = "VIOLATION" if top_lyric > lyric_threshold else "WITHIN_LIMITS"
    melody_verdict = "VIOLATION" if top_melody > melody_threshold else "WITHIN_LIMITS"
    overall_verdict = "VIOLATION" if "VIOLATION" in (lyric_verdict, melody_verdict) else ("REVIEW" if overall > 8 else "CLEAR")

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
    }


# ----------------------------------------------------------------------------
# Auth routes
# ----------------------------------------------------------------------------
@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    role = payload.role if payload.role in ("artist", "producer", "student") else "artist"
    doc = {
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.name.strip(),
        "role": role,
        "plan": "free",
        "scans_used": 0,
        "region": "US",
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
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

    result_data = run_mock_analysis(payload.title, payload.lyrics or "", payload.audio_filename, payload.region)

    scan_doc = {
        "user_id": str(user["_id"]),
        "title": payload.title,
        "artist_name": payload.artist_name or user.get("name", ""),
        "lyrics": payload.lyrics or "",
        "audio_filename": payload.audio_filename,
        "audio_size_bytes": payload.audio_size_bytes or 0,
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


@api.delete("/scans/{scan_id}")
async def delete_scan(scan_id: str, user: dict = Depends(get_current_user)):
    try:
        result = await db.scans.delete_one({"_id": ObjectId(scan_id), "user_id": str(user["_id"])})
    except Exception:
        raise HTTPException(status_code=404, detail="Scan not found")
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Scan not found")
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
            "created_at": datetime.now(timezone.utc),
        })
        logger.info(f"Seeded admin user: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})


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
