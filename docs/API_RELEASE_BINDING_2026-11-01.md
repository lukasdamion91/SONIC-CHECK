# Local API release-binding repair, 1 November 2026

This candidate follows the approved saved-diagnostics draft, without changing
that draft's six reviewed files. It is prepared locally and is not published,
merged or deployed.

The existing release probe expected the retained 5d5352c identifier, a 99-file
application projection and the former MusicBrainz WS/2 contract. Read-only
public observations now report c45d067436c23537649b2fb8ed2ea584ffd9270a,
PostgreSQL metadata enrichment at required replication sequence 189740, an off
development catalogue dispatcher and a 108-file application-root projection.
The old probe correctly failed; its expected release/contract had become stale.

This repair binds the observed release and projection:

| Field | Observed value |
|---|---|
| API commit | c45d067436c23537649b2fb8ed2ea584ffd9270a |
| Application manifest SHA-256 | 456087801efa1861dcc72b7efa4626dbb2d315784d45f148cbc7a4331237df91 |
| Application files | 108 |
| Application bytes | 3462443 |

The public non-secret provider snapshot is retained as a separately named
captured fixture. Both older fixtures retain their bytes. Exact top-level,
MusicBrainz and dispatcher field sets, source/sequence types and values, dormant
local search, provider shadow restrictions, unchanged scoring and closed paid
use/checkout gates are required. Extra/missing fields and active, inconsistent
or incorrectly typed states fail closed. No alternate deployment bypass or
fallback to the old source is added.

The all-API release probe passed at 2026-11-01T04:32:40.127Z using the repaired
candidate. All 383 frontend operational cases, production compilation, routing,
public-claims and static build-privacy checks passed locally. The local build
stamp is local-release-binding-repair with auth=false; this does not prove
production authentication. These checks include the approved saved-diagnostics
candidate as the baseline. Hosted application CI, browser visual QA, a signed-in
scan/PDF, publication, merge and deployment are not claimed.

The public version and projection are observations, not an independent
whole-container identity, fresh security disposition, scientific acceptance or
deployment authority. The separately prepared API source/image repair still
needs its own exact-source build and substantive review. That future API is a
different release; its actual source/projection must be rebound after it exists.
This pin must never be used as proof of a future deployment.

Proposed later publication creates a separate draft branch on the existing
frontend candidate and targets main so the existing PR build and read-only API
verification run once. Its diff includes the six approved presentation files
and these five repair files; the separate patch records only the repair. The
original draft remains unchanged. The PR deploy condition excludes production
deployment. The build has its existing default timeout; verify-api has a
15-minute limit and artifacts retain their existing 90-day policy. Compute and
storage cost are unknown. No automatic retry is proposed.

Merge, deployment and native worker installation/activation remain separate
actions. The current task's publication approval does not supply approval of
these changed release expectations or the proposed new CI run.
