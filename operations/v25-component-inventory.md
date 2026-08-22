# SONIC CHECK V25.1 — Component inventory and contract boundary

## Audit provenance and limitation

The web worktree was verified at the requested `main` baseline
`f4a0bd65637827c779a0357c27cb668f95a304b3` before this document was added. The
requested API baseline is `cc004bd3a203ba6e65ac7661308bb80791d2292e` in the
separate private `lukasdamion91/sonic-check-api` repository. That Git object is
not present in this checkout and the environment could not reach GitHub, so no
claim is made that the archived `backend/` directory represents that API
commit. V25.2 must begin by independently checking out and verifying the API
SHA. This is a release gate, not permission to substitute the archived backend.

## Classification

| Surface | Classification | Evidence and V25 disposition |
| --- | --- | --- |
| `frontend/src/App.js`, pages, navigation | **live** | Canonical SPA routes are `/`, `/login`, `/join`, and `/app/**`. Preserve PR17 redirects and `_redirects`. |
| `frontend/src/context/AuthContext.jsx` | **disconnected-ready** | Clerk React is wired and obtains bearer tokens; it calls `/auth/sync` and `/auth/me`. Production API contract must be verified before enabling beta. |
| `frontend/src/lib/api.js` | **live** | Axios points to `REACT_APP_BACKEND_URL`, defaulting to the canonical API, and attaches Clerk tokens. |
| `frontend/src/pages/{NewScan,ScanResult,Library}.jsx` | **disconnected-ready** | User journeys exist, but ownership, lifecycle, provenance, retention and deletion contracts are not yet certified end-to-end. |
| `frontend/src/pages/{Pricing,PaymentSuccess}.jsx` | **shadow-only** | UI exists, but public checkout and paid public traffic remain disabled. Do not expose until the V25.3 gate and a separate explicit approval. |
| `backend/` | **obsolete / offline reference** | Startup is deliberately blocked unless `LEGACY_PROTOTYPE_RUNTIME_ENABLED`; it uses legacy JWT/password auth, Emergent storage/payment adapters, synchronous analysis, and is not the private production API repository. Never deploy it as V25 API. |
| `backend/tests/` | **test-only (legacy)** | Targets the Emergent-era API and credentials. It is not V25 certification evidence. |
| `frontend/scripts/verify-pages-build.mjs` and claim checks | **live release tooling** | Verifies static Pages artifacts and public claims. |
| `scripts/cloudflare-*.mjs`, `operations/cloudflare-cutover-state.json` | **offline operational tooling** | Read-only inventory/canonical cutover utilities; only run with scoped credentials and explicit change intent. |
| V16R and failed retrieval candidates | **shadow-only** | Must not affect user-visible results or authoritative decisions. |
| 71,126 indexed records | **shadow-only evidence set** | Must be described as indexed, never registry-authorized, until the authority ledger discrepancy is resolved. |

## Import and dependency graph

```text
Browser
  -> index.js [React, React Query]
  -> App.js [React Router; canonical PR17 route table]
     -> AuthContext [@clerk/react]
        -> lib/api [axios + Clerk bearer token]
           -> https://api.soniccheck.io/api/* [separate private API]
     -> protected pages
        -> auth/sync + auth/me
        -> plans / regions
        -> scans/upload -> scans/:id -> scans/:id/report|audio|badge|delete
        -> library

GitHub Pages build -> public/CNAME + public/_redirects + public/_headers
Cloudflare tooling -> Cloudflare API (offline/operator-invoked)

Archived backend (must not be deployed):
FastAPI -> MongoDB (Motor)
        -> Emergent object storage
        -> Emergent Stripe adapter
        -> AcoustID/MusicBrainz; optional ACRCloud
        -> Genius; Emergent LLM
        -> ReportLab
```

There is no queue or microservice dependency in the approved V25 design.
Measure scan duration and concurrency before proposing either.

## Route and ownership contract

The canonical browser route remains `https://soniccheck.io/app`; legacy app-host
traffic converges there. API resources remain below
`https://api.soniccheck.io/api`. Every upload, scan, audio object, result and
report operation must derive its internal owner from the verified Clerk `sub`,
never from a client-supplied user identifier. Missing and foreign resources must
have indistinguishable `404` responses. Public badge routes must expose only the
documented safe projection and are not proof of copyright clearance.

V25 API evolution is additive: old web clients must continue to work while new
fields are introduced. Deploy and verify the API first, then deploy the web.

## Environment and external dependency map

| Runtime | Variable / dependency | Sensitivity | Gate |
| --- | --- | --- | --- |
| Web | `REACT_APP_CLERK_PUBLISHABLE_KEY` | public configuration | Required for beta auth; absence fails closed. |
| Web | `REACT_APP_BACKEND_URL` | public configuration | Must equal `https://api.soniccheck.io` in production. |
| Web build | `PUBLIC_URL` | public configuration | Must not alter the PR17 canonical route contract. |
| API | Clerk issuer/JWKS/audience configuration | secret/configuration | Verify signature, issuer, audience, expiry and stable `sub`; exact names must be inventoried in the API repo. |
| API | MongoDB connection/database | secret | Additive indexes/documents only; no destructive migration. |
| API | Stripe secret and webhook signing secret | secret | Checkout stays inaccessible to public traffic; event IDs must be unique/idempotent. |
| API | private object storage credentials | secret | Owner-scoped keys, non-public objects, verified physical deletion. |
| Analysis | catalogue/provider credentials | secret | Provider failure is `degraded`/`unavailable`, never a clean negative. |
| Operations | Cloudflare scoped tokens | secret | Never committed; operator-only scripts. |

No credential values belong in source, logs, reports, fixtures or release
artifacts.

## Cross-repository release gates

1. **V25.1 (this change):** freeze contracts, inventory, manifest and stop gates;
   no behavior or traffic changes.
2. **V25.2:** on the exact API baseline, verify Clerk JWTs and atomically map one
   internal user per Clerk `sub`; enforce owner predicates on every private read,
   update and delete. Deploy API before compatible web auth changes.
3. **V25.3:** persist entitlement independently of UI, deduplicate Stripe event
   IDs, reject ownership mismatches, and keep checkout behind the beta gate.
4. **V25.4:** private upload first; persist `created -> uploaded -> queued ->
   analysing -> completed|degraded|failed|deleted` transitions without adding a
   queue absent measurements.
5. **V25.5:** store catalogue version, pipeline version, provider status and
   evidence provenance. Shadow sources cannot influence the authoritative result.
6. **V25.6:** immutable/reproducible result projection, retention deadline,
   object deletion attempt and verification evidence; tombstone rather than
   silently claiming deletion.
7. **V25.7:** two-user isolation, webhook replay, provider outage, retention,
   deployment-truth and rollback tests. Record exact deployed SHAs in the
   manifest only after probes pass.

Each step is an independently reversible PR. Do not merge historical branches
wholesale. Stop for approval at any manifest stop condition.

## Rollback contract

Rollback is API-first-safe: retain backward-compatible fields and indexes, roll
the web back to its previously recorded SHA, then roll the API back only if the
old API remains compatible with data written by the new version. Never roll back
by deleting collections, fields, objects or Stripe events. A rollback drill must
exercise deployment of the prior artifacts, health/identity/ownership probes,
and restoration of the candidate without opening public traffic. V25.7 records
timestamps, actors, artifact SHAs and probe results.
