# SONIC CHECK web

This repository contains the converged SONIC CHECK web experience for RC-0.
It intentionally exposes two product components on one canonical host:

1. A public landing and account-entry surface at `/`, `/join`, and `/login`.
2. The authenticated product under `/app`, with scan and library features gated
   by the entitlement returned by the canonical API.

The public verification route at `/verify/:badgeId` is the only intentional
shareable evidence surface outside authentication.

## Product contract

- Canonical web origin: `https://soniccheck.io`
- Canonical API origin: `https://api.soniccheck.io`
- Authentication: Clerk bearer tokens
- Pricing currency: AUD
- Plans: A$2.99 single screen, A$5.00 PDF add-on, A$18.99/month,
  A$149.99/year, and A$499.99/year enterprise
- Evidence boundary: results are candidate evidence for human review, not legal,
  plagiarism, infringement, or ownership determinations
- Catalogue boundary: the governed catalogue contains symbolic profiles and
  MusicBrainz identity/metadata context; it is not a claim that SONIC CHECK hosts
  71,000 licensed audio recordings

Pricing and launch state are fetched from the API at runtime. Paid checkout is
fail-closed until the API readiness contract explicitly enables it.

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

The top-level `backend/`, historical reports, and Emergent-era files are retained
temporarily as an archival prototype only. They are not part of the build or
deployment, the archived runtime fails closed unless explicitly enabled, and it
no longer creates a default administrator. The canonical production API is
maintained in the separate private API repository.

See [RC0_HOST_CONVERGENCE.md](RC0_HOST_CONVERGENCE.md) for the controlled DNS
cutover that retires the obsolete public host.
