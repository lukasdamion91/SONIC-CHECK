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

## Test Credentials
See `/app/memory/test_credentials.md`. Admin: `admin@soniccheck.io / Admin@Sonic2026`.

## Backlog (P0 / P1 / P2)

### P0 (next session)
- Real audio fingerprinting integration (ACRCloud / AudD / Pex API)
- PDF report export with signed timestamps for legal admissibility
- Email verification on registration

### P1
- Stem separation (vocals / instrumental) for finer-grained matching
- Bulk catalog scanning for label accounts
- Educational tier email verification (.edu)
- Real Spotify / YouTube reference database licensing path

### P2
- Forensic audit trail (immutable scan log)
- Producer collaboration / multi-user studio accounts
- API access for music attorneys & A&R teams
- Mobile-responsive optimizations + native app

## Notes
- MOCK plagiarism engine: deterministic — same input → same output. Reference catalog of 8 popular tracks. Not connected to any real audio fingerprint DB.
