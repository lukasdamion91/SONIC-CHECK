"""Emit sanitized V36 fixtures using a pinned, local canonical API checkout.

Usage: python scripts/generate-v36-api-fixtures.py /path/to/sonic-check-api
Redirect stdout to scripts/fixtures/v36-api-projections.json. No provider,
database, audio, private scan, or server module is used.
"""

import hashlib
import json
from pathlib import Path
import sys

API_COMMIT = "9fb80c915a9f5c7c172b382a37f4cfe942414430"
api = Path(sys.argv[1]).resolve()
modules = {
    "similarity_scoring.py": "630812370b20cf4c14ff97618efefdb1e02b3183",
    "review_triage.py": "2829f8046a76b8fe0264deaa60f3b0d5fdb7d21d",
    "channel_loss_sensitivity.py": "e04377f6c537f1316163dc0e0c278e85d9f1acd1",
}
hashes = {}
for name in modules:
    source = (api / name).read_bytes()
    blob = b"blob " + str(len(source)).encode() + b"\0" + source
    if hashlib.sha1(blob).hexdigest() != modules[name]:
        raise SystemExit(f"API source differs from pinned commit: {name}")
    hashes[name] = hashlib.sha256(source).hexdigest()

sys.path.insert(0, str(api))
from similarity_scoring import build_similarity_assessment
import review_triage
import channel_loss_sensitivity

composition = {
    "status": "COMPLETED_RESEARCH_ONLY",
    "comparisons": [{
        "reference_id": "synthetic-composition",
        "composition_signal_percent": 67.6,
        "measurement_confidence_percent": 99.6,
    }],
}
unscored_context = {
    "status": "COMPLETED_RESEARCH_ONLY",
    "comparisons": [{
        "reference_id": "synthetic-unscored-context",
        "status": "FAILED",
        "composition_signal_percent": 80,
        "measurement_confidence_percent": 90,
    }],
}
cases = []
for name, research, recording_usable, lyric_usable in [
    ("recording_no_match_with_composition", composition, True, False),
    ("recording_no_match_only", None, True, False),
    ("both_operational_no_match", None, True, True),
    ("recording_no_match_with_unscored_context", unscored_context, True, False),
    ("composition_only_without_operational_result", composition, False, False),
]:
    legacy = build_similarity_assessment(
        [], [], 0, "NO_CANDIDATE_IDENTIFIED", composition_analysis=research,
        recording_source_usable=recording_usable, lyric_source_usable=lyric_usable,
    )
    assessment = review_triage.apply_to_similarity(
        legacy, [], [], research, "NO_CANDIDATE_IDENTIFIED",
        recording_source_usable=recording_usable, lyric_source_usable=lyric_usable,
    )
    result = channel_loss_sensitivity.apply_to_similarity(assessment)
    # Keep the complete generated diagnostic and only its enclosing version
    # bindings. Exclude unrelated catalogue/provider descriptions and metadata.
    cases.append({"name": name, "similarity": {
        "method_version": result["method_version"],
        "disposition_method_version": result["disposition_method_version"],
        "review_triage": {"version": result["review_triage"]["version"]},
        "evidence_confidence": {
            "score_method_version": result["evidence_confidence"]["score_method_version"],
        },
        "channel_loss_sensitivity": result["channel_loss_sensitivity"],
    }})

print(json.dumps({
    "provenance": {
        "kind": "SYNTHETIC_OFFLINE_API_GENERATED",
        "api_commit": API_COMMIT,
        "source_sha256": hashes,
        "provider_requests_made": 0,
    },
    "cases": cases,
}, indent=2) + "\n", end="")
