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
