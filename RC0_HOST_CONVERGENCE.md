# RC-0 host convergence runbook

## Target state

| Host | Result |
| --- | --- |
| `soniccheck.io` | Canonical public landing, account entry, and `/app` product |
| `www.soniccheck.io` | Permanent edge redirect to the same path on `soniccheck.io` |
| `app.soniccheck.io` | Permanent edge redirect to `https://soniccheck.io/app` |
| `api.soniccheck.io` | Canonical private API; no change in this cutover |

This reduces the product to the requested two components: the public entrance and
the authenticated/subscriber application. The legacy Emergent application is not
a production surface after the cutover.

## Preconditions

1. Deploy the verified converged frontend artifact.
2. Attach and validate `soniccheck.io` as a custom domain on the production host.
3. Configure `REACT_APP_BACKEND_URL=https://api.soniccheck.io` and the production
   Clerk publishable key.
4. Confirm Clerk allows `https://soniccheck.io` and the API CORS and checkout
   origin lists contain the apex origin only.
5. Capture the current `www` and `app` DNS records so rollback is deterministic.

Do not remove the old records before the canonical apex build has passed the
smoke checks below.

## Cloudflare change set

The record names must be proxied so Cloudflare Redirect Rules execute.

1. Replace the current `www` origin record with a proxied `A` record pointing to
   `192.0.2.1`.
2. Replace the current `app` origin record with a proxied `A` record pointing to
   `192.0.2.1`.
3. Add a 301 Redirect Rule for `http.host eq "www.soniccheck.io"` with dynamic
   target `concat("https://soniccheck.io", http.request.uri.path)` and preserve
   the query string.
4. Add a 301 Redirect Rule for `http.host eq "app.soniccheck.io"` with static
   target `https://soniccheck.io/app` and preserve the query string.

The documentation address is reserved and is used only to give proxied hostnames
a harmless origin while the redirect executes at Cloudflare's edge.

## Acceptance checks

```bash
curl -fsS https://soniccheck.io/ >/dev/null
curl -fsS https://api.soniccheck.io/api/healthz
curl -sSI https://www.soniccheck.io/example?source=rc0
curl -sSI https://app.soniccheck.io/legacy?source=rc0
```

Expected results:

- Apex returns `200` and the current SONIC CHECK build.
- API health returns `200`.
- `www` returns one `301` whose `Location` is
  `https://soniccheck.io/example?source=rc0`.
- `app` returns one `301` whose `Location` is
  `https://soniccheck.io/app?source=rc0`.
- `/join` and `/login` render Clerk on the apex host.
- An unauthenticated visit to `/app` is sent to `/login`.
- An authenticated user without entitlement reaches billing but not scan/library.
- An entitled user can upload, inspect a scan result, and open the library.

## Rollback

Disable the two redirect rules, restore the recorded DNS values, and purge only
the affected hostnames from cache. Keep the apex deployment in place while the
failure is diagnosed.

## Verified current state — 21 August 2026

The encrypted, GET-only Cloudflare inventory now succeeds. It proves that:

- `www.soniccheck.io` has no DNS record, which explains the 502;
- `app.soniccheck.io` still points to the obsolete Emergent surface;
- the apex still points to the older proxied origin; and
- `api.soniccheck.io` correctly points to the Render API and is outside this
  routing change.

The GitHub Pages build now carries an exact commit marker, a canonical `CNAME`,
a byte-identical `404.html` SPA fallback, and an automated post-deployment probe.
The probe fails if a host merely returns 200 from the wrong build, if either
redirect is absent, or if `/api/readyz` remains 503.

Cloudflare authority is currently read-only. DNS records and Redirect Rules
therefore remain an explicitly blocked external change, not an unverified
application-code task. Do not alter API, MX, TXT or verification records during
the later authorised cutover.
