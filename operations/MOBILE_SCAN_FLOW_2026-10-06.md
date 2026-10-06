# Mobile scan flow — 6 October 2026

Status: IMPLEMENTED_IN_CANDIDATE. Local preparation only; not published or deployed.

## Founder instruction and scope

Replace the confusing intake heading with **AUDIO UPLOAD**, use mint and black,
list permitted audio formats, and present this mobile sequence:

1. Audio upload.
2. HARRY and Resonance.
3. Category results.
4. A prominent overall score using category weights.
5. A clearly visible PDF download.
6. What each category does and why it matters.

The Founder reaffirmed category analysis, weighted aggregation and reports as
foundational product requirements, with forensic certification as an explicit
development objective. This presentation change connects existing implemented
scoring/report paths; it does not establish certification or substitute UI
fixtures for measured analytical performance. Unverified capability and
performance remain work to finish, not a permanent research-only disposition.

Preparation continues PR71 against frontend main
`0f4d2f80db4e8e39854e74ae133a291547d81c3d`, following the earlier local candidate
tree `e913ecbe53932a3ca0ac602f81a4e8bae88684b7`. That earlier patch and its review
evidence remain preserved. The current direct Founder instruction requires
explicit personal approval before publication, merge or deployment, overriding
the broader repository delegation. This new instruction authorizes preparation;
it does not grant publication approval.

## Changes and behavior

- `NewScan.jsx` and `Product.css`: linear flow, clear intake wording, mint/black
  upload panel, explicit extensions, and collapsible optional lyrics/reference
  and region fields. Existing inputs, administration controls, entitlements,
  submission/recovery and owner-scoped polling are retained.
- `ScanResult.jsx`: uploaded-file summary, HARRY section, category results,
  aggregate, PDF, then explanations. Existing evidence, provider coverage and
  research diagnostics remain available below. Historical aggregates retain
  their original-method label rather than becoming six-category scores.
- `ScanResultsOverview.jsx`, `ScanResultsOverview.css` and
  `scanCategoryPresentation.mjs`: responsive category cards, fixed contributions,
  a prominent aggregate, PDF action and category explanations.
- Numeric presentation tests cover saved weighted results, zero vs unavailable,
  reserved weight, malformed/foreign-entity data and historical methods. Three
  existing source assertions were updated for renamed or moved presentation;
  their underlying upload limit, recovery and report checks remain intact.
- The existing aggregate validator now rejects null category rows without
  throwing. This prevents malformed stored data crashing the result page before
  the overview can show an unavailable state. Valid score rules are unchanged.
- Detailed comparison inputs are constrained to their grid width after browser
  checks found that long saved-record options caused mobile overflow.

Supported formats are WAV (`.wav`), AIFF (`.aiff`, `.aif`), FLAC (`.flac`), MP3
(`.mp3`) and M4A (`.m4a`), up to 100,000,000 bytes (100 MB). The existing accepted
file list and bounded decoder contract are unchanged. A listed extension alone
does not establish successful decoding.

The existing six-function weights are 18%, 18%, 24%, 10%, 15% and 15% for
recording identity, lyric overlap, composition similarity, relational
specificity, lyric order recovery and interval path specificity respectively.
The overview displays the backend aggregate only after the existing
`relationalScoreView` validates its version, arithmetic and candidate binding.
It neither averages unrelated provider scores nor redistributes missing weight.
Measured zero remains zero, including a valid checked-no-candidate aggregate.
Unavailable or invalid data receives no invented numeric score. Waiting states
remain visibly waiting. Four-category saved records retain their own weights.

The relocated PDF control calls the existing handler. It retains account and
owner scope, credit confirmation where applicable, result-envelope and PDF-byte
hash checks, in-flight/navigation guards, and a cached verified download so
saving the same prepared file again does not fetch another charged report.

## Effects and limits

No backend scoring weights, thresholds, scientific acceptance rules, catalogue,
provider, production configuration, credentials, payments or launch flags change.
No live provider is exercised and no new expenditure is incurred. Synthetic
review records and a synthetic PDF are local UI fixtures, labelled as such.
Actual authenticated production scanning, live provider results, actual backend
PDF generation and post-deployment verification remain NOT RUN for this revision.
Live component colours continue to require explicit server telemetry; the
interface does not infer component activity from a generic progress milestone.

Regression risks are responsive styling, result placement and download-action
integration. The numeric adapter is presentation-only and preserves stored
results. No certification, scientific accuracy or production-readiness claim is
made. The backend security correction remains a separate prepared candidate.

## Validation and next action

The initial full frontend run passed 308/311 tests; three assertions still
expected old display text/placement. After the corresponding presentation
assertions were updated, 318 tests passed. With the additional zero-with-no-candidate
and null-category cases, all 320 tests passed. Final build and browser results are
recorded in the accompanying exact-candidate review manifest; earlier failures
remain in the local review evidence.

The final optimized build, public-claims checks, routing and static-artifact
privacy checks passed. The final isolated build has one main JavaScript and one
main CSS bundle; an earlier accumulated local build is preserved separately.
Chromium checked awaiting, fully scored, partially scored, unscored and malformed
saved-result states at 320, 390, 768 and 1440 pixels: all 20 cases retained the
requested order with no document overflow or JavaScript errors. The initial
320-pixel overflow from long comparison options is retained as failed evidence.
Optional lyrics and the regional dropdown remained accessible; reduced motion
was respected. Against a labelled synthetic PDF, cancelling credit confirmation
prevented a fetch, confirmation produced an integrity-verified download, and
saving the cached file did not fetch a second report. This is browser integration
evidence with local fixtures, not a live backend or paid-provider exercise.

Founder review should cover the revised mobile previews and exact patch. After
explicit publication approval, obtain fresh hosted CI and retain all release
gates before seeking merge/deployment approval. Rollback for a future deployment
is an additive revert through the existing frontend workflow, with verification
of the resulting revision. Earlier source and evidence remain recoverable.
