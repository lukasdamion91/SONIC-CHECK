# SONIC CHECK Delivery Workflow

Status: **living and normative**  
Governance revision: `SC-FOUNDER-OPS/2026-09-05.1`

This workflow implements [`../OPERATING_GUIDE.md`](../OPERATING_GUIDE.md) in
both canonical repositories. Historical V-series files are inputs to this
workflow, never substitutes for it.

## 1. Accept and define the finish line

Record the founder instruction verbatim or by stable reference. Translate it
into observable acceptance criteria, affected repositories, runtime entry
points, live surfaces and explicit non-goals. A task that requests integration,
merge or deployment includes those stages unless the founder narrows it.

Create a task evidence record with this schema:

| Field | Required content |
| --- | --- |
| Task | Stable identifier and founder instruction |
| Scope | Acceptance criteria and explicit exclusions |
| Repositories | Canonical repository and starting `main` SHA for each |
| Runtime path | Entry point, call chain and public/persisted projection |
| Provider evidence | Terms source, credential class, access basis and intended SDK/API |
| Gates | Provider, public-traffic and payment state before work |
| Cost | Expected paid calls or `0`; approval for material spend |
| Privacy | Private inputs and their non-deployment boundary |

## 2. Audit reality before editing

Fetch current canonical `main`, open PRs, failed runs, deployment identity and
live contracts. Search for the claimed feature from request through runtime,
serialization, frontend consumption and tests. Record contradictions
immediately. Existing code or research is not presumed wired, merged or live.

For paid capabilities, inventory each credential by capability without reading
or logging its value. A management/console token is not presumed to be an
analysis credential; an SDK licence is not presumed to configure production.

## 3. Plan the integration and gates

Identify the smallest complete vertical slice:

1. core implementation;
2. canonical runtime invocation;
3. fail-closed provider behavior and provenance;
4. additive API/persistence contract;
5. frontend use when user-visible;
6. unit, integration, provider-contract and regression tests;
7. artifact/image privacy verification; and
8. deployment plus live SHA/capability verification.

Provider activation and payment activation remain separate. Do not loosen an
unrequested gate to make a test pass.

## 4. Implement on review branches

Use one review branch per repository. Preserve compatibility unless the scope
explicitly changes it. Keep private audio, screenshots, contractual evidence,
provider responses and secret values out of commits and build contexts. Commit
only sanitized fixtures or attestations needed to verify public behavior.

An offline research module reaches `IMPLEMENTED`; it reaches
`RUNTIME_INTEGRATED` only when the canonical application flow invokes it and its
result survives the intended API, persistence or UI projection.

## 5. Exercise authorized providers truthfully

When provider use is in scope, perform the cheapest bounded call that proves
the required credential and endpoint. Record only sanitized metadata: provider,
SDK/client version, operation class, timestamp, outcome and non-secret request
identifier when permitted.

If a provider cannot be exercised, record `AUTHORIZED`, `CONFIGURED`,
`EXERCISED`, and `PRODUCTION_INTEGRATED` independently and stop the task at the
highest supported state. Synthetic tests may verify fallback logic; they do not
prove provider use.

## 6. Verify the exact candidate commits

Run the complete relevant suite plus focused tests. Verify:

- requested behavior and negative/fail-closed paths;
- analyzer identity and additive compatibility;
- provider and payment gates remain closed unless separately authorized;
- provider outage or abstention cannot become a false clean result;
- no private evidence or secret enters Git or the deployment artifact; and
- the closure/governance contract itself remains present.

Record commands, counts, outcomes, OS/runtime versions and exact commit SHAs.
Do not hide flaky, skipped or unrun checks.

## 7. Pull request and CI

Open a PR to canonical `main` in every affected repository. Complete the PR
template with runtime wiring, provider truth, gate snapshot, privacy result and
remaining work. Wait for every required check on the exact head SHA.

- Red or cancelled check: `FAILED`.
- Pending external check: `BLOCKED_EXTERNAL` or `PR_OPEN` as appropriate.
- All required checks green: `CI_GREEN`.

Do not merge on an untested replacement SHA.

## 8. Merge, deploy and verify production

Merge the reviewed head and record the merge SHA. Confirm the deploy job used
that SHA. A successful job reaches `DEPLOYED`, not
`PRODUCTION_VERIFIED`.

When a host is configured to deploy only after repository checks pass, a live
verifier that waits for that host must run after deployment and must not be a
required pre-deploy check; otherwise the verifier and host can wait on each
other. Validate that its exact SHA is on canonical `main` and has a successful
test run before executing code from that checkout.

Live verification must bind the web and API to exact deployed SHAs and check:

- canonical routes and analyzer identity;
- the promised V-series capability fields and method versions;
- expected provider readiness/provenance without leaking secrets;
- provider and payment gate states;
- fail-closed readiness and degraded behavior; and
- a source-bound candidate artifact/image privacy attestation plus a deployed
  application-root attestation, without claiming whole-container byte identity.

If a capability requires authenticated or paid traffic that is not authorized,
record the exact unverified acceptance criterion and do not claim `COMPLETE`.

## 9. Close with evidence

Use this final record. Every `N/A` needs a reason.

```text
Task:
Final state:
Acceptance criteria:

Web repository:
  PR / head SHA / merge SHA / deployed SHA:
  CI and deployment runs:

API repository:
  PR / head SHA / merge SHA / deployed SHA:
  CI and deployment runs:

Runtime wiring:
Provider authorization / configured / exercised / production-integrated:
Provider gate before / after:
Payment gate before / after:
Artifact or image privacy result:
Live probes:
Remaining limitations:
Correction to any earlier claim:
```

Only then may the work be called `COMPLETE`. Research that has passed its own
protocol but is not wired into the application is
`RESEARCH_CLOSED_NOT_RUNTIME_INTEGRATED`.
