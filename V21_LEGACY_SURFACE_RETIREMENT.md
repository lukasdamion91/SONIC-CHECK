# V21 legacy surface extraction and retirement

## Canonical two-component product

1. `https://soniccheck.io` serves the public landing page, `/join`, `/login` and the protected application below `/app`.
2. `https://api.soniccheck.io` remains the private application API and Stripe webhook authority.

`https://app.soniccheck.io` is the obsolete public application surface. It is not the API and must not be described or retired as `api.soniccheck.io`.

## Extraction decision

| Legacy capability | Current destination | Decision |
| --- | --- | --- |
| Dashboard and scan history | canonical `/app` plus private API `/api/scans` | retained |
| Audio upload and evidence screen | `/app/scan/new` plus entitlement-protected API | retained and hardened |
| Reports | `/api/scans/{id}/report` | retained with entitlement controls |
| Private library and re-scan | `/app/library` and private API | retained |
| Evidence badge and public verification | `/verify/{badgeId}` plus private API | retained |
| Password/JWT registration and login | none | rejected; Clerk is authoritative |
| Browser-defined checkout amounts | none | rejected; server Price IDs are authoritative |
| Wildcard credentialed CORS | none | rejected; apex origin only |
| Default seeded admin password | none | rejected; verified Clerk identity only |
| Legal-verdict thresholds/claims | none | rejected; candidate evidence for human review only |

The retained functions already exist in the current frontend and private API. Copying the obsolete authentication, checkout or claims code would weaken the release.

## Production observation on 21 August 2026

The live host probe still reports the pre-cutover topology:

- `soniccheck.io/` returns 200 with the old “Audio Similarity Intelligence” artifact and no deployment/auth identity markers;
- apex `/login`, `/join` and `/app` return 404;
- `www.soniccheck.io` returns 502;
- `app.soniccheck.io` returns its obsolete application with 200 instead of redirecting;
- `api.soniccheck.io/api/healthz` returns 200 while `/api/readyz` returns 503;
- Clerk OpenID discovery and its RS256 JWKS are reachable at `clerk.soniccheck.io` and agree with the configured issuer/JWKS URLs.

These are observed facts, not completed deployment actions. The source changes in V21 make a future production artifact fail CI if Clerk is absent, but DNS and host routing still require the approved Cloudflare/Pages cutover.

## Retirement gate

Do not remove or repoint the legacy host until all checks below pass against the same production commit:

- apex `/`, `/join`, `/login` and `/app` return the verified canonical artifact;
- the artifact reports Clerk configured and a real sign-up/sign-in/session path succeeds;
- API health and operational readiness pass;
- an authorised checkout, signed webhook and correct entitlement pass;
- `www.soniccheck.io/*` redirects permanently to the same apex path;
- `app.soniccheck.io/*` redirects permanently to `https://soniccheck.io/app` and cannot mint a legacy session or start legacy checkout.

The initial retirement action is a reversible host redirect. Source deletion follows only after an observed rollback window; Git history remains the recovery path.
