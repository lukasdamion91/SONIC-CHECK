# SonicCheck — Product Requirements Document

## Original Problem Statement
> "I want to create a software program that combines the functionality of Turnitin, Shazam and the database of YouTube music and Spotify so recording artists and music producers can upload their work and check what percentage of it is plagiarised. It would virtually eliminate artists suing other artists, but it would need to respect the jurisdiction and regulatory requirements per region in regards to copyrighting and plagiarised material — as I assume that legally speaking a certain percentage of work is permitted to be as it's simply too difficult to be 100% original with music and lyrics. I want to market it exclusively to music industry and students of the industry."

## User Personas
1. **Recording Artist** — releasing original music, needs to validate originality pre-release.
2. **Music Producer** — high volume scanning, stem-level analysis, label/studio context.
3. **Music Student** — conservatory / production school, discounted academic tier.

## Architecture
- **Frontend**: React 19 + react-router-dom + Tailwind + Shadcn UI + axios with credentials.
- **Backend**: FastAPI + Motor (MongoDB) + bcrypt + PyJWT + emergentintegrations Stripe.
- **DB**: MongoDB collections — `users`, `scans`, `payment_transactions`.
- **Auth**: JWT in httpOnly cookies (samesite=none, secure=true).
- **Payments**: Stripe Checkout via emergentintegrations (test key `sk_test_emergent`).

## User Choices (initial discovery)
- Audio matching: **mock / simulated engine** with deterministic hash-based reference catalog.
- Upload types: **audio + lyrics + lyrics-only**.
- Auth: **JWT email/password**.
- Monetization: **Free + Stripe paid tiers** (Artist Pro $19, Producer Pro $49, Student $8).
- Jurisdiction: **region-selectable thresholds** (US, EU, UK, CA, AU, JP, IN, BR).

## Core Requirements
- Plagiarism analysis with overall score, lyric/melody/chord similarity, per-match breakdown.
- Region-aware verdicts (CLEAR / REVIEW / VIOLATION) based on local copyright doctrine.
- Free tier limit (3 lifetime scans) → upgrade gate.
- Visual report: waveform with flagged segments, per-match lyric snippets, confidence scores.

## What's Been Implemented (Feb 2026 — Initial MVP)
- ✅ JWT auth (register, login, logout, /me, region update) with admin seeding
- ✅ Mock plagiarism engine with deterministic seeded RNG and 8-track reference catalog
- ✅ 8-region jurisdiction database with doctrine + thresholds
- ✅ Scan CRUD (create with quota enforcement, list, get, delete)
- ✅ Stripe checkout sessions for 3 paid plans + payment status polling + webhook
- ✅ Free quota enforcement (3 scans) with upgrade redirect
- ✅ Dark Swiss/high-contrast UI with Cabinet Grotesk + Manrope + IBM Plex Mono
- ✅ Landing, Login, Register, Dashboard, NewScan, ScanResult, Pricing, PaymentSuccess pages
- ✅ Region selector on dashboard updates user profile
- ✅ Backend validation (lyrics OR audio required, region whitelist, plan whitelist)
- ✅ E2E testing passed (iteration_2 — 100% backend, 100% frontend)

## Iteration 3 (Feb 2026) — ACRCloud REAL Fingerprinting
- ✅ ACRCloud API integration (now FALLBACK only — see Iteration 5)

## Iteration 4 (Feb 2026) — UI Palette + Code Review
- ✅ Custom palette: charcoal grey, electric cobalt blue (#0047FF), fluorescent lime (#D4FF00), vanilla cream (#F0E9D6)
- ✅ Code review fixes (deps, React keys, lint)

## Iteration 5 (Jun 2026) — FREE API Stack Migration ($100 budget)
- ✅ Removed mock engine — real analysis pipeline in `run_analysis()` (server.py)
- ✅ Audio fingerprinting: Chromaprint `fpcalc` + AcoustID API (key in .env) + MusicBrainz metadata (`/app/backend/fingerprint.py`) — FREE
- ✅ Real waveform extraction via ffmpeg PCM RMS (60 bars)
- ✅ ACRCloud demoted to fallback (only when AcoustID finds nothing)
- ✅ Lyric candidates via Genius API search (`/app/backend/lyrics_free.py`) — page scraping is Cloudflare-403-blocked, candidates fall back to metadata-only (expected)
- ✅ AI semantic lyric similarity via Emergent LLM key, gpt-5.4 (`/app/backend/semantic.py`) — returns per-candidate similarity, snippets, originality score, summary
- ✅ Email verification: console-logged links (user chose free tier, no SMTP). Endpoints: POST /api/auth/verify-email, POST /api/auth/resend-verification. Frontend: /verify-email page + dashboard banner with resend
- ✅ .edu student eligibility: `student_eligible` on register; Student plan checkout gated (403 without .edu)
- ✅ E2E tested (iteration_5 — 19/19 backend, 100% frontend). Regression suite: /app/backend/tests/test_soniccheck.py

## Test Credentials
See `/app/memory/test_credentials.md`. Admin: `admin@soniccheck.io / Admin@Sonic2026`.

## Backlog (P0 / P1 / P2)

### P0 (next session)
- PDF report export with signed timestamps for legal admissibility

### P1
- Gmail SMTP email delivery (currently console-logged; needs user's Gmail app password)
- Stem separation (vocals / instrumental) for finer-grained matching
- Bulk catalog scanning for label accounts
- Real Spotify / YouTube reference database licensing path

### P2
- "Verified by SonicCheck" embeddable badge
- Forensic audit trail (immutable scan log)
- Producer collaboration / multi-user studio accounts
- API access for music attorneys & A&R teams
- Mobile-responsive optimizations + native app

## Notes
- BUDGET: strict $100 total — all analysis APIs are free (AcoustID, MusicBrainz, Genius, Emergent LLM key included with account). Stripe is only for ACCEPTING payments.
- Genius lyric page scraping returns 403 (Cloudflare) — handled; LLM compares using its own knowledge of candidate songs.
- LLM lyric scans take 15-60s per scan.
