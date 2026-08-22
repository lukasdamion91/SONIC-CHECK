# SONIC CHECK authentication verification

Clerk is the only production identity provider. The obsolete seeded-password,
cookie-JWT registration and password-login paths are retired and must not be
reintroduced.

## Production acceptance path

Use a disposable test identity that you control. Do not place credentials,
verification codes, session tokens or Clerk secret keys in source control,
terminal history, screenshots or test artifacts.

1. Open `https://soniccheck.io/join` and create an account with email and a
   strong password.
2. Complete Clerk's email-code verification and confirm the browser lands on
   `https://soniccheck.io/app`.
3. Confirm the app can call `GET https://api.soniccheck.io/api/auth/me` with
   the Clerk bearer session and that no token appears in the URL.
4. Sign out and confirm a direct visit to `/app` redirects to `/login`.
5. Sign in again at `/login` and confirm the prior account reaches `/app`.
6. Exercise Clerk's forgotten-password email-code flow, set a new password,
   and confirm the previous password no longer works.
7. Confirm an unverified or expired session cannot access `/api/auth/me`.

## Non-secret public probes

These checks do not create an account or expose credentials:

```bash
curl -fsS https://clerk.soniccheck.io/.well-known/openid-configuration
curl -fsS https://clerk.soniccheck.io/.well-known/jwks.json
curl -i https://api.soniccheck.io/api/auth/me
```

The unauthenticated API request must return `401`. The OpenID discovery and
JWKS documents must remain available over HTTPS and agree with the issuer
configured by the private API.

## Administrator access

Administrator status is assigned only when Clerk reports a verified primary
email that is present in the private `ADMIN_EMAILS` deployment setting. There
is no default administrator password and no browser-supplied role claim.
