# Approved HARRY resonance integration

## Decision

On 18 October 2026 the Founder reviewed the blended-colour example and expressly
requested integration into the official site and immediate deployment. This
record covers that website identity change, its ordinary publication/CI/release
sequence, and the existing release checks. It does not authorise a new API
release, provider exercise, paid scan, payment activation or unrelated change.

## Candidate

Starting website revision: `a1e7e27d4d1926066fd9f7d01a33fa07a209fdce`.
Approved example SHA-256:
`1955ade99d18136112d37c91ab2e5773dca48c7ff312e37024e1205971aee831`.

One shared Canvas renderer supplies the metallic resting identity and the
fluorescent active identity. All nine active knots use variations of one
component hue, with smooth whole-object transitions. The approved geometry,
96% glow setting, eight-second breathing cycle and stopped rotation are retained.
Navigation, landing/footer, dashboard, scanner, results, verification heading
and favicon use the selected identity. Canvas fallbacks use the same geometry
and a single active colour family.

## Impact

The existing scan-progress and component-activity contracts supply state.
Preparing/uploading/analysis use the active identity; confirmed terminal states
return to metallic. Missing telemetry produces no component signals. Unknown
server outcomes remain labelled unknown. For parallel components, the first
reported component in the established presentation order supplies the shared
hue; explicit activity can illuminate paths for all reported running components.
Colour is a function indicator, not a similarity result or completion percentage.

The PR triggers the unchanged build and API-release workflow. A main-branch
merge can deploy GitHub Pages only after the existing gates pass. No workflow,
API release binding, scoring, entitlement, provider or payment logic is changed.

## Evidence

- PASS: public claims validation, 26 deployed source files.
- PASS: complete operational suite, 336 tests, zero failures or skips.
- PASS: production React build with the existing canonical API/auth settings.
- PASS: static routing, auth configuration and deployment-artifact privacy checks.
- PASS: native Canvas fallback rendering; the renderer is extracted from the
  reviewed tonal example, whose state selection and reduced-motion controls
  were checked against actual Canvas surfaces.
- NOT RUN: browser/device playback acceptance, signed-in scan execution and
  production verification of this candidate.
- BLOCKED: existing API application-root binding. The live API reports the
  expected release identifier `5d5352cb66369a9f4d6c9a0f6d0c70d6c1b88c36`, but
  its application-root fingerprint differs from the website's reviewed binding:

| Field | Website expectation | Live observation |
| --- | --- | --- |
| SHA-256 | `15ef6922a78de3493c58d9dad4070ff121fe8bf8093ed6cef97f1edf80c4323d` | `0ef19ebdcae3c6ef39f530f9a08d6704af799577298c9f06b55e954a148c12d5` |
| Files | 92 | 99 |
| Bytes | 2094147 | 2198842 |

A repeat of the existing API-only gate reproduced this mismatch. The first
probe also reported composition screening unavailable; the direct endpoint,
isolated composition check and repeated full API check subsequently passed.
The exact cause of that initial transient failure is UNKNOWN.

The initial colour-regression test incorrectly treated clipped metallic
highlights as source-hue evidence. Its first correction also excluded the
fully saturated lime reference colour. The test harness now measures the
unclipped coloured body/halos separately from reference hue; all three renderer
tests pass without changing the reviewed renderer. An intermediate diagnostic
command imported a nonexistent unused export and stopped before running; the
corrected command executed successfully. Patch application initially reported
extra blank lines at EOF; those were removed and `git diff --check` passes.
An early progress count of 244 counted only unindented result labels; 336 is the
verified final suite total, including nested cases and the new renderer tests.
The direct Git push could not authenticate because no Git username/credential
was configured in the shell. Publication therefore uses the connected GitHub
API; the failed push did not update the remote branch.

## Safeguards

Reduced-motion and pause controls stop animation; hidden/offscreen renderers
pause. Labels accompany colour. No customer audio or secrets are added to the
site artifact. The prior design and baseline remain recoverable in Git and the
earlier review package. Forensic certification remains an objective, not an
achieved status. The API fingerprint gate remains unchanged.

## Recommendation

Publish the approved website integration for CI and retain the result. Reconcile
the live API fingerprint with its actual reviewed/deployed image before merge
and deployment; do not copy the observed fingerprint into the binding merely
to make the gate pass. The Render connector currently has no selected workspace
and requires Founder identification of the workspace before service inspection.
This checkpoint is integrated and locally validated, not deployed.

## 18 October continuation: reviewed API projection reconciled

The Founder confirmed Render workspace `tea-d9gs02epbkes73c7ega0` (My Workspace,
info@soniccheck.io). Read-only inspection found API service
`srv-d9gsukbeo5us73cp5gd0` running deploy `dep-db8a9e6q1p3s73a5lnd0`, live since
15 October 2026 at 10:03:17 UTC. Its pinned registry image is
`ghcr.io/lukasdamion91/sonic-check-api-pr103-reviewed@sha256:987f9e276e28db658c12aa2a81bc6b4f78e2bdaf0724a2e7c83d24d3bb5a7696`.

The website's earlier binding predates that API deployment. The following
independent retained evidence establishes the replacement projection, rather
than accepting live values without provenance:

- API PR112 source `f77a74fc00802c264a1a0c9bf0d1c2c5a42c926c`, review
  `3b2743ac5f0426157aca7ef89e43274dfb205e36`, merged in
  `cfdd1ca052a5b6c0db9f03ea845d55e2a2f77039`.
- [Accepted Test run 38704574231](https://github.com/lukasdamion91/sonic-check-api/actions/runs/38704574231),
  attestation artifact `11958004645`, downloaded ZIP SHA-256
  `e00e342603920537e7bbb7eb3599b5c74fd8e65ed8850335f51044deb3442d54`.
  Its image privacy and startup receipts both bind application hash
  `0ef19ebdcae3c6ef39f530f9a08d6704af799577298c9f06b55e954a148c12d5`,
  99 files and 2,198,842 bytes to image config
  `634b6b16d955b62f59e1811076b18b8d7cb7bfdb749ff1e2578472a9efe30b35`.
- [Exact private publication run 38716762631](https://github.com/lukasdamion91/sonic-check-api/actions/runs/38716762631)
  completed successfully before the Render deployment. Artifact `11961929406`,
  downloaded ZIP SHA-256
  `36a272629da642ca37ed2d47adb189f0f653f4227b2cb6e5ab5f5d66be9ec73a`,
  records the same image config published and pulled by registry digest
  `987f9e276e28db658c12aa2a81bc6b4f78e2bdaf0724a2e7c83d24d3bb5a7696`.
  Direct comparison of the downloaded evidence confirms all 43 rootfs layer
  identities and the image configuration match; publication did not rebuild
  the image or change its source label. Its privacy replay matches the same
  application projection.
- The live Render image reference matches that publication receipt, and the
  public runtime-privacy endpoint matches that attested application projection.

Only the website's three expected projection values and explanatory comments
are corrected. The public API still reports the retained release identifier
`5d5352cb66369a9f4d6c9a0f6d0c70d6c1b88c36`; it is not represented here as the
newer image's source commit. Its existing equality check remains in force.
No Render service, image, environment variable, provider, payment gate or API
source is changed by this website release. This is the minimum binding
reconciliation needed for the already-authorised website deployment.

The initial hosted website run
[39100999832](https://github.com/lukasdamion91/SONIC-CHECK/actions/runs/39100999832)
remains FAILED: the build and 336 tests passed, the beta runtime/catalogue check
passed, and all 30 API-gate attempts rejected the stale projection. Deploy and
production verification were skipped. No comparison or acceptance gate is
removed or relaxed by the correction. The earlier blocked checkpoint above is
preserved as history; fresh checks on this corrected candidate are required.

Fresh local verification after reconciliation: all 130 deployment-contract
tests passed with zero failures/skips; the unchanged API-only release probe
passed on its first attempt. The initial full suite/build and hosted build
remain the visual integration evidence. The follow-up changes no renderer,
state handling or workflow; the required hosted full suite/build/API gates
will execute again on publication before merge/deployment.
