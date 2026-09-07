# V36 zero-score projection repair

Task: SC-V36-ZERO-SCORE-2026-09-07. Founder instruction: “Please fix the issue”
following the investigation of the V36 channel-loss validation warning.

State at review-branch creation: IMPLEMENTED / RUNTIME_INTEGRATED. Final head,
CI, merge, deployment and live-verification evidence will be recorded in the PR
and delivery handoff; this document does not claim COMPLETE.

## Scope and acceptance

- Canonical web repository: SONIC-CHECK, starting main
  `dace8f1640b4821b2db38680a0ea6f842c7544b4`.
- Review branch: `fix/v36-zero-score-projection`.
- API: no change required. Fixtures are generated from the three source modules
  pinned to canonical API release `9fb80c915a9f5c7c172b382a37f4cfe942414430`.
- Accept V33/V36 numeric zero with no selected entity when an operational
  search remains usable, including retained unscored context. Preserve rejection
  of positive scores without an entity, fabricated availability, malformed
  projections and inconsistent summaries.
- Runtime: ScanResult -> currentAnalyzerDiagnosticViews ->
  channelLossSensitivityView -> baseline/scenario validEntityProjection.
  API serialization, persisted evidence, authoritative status and analyzer
  version are unchanged.
- No new scan, provider activation, payment activation or catalogue change.

## Root cause and verification

The API entity projector intentionally returns available=true, score=0 and
selected_entity_group_id=null when no eligible entity contributes but an
operational search completed. The web validator required an entity identifier
for every available score. This rejected both baseline no-match projections
and the composition-removal counterfactual when recording identity returned
no match. The generic warning identifies rejection, not the failing rule.

The correction accepts only zero/null with a usable operational channel. All
existing count, outcome, scope, version, scenario and summary reconciliation
continues to apply. It does not disable fail-closed suppression.

`frontend/scripts/generate-v36-api-fixtures.py` verifies pinned API Git blob
hashes before producing five synthetic cases. The generated fixture contains
the complete V36 output and its enclosing version bindings. It contains no
private scan, audio, provider response or credentials. It is outside the app
source/public build inputs.

Focused command:
`node --test scripts/v36-api-projections.test.mjs scripts/harry-v34-v36-presentation.test.mjs`
(from frontend): 16 tests passed during implementation.

Required release checks: public claims; full operational suite; production
build; routing/auth/deployment identity; artifact privacy; exact-head PR CI;
canonical merge, deploy and production truth probe.

## Provider, gate, cost and privacy truth

- AcoustID/MusicBrainz and ACRCloud are existing integrations. This repair only
  consumes their already-normalized channel outcomes. New credential or terms
  review, configuration, provider exercise: N/A for this presentation repair.
- Paid API calls: 0. Synthetic fixtures do not prove provider use or accuracy.
- Provider and payment gates: source-governed controls unchanged; no environment
  writes or checkout/public-traffic activation. Live gate state remains subject
  to the production probe, not inferred from unchanged source.
- Private evidence: excluded from this branch and its deployment inputs.
- Original private scan JSON was not inspected. The reproduced integration
  defect is confirmed; its exact historical payload is not independently proven.
- Correction to earlier wording: suppression followed its safety rule, but the
  rule incorrectly rejected a legitimate API state. Backend invalidity was not
  established by the warning alone.

## Delivery evidence

Pending: candidate head, full checks, PR, merge SHA, deployment and live probes.
The task must not be labelled COMPLETE until these applicable gates pass.
