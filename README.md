# SONIC CHECK web

This repository contains the converged SONIC CHECK web experience for RC-0.
It intentionally exposes two product components on one canonical host:

1. A public landing, account-entry and customer-policy surface at `/`, `/join`,
   `/login`, `/privacy/`, and `/terms/`.
2. The authenticated product under `/app`, with scan and library features gated
   by the entitlement returned by the canonical API.

The public verification route at `/verify/:badgeId` is the only intentional
shareable evidence surface outside authentication.

## Product contract

- Canonical web origin: `https://soniccheck.io`
- Canonical API origin: `https://api.soniccheck.io`
- Authentication: Clerk bearer tokens; production Google provider configuration
  is checked through Clerk's public environment contract, with a separate
  end-to-end sign-in acceptance test required before release
- Pricing currency: AUD
- Plans: A$2.99 single screen, A$5.00 PDF add-on, A$18.99/month,
  A$149.99/year, and A$499.99/year enterprise
- Evidence boundary: results are candidate evidence for human review, not legal,
  plagiarism, infringement, or ownership determinations
- Catalogue boundary: the governed catalogue contains symbolic profiles and
  MusicBrainz identity/metadata context; it is not a claim that SONIC CHECK hosts
  71,000 licensed audio recordings

Pricing and launch state are fetched from the API at runtime. Payment gates
remain closed until a formal commercial licence is granted and reviewed. The
API's source-governed licence lock prevents deployment flags or an environment
claim of approval from opening checkout on their own.

## Local development

```bash
cd frontend
cp .env.example .env.local
npm ci --legacy-peer-deps
npm start
```

Required production variables are documented in `frontend/.env.example`.

Run the release checks with:

```bash
cd frontend
CI=true PUBLIC_URL= \
  REACT_APP_BACKEND_URL=https://api.soniccheck.io \
  npm run verify
```

## Deployment

`.github/workflows/static.yml` builds only `frontend/` and publishes a GitHub
Pages checkpoint preview. The production custom domain must serve the same
verified artifact with its Clerk publishable key configured.

The obsolete top-level `backend/` prototype was removed from active `main` on
27 August 2026 after its useful projection guards were recovered into the
canonical private API. Its exact pre-retirement source remains recoverable on
`archive/legacy-web-backend-20260827` and in Git history. See
[`operations/LEGACY_BACKEND_RETIREMENT_2026-08-27.md`](operations/LEGACY_BACKEND_RETIREMENT_2026-08-27.md)
for the complete blob inventory, extraction decisions and rollback anchor.

The canonical production API is maintained separately and was not removed or
replaced. See [RC0_HOST_CONVERGENCE.md](RC0_HOST_CONVERGENCE.md) for the host
cutover that retired the obsolete public application surface.
