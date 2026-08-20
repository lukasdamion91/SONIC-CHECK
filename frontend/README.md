# SONIC CHECK frontend

React single-page application for the canonical SONIC CHECK public entrance and
authenticated subscriber product.

## Commands

```bash
npm ci --legacy-peer-deps
npm start
npm run validate:claims
npm run build
npm run verify
```

`npm run verify` validates public claim language before producing a production
build.

## Environment

Copy `.env.example` to `.env.local` for development. Production requires:

- `REACT_APP_BACKEND_URL=https://api.soniccheck.io`
- `REACT_APP_CLERK_PUBLISHABLE_KEY=<production publishable key>`

The API supplies the current product contract, pricing, catalogue status,
entitlement, and checkout readiness. The client does not independently enable
paid checkout.

## Routes

- Public: `/`, `/join`, `/login`, `/verify/:badgeId`
- Authenticated: `/app`, `/app/billing`, `/app/payment-success`
- Entitled: `/app/scan/new`, `/app/scans/:id`, `/app/library`
