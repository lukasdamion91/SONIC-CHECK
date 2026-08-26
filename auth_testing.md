# SONIC CHECK authentication verification

Clerk is the only production identity provider. The obsolete seeded-password,
cookie-JWT registration and password-login paths are retired and must not be
reintroduced.

## Production acceptance path

Use a disposable test identity that you control. Do not place credentials,
verification codes, session tokens or Clerk secret keys in source control,
terminal history, screenshots or test artifacts.

The public deployment probe checks only Clerk's non-secret provider
configuration. It cannot prove the Google client secret, consent exchange,
callback or account synchronisation. The release is not accepted until this
end-to-end path has been executed and a sanitised acceptance record identifies
the deployed web commit, date, tester category and pass/fail result without
including account details, OAuth identifiers or tokens.

1. In Google Auth Platform, confirm the audience is **External**, publishing
   status is **In production**, the authorised domain is `soniccheck.io`, and
   the OAuth web client uses exactly Clerk's production redirect URI. A Google
   app left in **Testing** is not customer-ready even if a listed test user can
   sign in.
2. Confirm the requested scopes are exactly `openid`, `email` and `profile`,
   and the consent-screen homepage, privacy-policy and terms links resolve on
   the canonical domain.
3. Confirm `https://soniccheck.io/login` and `https://soniccheck.io/join` both
   show Google alongside the existing approved methods.
4. Open `https://soniccheck.io/join` with a Google account that is not listed as
   an OAuth test user, choose Google, grant only the basic
   identity scopes and confirm the browser lands on `https://soniccheck.io/app`.
5. Confirm the resulting account has the expected baseline entitlement and
   cannot bypass the `/app/scan/new` entitlement gate.
6. Confirm the app can call `POST https://api.soniccheck.io/api/auth/sync` and
   `GET https://api.soniccheck.io/api/auth/me` with the Clerk bearer session;
   both must return `200` and no token may appear in the URL.
7. Sign out and confirm a direct visit to `/app` redirects to `/login`, then use
   Google to sign in again and confirm the same internal account is returned.
8. For an existing email/password identity whose verified primary email exactly
   matches the Google identity, complete Clerk's account-linking flow and verify
   that no duplicate internal user, entitlement, library or scan ownership is
   created.
9. Use a separate Google identity and verify it receives a distinct internal
   account. A request for another account's private scan, audio, report,
   re-screen or delete route must return the same `404` as a missing resource.
10. Cancel Google consent once and confirm the browser returns safely to account
   entry without creating a privileged or partially linked SONIC CHECK account.
11. Open `https://soniccheck.io/join` and create a separate account with email
   and a strong password.
12. Complete Clerk's email-code verification and confirm the browser lands on
   `https://soniccheck.io/app`.
13. Confirm the app can call `GET https://api.soniccheck.io/api/auth/me` with
   the Clerk bearer session and that no token appears in the URL.
14. Sign out and confirm a direct visit to `/app` redirects to `/login`.
15. Sign in again at `/login` and confirm the prior account reaches `/app`.
16. Exercise Clerk's forgotten-password email-code flow, set a new password,
   and confirm the previous password no longer works.
17. Confirm an unverified or expired session cannot access `/api/auth/me`.

## Non-secret public probes

These checks do not create an account or expose credentials:

```bash
curl -fsS https://clerk.soniccheck.io/.well-known/openid-configuration
curl -fsS https://clerk.soniccheck.io/.well-known/jwks.json
curl -fsS https://clerk.soniccheck.io/v1/environment
curl -i https://api.soniccheck.io/api/auth/me
```

The unauthenticated API request must return `401`. The OpenID discovery and
JWKS documents must remain available over HTTPS and agree with the issuer
configured by the private API. The public Clerk environment must list
`oauth_google` as an identification strategy and first factor, and its sanitised
social-provider entry must be enabled, authenticatable and selectable. Never
copy the full environment response into a report; the deployment probe records
only the required booleans. This is a provider-configuration check, not an
end-to-end Google sign-in result.

Google's production client secret belongs only in the production Clerk social
connection. It must not be placed in the browser build, GitHub, Cloudflare,
Render, logs, screenshots or acceptance artifacts. Use only `openid`, `email`
and `profile`; Google One Tap is outside this acceptance scope.

## Administrator access

Administrator status is assigned only when Clerk reports a verified primary
email that is present in the private `ADMIN_EMAILS` deployment setting. There
is no default administrator password and no browser-supplied role claim.
