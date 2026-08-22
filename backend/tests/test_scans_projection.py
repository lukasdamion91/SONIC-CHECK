"""Iteration 7 - Regression check for GET /api/scans projection.

The list endpoint was changed to use a MongoDB field projection returning only
{id, title, artist_name, region, created_at, audio_filename, result.verdict,
 result.overall_score, result.doctrine, result.scan_modes}.

These tests verify:
  1. Projection returns 200 and required light fields.
  2. Heavy fields (matches / waveform / fingerprint / lyrics) are ABSENT on list.
  3. Detail endpoint GET /api/scans/{id} still returns the FULL document.
  4. GET /api/library still returns items (its own projection unaffected).
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")


@pytest.fixture(scope="module")
def admin_session():
    assert ADMIN_EMAIL and ADMIN_PASSWORD, "Archived test requires explicit disposable credentials"
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return s


# ---------- Projection tests ----------
class TestScansListProjection:
    def test_list_scans_returns_200_and_list(self, admin_session):
        r = admin_session.get(f"{API}/scans")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list), "GET /api/scans must return a list"
        assert len(data) > 0, "Admin should have existing scans - none returned"

    def test_projection_light_fields_present(self, admin_session):
        r = admin_session.get(f"{API}/scans")
        assert r.status_code == 200
        items = r.json()
        # Iterate every scan to make sure every row has the required fields
        required_top = {"id", "title", "region", "created_at"}
        for scan in items:
            missing = required_top - set(scan.keys())
            assert not missing, f"Scan {scan.get('id')} missing top-level fields: {missing}"
            # result subdoc
            assert "result" in scan, f"Scan {scan.get('id')} missing 'result' subdoc"
            result = scan["result"] or {}
            for k in ("verdict", "overall_score", "doctrine"):
                assert k in result, f"Scan {scan.get('id')} result missing '{k}' (result keys={list(result.keys())})"

    def test_projection_heavy_fields_absent(self, admin_session):
        """Heavy fields should NOT be returned by the list endpoint."""
        r = admin_session.get(f"{API}/scans")
        assert r.status_code == 200
        items = r.json()
        for scan in items:
            # top-level heavies
            assert "lyrics" not in scan, f"Scan {scan.get('id')} unexpectedly contains top-level 'lyrics'"
            # nested heavies inside result
            result = scan.get("result") or {}
            for heavy in ("matches", "waveform", "fingerprint"):
                assert heavy not in result, (
                    f"Scan {scan.get('id')} result unexpectedly contains heavy field '{heavy}'"
                )

    def test_no_mongo_object_id_leak(self, admin_session):
        r = admin_session.get(f"{API}/scans")
        assert r.status_code == 200
        items = r.json()
        for scan in items:
            assert "_id" not in scan, f"Scan {scan.get('id')} leaked mongo '_id'"
            assert isinstance(scan.get("id"), str) and len(scan["id"]) > 0


class TestScanDetailFull:
    def test_detail_returns_full_document(self, admin_session):
        # pick first scan from list
        r = admin_session.get(f"{API}/scans")
        assert r.status_code == 200
        items = r.json()
        assert items, "No scans available for detail test"
        # Try to find a scan that actually has matches (violation/review) so we can assert heavy fields exist
        target = None
        for s in items:
            if (s.get("result") or {}).get("verdict") in ("VIOLATION", "REVIEW"):
                target = s
                break
        if not target:
            target = items[0]
        scan_id = target["id"]

        r2 = admin_session.get(f"{API}/scans/{scan_id}")
        assert r2.status_code == 200, f"Detail failed: {r2.status_code} {r2.text}"
        full = r2.json()

        # top-level fields present in full doc
        for k in ("id", "title", "region", "created_at", "result"):
            assert k in full, f"Detail missing top-level '{k}'"
        assert "_id" not in full, "Detail leaked mongo '_id'"
        # lyrics field should exist on detail (even if empty string)
        assert "lyrics" in full, "Detail should include 'lyrics' key"

        # result heavy fields — at least fingerprint should always exist per run_analysis
        result = full.get("result") or {}
        assert "fingerprint" in result, "Detail result must include 'fingerprint'"
        assert "matches" in result, "Detail result must include 'matches' key"
        # waveform present only for audio scans; assert key type if present
        if "waveform" in result:
            assert isinstance(result["waveform"], list)

    def test_detail_by_first_scan_id_light_fields_still_present(self, admin_session):
        r = admin_session.get(f"{API}/scans")
        items = r.json()
        scan_id = items[0]["id"]
        r2 = admin_session.get(f"{API}/scans/{scan_id}")
        assert r2.status_code == 200
        full = r2.json()
        result = full.get("result") or {}
        for k in ("verdict", "overall_score", "doctrine"):
            assert k in result


class TestLibraryUnaffected:
    def test_library_returns_200(self, admin_session):
        r = admin_session.get(f"{API}/library")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # We don't require items > 0 but admin should typically have audio scans
        for item in data:
            assert "id" in item
            assert "_id" not in item
            assert "title" in item
            # library projection includes result.verdict + overall_score
            result = item.get("result") or {}
            assert "verdict" in result or "overall_score" in result or result == {}
