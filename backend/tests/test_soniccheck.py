"""SonicCheck backend regression + free-API engine tests (iteration 5)."""
import os
import re
import time
import subprocess
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://audio-plagiarism.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
BACKEND_LOG = "/var/log/supervisor/backend.err.log"

ADMIN_EMAIL = "admin@soniccheck.io"
ADMIN_PASSWORD = "Admin@Sonic2026"

# Famous Vanilla Ice lyrics (Ice Ice Baby) – used for lyric plagiarism assertion
VANILLA_LYRICS = (
    "Alright stop, collaborate and listen\n"
    "Ice is back with my brand new invention\n"
    "Something grabs a hold of me tightly\n"
    "Flow like a harpoon daily and nightly\n"
    "Will it ever stop? Yo, I don't know\n"
    "Turn off the lights and I'll glow\n"
    "To the extreme, I rock a mic like a vandal\n"
    "Light up a stage and wax a chump like a candle"
)

UNIQUE_LYRICS = (
    "The quiet zebrafish counted lavender constellations backwards\n"
    "Through the tangential dust of a forgotten copper submarine\n"
    "Whispering algorithms of caramelised velocity\n"
    "While the ninth ceramic teapot argued with a philosophical tulip"
)


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="session")
def fresh_user():
    """Register a brand new user for this test session."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    email = f"test_iter5_{uuid.uuid4().hex[:10]}@example.com"
    r = s.post(f"{API}/auth/register", json={
        "name": "Test User",
        "email": email,
        "password": "Testpass123!",
        "role": "artist",
    })
    assert r.status_code == 200, f"Register failed: {r.status_code} {r.text}"
    data = r.json()
    return {"session": s, "email": email, "data": data}


@pytest.fixture(scope="session")
def edu_user():
    """Register a brand new .edu user (student_eligible=True)."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    email = f"test_iter5_{uuid.uuid4().hex[:10]}@stanford.edu"
    r = s.post(f"{API}/auth/register", json={
        "name": "Edu User",
        "email": email,
        "password": "Testpass123!",
        "role": "student",
    })
    assert r.status_code == 200, f"Edu register failed: {r.status_code} {r.text}"
    return {"session": s, "email": email, "data": r.json()}


def _grep_verify_token(email: str, since_seconds: int = 60) -> str:
    """Grep the backend log for the most recent EMAIL VERIFICATION link for this email."""
    try:
        out = subprocess.check_output(
            ["grep", "EMAIL VERIFICATION", BACKEND_LOG], stderr=subprocess.DEVNULL
        ).decode(errors="ignore")
    except subprocess.CalledProcessError:
        return ""
    # Find the last line for this email
    lines = [ln for ln in out.splitlines() if email in ln]
    if not lines:
        return ""
    m = re.search(r"token=([a-f0-9]+)", lines[-1])
    return m.group(1) if m else ""


# ---------- Health / regressions ----------
class TestHealth:
    def test_root(self):
        r = requests.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_regions(self):
        r = requests.get(f"{API}/regions")
        assert r.status_code == 200
        codes = [x["code"] for x in r.json()]
        assert "US" in codes and "EU" in codes

    def test_plans(self):
        r = requests.get(f"{API}/plans")
        assert r.status_code == 200
        ids = [p["id"] for p in r.json()]
        assert "student" in ids and "artist_pro" in ids and "producer_pro" in ids


# ---------- Registration + email verification ----------
class TestAuthVerification:
    def test_register_returns_verification_fields(self, fresh_user):
        data = fresh_user["data"]
        assert data["email_verified"] is False
        assert data["student_eligible"] is False  # non-edu

    def test_edu_register_student_eligible(self, edu_user):
        assert edu_user["data"]["student_eligible"] is True
        assert edu_user["data"]["email_verified"] is False

    def test_verification_link_logged_and_verify(self, fresh_user):
        # give backend a beat to flush
        time.sleep(1)
        token = _grep_verify_token(fresh_user["email"])
        assert token, f"No verification token logged for {fresh_user['email']}"
        r = fresh_user["session"].post(f"{API}/auth/verify-email", json={"token": token})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True

        # /me now shows verified
        me = fresh_user["session"].get(f"{API}/auth/me")
        assert me.status_code == 200
        assert me.json()["email_verified"] is True

    def test_verify_email_invalid_token(self):
        r = requests.post(f"{API}/auth/verify-email", json={"token": "bogus_deadbeef"})
        assert r.status_code == 400

    def test_resend_for_verified_user_returns_already_verified(self, fresh_user):
        # fresh_user just got verified in previous test
        r = fresh_user["session"].post(f"{API}/auth/resend-verification")
        assert r.status_code == 200
        assert r.json().get("already_verified") is True

    def test_resend_for_unverified_user_ok(self, edu_user):
        r = edu_user["session"].post(f"{API}/auth/resend-verification")
        assert r.status_code == 200
        body = r.json()
        assert body.get("ok") is True
        assert body.get("already_verified") is not True
        # verify a new link was logged
        time.sleep(1)
        token = _grep_verify_token(edu_user["email"])
        assert token, "No verification link was logged on resend"


# ---------- Admin regression ----------
class TestAdminRegression:
    def test_admin_login_and_me(self, admin_session):
        r = admin_session.get(f"{API}/auth/me")
        assert r.status_code == 200
        me = r.json()
        assert me["email"] == ADMIN_EMAIL
        assert me["email_verified"] is True

    def test_list_scans(self, admin_session):
        r = admin_session.get(f"{API}/scans")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_patch_region(self, admin_session):
        r = admin_session.patch(f"{API}/auth/region", json={"region": "EU"})
        assert r.status_code == 200
        assert r.json()["region"] == "EU"
        # restore
        admin_session.patch(f"{API}/auth/region", json={"region": "US"})


# ---------- Lyrics-only scan (LLM) ----------
class TestLyricScan:
    def test_lyric_scan_famous_lyrics(self, admin_session):
        # admin is producer_pro, no quota issue
        data = {"title": "TEST_IceIceBaby", "region": "US", "lyrics": VANILLA_LYRICS}
        headers = {k: v for k, v in admin_session.headers.items() if k.lower() != "content-type"}
        r = requests.post(f"{API}/scans/upload", data=data, cookies=admin_session.cookies, headers=headers, timeout=120)
        assert r.status_code == 200, r.text
        body = r.json()
        result = body.get("result") or {}
        assert result.get("scan_modes", {}).get("lyrics") is True
        la = result.get("lyric_analysis")
        assert la and la.get("ok") is True, f"lyric_analysis not ok: {la}"
        assert "Semantic" in (la.get("engine") or ""), f"unexpected engine: {la.get('engine')}"
        assert la.get("summary"), "summary empty"
        assert la.get("originality_score") is not None
        matches = result.get("matches") or []
        assert matches, "no matches returned"
        # top lyric similarity should be high because these are famous verbatim lyrics
        top = max((m.get("lyric_similarity", 0) for m in matches), default=0)
        assert top >= 40, f"expected high lyric_similarity, got {top}"
        assert result.get("verdict") == "VIOLATION", f"verdict={result.get('verdict')}, top_lyric={top}"
        # cleanup
        admin_session.delete(f"{API}/scans/{body['id']}")

    def test_lyric_scan_original_lyrics(self, admin_session):
        data = {"title": "TEST_UniqueLyrics", "region": "US", "lyrics": UNIQUE_LYRICS}
        headers = {k: v for k, v in admin_session.headers.items() if k.lower() != "content-type"}
        r = requests.post(f"{API}/scans/upload", data=data, cookies=admin_session.cookies, headers=headers, timeout=120)
        assert r.status_code == 200, r.text
        body = r.json()
        result = body.get("result") or {}
        la = result.get("lyric_analysis")
        assert la and la.get("ok") is True
        top_lyric = result.get("top_lyric_similarity", 0)
        assert top_lyric < 25, f"expected low similarity for unique lyrics, got {top_lyric}"
        assert result.get("verdict") in ("CLEAR", "REVIEW"), f"verdict={result.get('verdict')}"
        admin_session.delete(f"{API}/scans/{body['id']}")


# ---------- Audio scan (fingerprint) ----------
class TestAudioScan:
    def test_audio_scan_synthetic_tone(self, admin_session):
        # generate 15s sine wave
        path = "/tmp/test_iter5_sine.mp3"
        subprocess.run(
            ["ffmpeg", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=15", path],
            check=True, capture_output=True,
        )
        with open(path, "rb") as fh:
            data = {"title": "TEST_SyntheticSine", "region": "US", "lyrics": ""}
            files = {"file": ("sine.mp3", fh, "audio/mpeg")}
            headers = {k: v for k, v in admin_session.headers.items() if k.lower() != "content-type"}
            r = requests.post(f"{API}/scans/upload", data=data, files=files, cookies=admin_session.cookies, headers=headers, timeout=120)
        assert r.status_code == 200, r.text
        body = r.json()
        result = body.get("result") or {}
        fp = result.get("fingerprint")
        assert fp is not None, "fingerprint block missing"
        # ACRCloud might match the sine tone; accept engine as AcoustID or ACRCloud fallback
        assert fp.get("engine") in ("AcoustID + MusicBrainz", "ACRCloud (fallback)"), fp.get("engine")
        # status_code should be 1001 (no match) if primary engine returned nothing;
        # if ACR fallback fired with a match, code=0 is also acceptable
        assert fp.get("status_code") in (0, 1001, 2004), fp.get("status_code")
        waveform = result.get("waveform") or []
        assert len(waveform) == 60, f"waveform bar count = {len(waveform)}"
        assert all(isinstance(b, (int, float)) for b in waveform)
        assert result.get("scan_modes", {}).get("audio") is True
        admin_session.delete(f"{API}/scans/{body['id']}")


# ---------- Quota enforcement ----------
class TestQuota:
    def test_free_tier_quota_402_after_3(self):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        email = f"test_iter5_quota_{uuid.uuid4().hex[:8]}@example.com"
        r = s.post(f"{API}/auth/register", json={
            "name": "Quota User", "email": email, "password": "Testpass123!", "role": "artist",
        })
        assert r.status_code == 200
        # small lyric scan payload (skip LLM by using JSON endpoint? no — JSON also runs analysis).
        # To avoid burning LLM budget, use short lyrics repeated. We'll only do 4 posts and check the 4th 402.
        for i in range(3):
            rr = s.post(f"{API}/scans", json={
                "title": f"TEST_quota_{i}", "lyrics": UNIQUE_LYRICS, "region": "US",
            }, timeout=120)
            assert rr.status_code == 200, f"scan #{i}: {rr.status_code} {rr.text}"
        rr = s.post(f"{API}/scans", json={
            "title": "TEST_quota_over", "lyrics": UNIQUE_LYRICS, "region": "US",
        }, timeout=120)
        assert rr.status_code == 402, f"expected 402, got {rr.status_code} {rr.text}"


# ---------- Student plan gating ----------
class TestStudentGate:
    def test_non_edu_blocked(self, admin_session):
        # admin has student_eligible=False
        r = admin_session.post(f"{API}/checkout/session", json={
            "plan_id": "student", "origin_url": BASE_URL,
        })
        assert r.status_code == 403, r.text

    def test_edu_allowed(self, edu_user):
        s = edu_user["session"]
        r = s.post(f"{API}/checkout/session", json={
            "plan_id": "student", "origin_url": BASE_URL,
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("url", "").startswith("https://")
        assert "session_id" in body


# ---------- Scan CRUD regression ----------
class TestScanCRUD:
    def test_get_and_delete(self, admin_session):
        r = admin_session.post(f"{API}/scans", json={
            "title": "TEST_crud_lyric",
            "lyrics": UNIQUE_LYRICS,
            "region": "US",
        }, timeout=120)
        assert r.status_code == 200
        sid = r.json()["id"]

        get = admin_session.get(f"{API}/scans/{sid}")
        assert get.status_code == 200
        assert get.json()["id"] == sid

        d = admin_session.delete(f"{API}/scans/{sid}")
        assert d.status_code == 200

        get2 = admin_session.get(f"{API}/scans/{sid}")
        assert get2.status_code == 404
