# Legacy web-repository backend retirement

Observed: 27 August 2026 (Australia/Melbourne)  
Posture: recoverable source retirement; no analyzer or paid-traffic activation

## Outcome

The obsolete top-level `backend/` tree is retired from the active web
repository after a complete Git-blob inventory and value comparison against
the canonical private API. It was already excluded from the web build and
deployment. Production analysis remains owned by `lukasdamion91/sonic-check-api`
at `https://api.soniccheck.io`.

Before removal, the exact web source state was anchored on
`archive/legacy-web-backend-20260827` at commit
`1e5871d6b76ccaa46a79179f1b261a6f87bad7ab`. Git history and the archive branch
retain every source, test and binary asset listed in the companion JSON
manifest, so recovery does not depend on memory or a mutable working directory.

## Extracted value

- `backend/acr.py` and `backend/pytest.ini` were already byte-identical to the
  canonical API copies.
- The useful scan-list contract was recovered into the canonical API as
  deterministic offline coverage: owner-scoped scan/library queries, lightweight
  list projections, no heavy evidence fields in lists, sanitized IDs, and full
  evidence retained on an owned detail read. This replaces the old live test's
  password credentials, seeded account and production data assumptions. The
  recovered guard merged through private API PR #30 at commit
  `ef64b9f46279b77ab0f02bdb748a065fac1411db` after Linux and Windows CI passed.
- Dashboard, scan upload, reports, private library, re-scan, badge and public
  verification capabilities were previously retained and hardened in the
  canonical frontend and API.

The remaining prototype modules are superseded. Its password/JWT gateway,
seeded administrator, legacy checkout plans, credentialed live fixtures,
LLM-generated originality percentage, and legal-verdict thresholds were
deliberately rejected because promoting them would weaken the current identity,
financial-safety and evidence-only boundaries.

## Verified retirement boundary

Fresh deployment truth for web commit
`1e5871d6b76ccaa46a79179f1b261a6f87bad7ab` passed the canonical landing,
login, join, policy and protected-app routes; API health; and permanent `www`
and legacy `app` redirects. `app.soniccheck.io` therefore cannot mint the old
session or begin legacy checkout. The source deletion cannot affect the
deployed frontend because the workflow builds only `frontend/`.

Public paid traffic remains disabled. No Checkout Session, live payment or
subscription was created to retire unreachable, non-deployed prototype source.
The live Stripe catalogue, Portal and webhook readiness have their own
sanitized closure record in the private API repository.

No analyzer, retrieval, similarity-scoring, threshold or catalogue runtime is
changed by this retirement. No legacy algorithm is promoted.
