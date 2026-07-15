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

## Iteration 6 (Jun 2026) — PDF Originality Report Export
- ✅ GET /api/scans/{id}/report — generates branded PDF via reportlab (`/app/backend/report.py`)
- ✅ Report contents: track/artist/scan ID, overall score + verdict, lyric/melody similarity vs regional limits, jurisdiction & doctrine assessment, fingerprint matches, AI lyric analysis + originality score, reference-match table, top-match snippet evidence, generation timestamp, SHA-256 integrity hash, legal disclaimer
- ✅ Gated to paid plans (402 for free tier, admin exempt) — matches "PDF reports" Artist Pro feature copy
- ✅ Frontend: "PDF report" button on ScanResult (data-testid='scan-download-report-btn') with blob download + upgrade toast on 402
- ✅ Fixed corrupted NewScan.jsx (duplicated trailing JSX broke build) + updated fingerprint copy to AcoustID/MusicBrainz
- ✅ Self-tested: curl (PDF headers/content via pypdf, 402 gate) + Playwright (button renders, download triggers, toast shows)

## Iteration 7 (Jun 2026) — File & Media Storage (Emergent Object Storage)
- ✅ `/app/backend/storage.py` — Emergent Object Storage client (init/put/get with 403 key-refresh retry), uses EMERGENT_LLM_KEY, $0 cost
- ✅ Paid-plan-only audio persistence (user chose option B): uploads stored at `soniccheck/uploads/{user_id}/{uuid}.{ext}`; free tier analyzes-and-discards
- ✅ Scan docs carry `audio_storage_path` + `audio_content_type`; `db.files` collection tracks records with `is_deleted` soft-delete (no storage delete API)
- ✅ GET /api/scans/{id}/audio — auth'd audio streaming (byte-identical retrieval verified)
- ✅ DELETE scan now soft-deletes the linked audio file record
- ✅ Frontend: blob-based audio player on ScanResult (data-testid='scan-audio-player') + Pro upsell note for free users (scan-audio-upsell)
- ✅ Self-tested: curl (upload→store→fetch→delete lifecycle, free-tier exclusion) + Playwright (player renders with blob src)
- ⚠️ NOTE: pod rebuild wiped apt packages — ffmpeg + libchromaprint-tools (fpcalc) had to be reinstalled. These are REQUIRED system deps for the audio engine.

## Iteration 8 (Jun 2026) — My Library (Audio Vault)
- ✅ GET /api/library — user's stored audio tracks (title, filename, size, verdict, score)
- ✅ POST /api/scans/{id}/rescan — re-analyzes stored audio (optionally new region), creates new scan sharing the same storage path, quota-enforced
- ✅ Delete safety: file record only soft-deleted when no other scan references the storage path
- ✅ Frontend: /library page (play/pause with blob cache, Report link, Re-scan button, Pro upsell empty-state for free users) + "Library" navbar link
- ✅ Self-tested: curl (library list, rescan to JP region, shared-path delete → audio still fetchable) + Playwright (cards render, playback active)

## Iteration 9 (Jun 2026) — "Verified by SonicCheck" Badge
- ✅ POST /api/scans/{id}/badge — creates public badge_id (Pro-gated, 402 for free tier; idempotent)
- ✅ PUBLIC endpoints (no auth): GET /api/verify/{badge_id} (record JSON) + GET /api/verify/{badge_id}/badge.svg (branded embeddable SVG with verdict color + score)
- ✅ Public page /verify/:badgeId — certificate-style verification record with badge preview + CTA back to SonicCheck
- ✅ ScanResult: "Verification badge" button + share panel (badge preview, public link, HTML embed, Markdown embed, copy buttons)
- ✅ Self-tested: curl (badge create, public verify, SVG, 404 invalid, 402 free-tier) + Playwright (public page no-auth, share panel renders)
- ⚠️ NOTE: search_replace phantom-write occurred again (CopyField helper edit reported success but didn't land; re-applied). Verify grep after ScanResult.jsx edits.
- 🎨 PENDING: user said they will upload a logo for branding — integrate into badge SVG, navbar, and PDF report when it arrives (check get_assets_tool).

## Iteration 10 (Jun 2026) — Logo Branding Integration
- ✅ User-uploaded logo (transparent PNG, holographic arcs + wordmark) processed into assets: /app/frontend/public/brand/{logo-full,logo-wordmark,logo-icon}.png, favicon-64.png, /app/backend/assets/logo-icon.png
- ✅ Navbar: icon + wordmark images replace old Radio glyph
- ✅ Badge SVG: base64-embedded logo icon, darker bg + holographic border, "SONIC CHECK" text
- ✅ Public verify page + footer CTA use logo icon
- ✅ PDF report header includes logo image
- ✅ index.html: title "SonicCheck — Music Plagiarism Checker" + favicon
- ✅ Self-tested: SVG contains base64 image, PDF page has 1 image, screenshot confirms navbar/verify/badge branding
- Original asset URL: https://customer-assets.emergentagent.com/job_cb2ca478-6fff-4497-8c51-f08057f9394d/artifacts/dlmrgylg_SONIC%20CHECK%20LOGO%201%20backgroundremove.PNG

## Iteration 11 (Jun 2026) — Landing Page Holographic Brand Polish
- ✅ index.css: holo utilities (.holo-gradient, .holo-text animated shimmer, .holo-bar with logo's signature center-line, .glow-holo), body radial glows + beam-card conic gradient shifted to holographic blue/purple
- ✅ Hero: full logo image (data-testid='landing-hero-logo'), holo bars framing it (mirrors logo lockup), holo underline under "lawsuit.", holo glow on sample-report card
- ✅ Section headlines: "music analysis." / "Different rules." / "blindfolded." in animated holo-text
- ✅ CTA panel: giant watermark logo arcs + holo bar
- ✅ Verified via screenshots (hero + CTA)

## Iteration 12 (Jun 2026) — Official Logo v2 (SONICCHECK OFFICIAL2.webp)
- ✅ Reprocessed all brand assets from the official white-bg logo (asset: xqq8tr7h_SONICCHECK%20OFFICIAL2.webp): whiteness-based alpha extraction, cream (#F0E9D6) recolor of dark text for dark-UI variant, holographic circles icon isolated (x1820-1959)
- ✅ Same file paths, no code changes: frontend /brand/{logo-full,logo-wordmark,logo-icon}.png + favicon-64.png (light variants), backend assets/{logo-icon,logo-full}.png (icon + dark original for PDF/white surfaces)
- ✅ Verified: navbar + hero screenshot, badge SVG base64 embed, PDF report image
- Logo asset URLs on record in get_assets_tool (3 artifacts)

## Iteration 13 (Jun 2026) — Code Review Fixes + Regression
- ✅ Valid fixes applied: tests/test_soniccheck.py reads ADMIN_EMAIL/ADMIN_PASSWORD from env; AuthContext.jsx rewritten with useCallback for all auth fns + useMemo'd provider value (prevents consumer re-renders)
- ✅ False positives verified & rejected: `is` vs `==` in server.py (none exist), "undefined vars" at server.py 615/804-806 (assigned in try with raising except), hook-dependency warnings citing module imports (`api`) and local vars, PaymentSuccess deps (correct as written)
- ⏭️ Deferred (stylistic, high regression risk on tested code): complexity refactors of ScanResult/NewScan/Library/build_pdf/create_scan — revisit only if these files need feature work
- ✅ testing_agent iteration_6: 15/15 backend, 9/9 frontend flows, 0 page errors — AuthContext rewrite regression-free

## Iteration 14 (Jun 2026) — Launch Prep: Domain + Live Stripe + Deploy Health
- ✅ FRONTEND_URL → https://soniccheck.io; verification links now origin-aware (register/resend use request Origin header, env fallback)
- ✅ Stripe: user's own account wired in — tested with their sk_test key (session + status verified), then swapped to LIVE key (sk_live, cs_live session creation verified). ⚠️ LIVE MODE: real charges, test cards won't work
- ✅ Deployment health checks: fixed GET /api/scans projection (light fields only; detail endpoint unchanged) + .gitignore .env patterns (recurred; now .env.local only) → deployment_agent PASS
- ✅ testing_agent iteration_7: 7/7 backend, 6/6 frontend — projection regression-free; new test file /app/backend/tests/test_scans_projection.py
- 🚀 DEPLOYED TO PRODUCTION: https://audio-plagiarism.emergent.host (user linking soniccheck.io via Cloudflare)
- NOTE: preview fixes after deployment require user to REDEPLOY to reach production

## Test Credentials
See `/app/memory/test_credentials.md`. Admin: `admin@soniccheck.io / Admin@Sonic2026`.

## Backlog (P0 / P1 / P2)

### P0 (next session)
- (none — PDF report export shipped in iteration 6)

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
