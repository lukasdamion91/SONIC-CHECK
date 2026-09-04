# V17–V20 product hardening — 2026-09-01

Status: draft branch only; no deployment or production configuration change

Canonical public baseline: `3a91bb6e272c955c99349e3424924d47c7f5e2dd`

This public-client checkpoint makes the protected experience match the API's
evidence and entitlement truth. It does not activate a scanner, open checkout,
start paid traffic, approve a commercial licence or make a release claim.

## Access and identity

- Only the new-screen route requires a current scan entitlement. Authenticated
  owners can still read their dashboard, library and existing evidence records
  after a monthly allocation or one-time credit is exhausted.
- The UI consumes API-owned capability fields for scanning, reports, badges and
  retention. Explicit modern booleans override legacy plan/credit aliases.
- Sign-in redirects stay inside `/app`, and Clerk identity remains visible and
  usable for logout even during an API profile outage.

## Long-running scans

- Ordinary API calls retain a bounded outage timeout. The long upload operation
  uses a distinct lifecycle with a user-visible cancellation control.
- An owner-scoped UUIDv4 progress record can reconcile a lost upload response.
  Ambiguous completion remains in a bounded recovery state and directs the user
  to check owned records before any retry.
- Durable completion is accepted once, navigation is idempotent and the account
  capability projection refreshes after the debit.

## Evidence and report delivery

- Result pages distinguish recording identity, lyric overlap and composition
  comparison coverage, including not-submitted, searched-with-no-candidate and
  degraded states.
- Composition output discloses successful and selected comparison counts, the
  top-of-N scope and the absence of multiple-comparison adjustment.
- PDF delivery is checked against the exact FastAPI-normalized
  `{scan_id, result}` envelope using the `scan-result-envelope` scope, then
  checked again against the SHA-256 of the delivered PDF bytes. These are
  consistency checks, not authenticity or originality attestations.
- Report-credit warnings precede generation, account state refreshes after every
  credit-consuming attempt, and public badge publication is separated from
  best-effort clipboard copying. Owners can unpublish a public record.

## Commercial boundary

Public pricing, registration and checkout copy fail closed unless the API
confirms both a reviewed formal commercial licence and separate paid-traffic
authorization. Listed AUD prices and account creation do not imply that paid
checkout or paid screening is open.

## Verification boundary

The branch must pass the complete operational Node suite, public-claims
validation, a production-shaped static build, build-identity verification and
`git diff --check`. Pull-request builds cannot run the deployment job. Passing
these checks does not authorize a merge or deployment.

Verification performed on this checkpoint:

- operational contracts: 63 passed;
- public-claims validation: 23 deployed source files passed;
- production-shaped static build: compiled successfully;
- build identity, routing and auth marker: verified; and
- source diffs passed whitespace validation.
