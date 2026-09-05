# SONIC CHECK Operating Guide

Status: **living and normative**  
Governance revision: `SC-FOUNDER-OPS/2026-09-05.1`  
Product authority: **Luke Damion, Architect, Founder and Global Director**

This is the controlling operating standard for work in the canonical SONIC
CHECK web and API repositories. Dated V-series notes, research reports,
validation receipts, screenshots and historical manifests are evidence. They
do not, by themselves, prove the current production state and cannot override
this guide.

## Founder directive

A direct founder instruction authorizes completion of the stated task across
the canonical repositories and already-authorized deployment environments.
Collaborators must operate as accountable partners: no quiet operating model,
silent scope reduction, abandoned integration step, concealed failure, or
representation of partial work as complete.

The following are material truth failures:

- describing research evidence as application integration;
- describing local or branch code as merged;
- describing an open or failed pull request as closed;
- describing a merge as deployed;
- describing a deployment job as live verification;
- implying that a paid SDK, provider or token was used when it was not; and
- omitting known failures, skipped gates or residual work from a handoff.

If an earlier statement is discovered to be wrong, correct it and the affected
ledger promptly. Never defend or repeat a status that the evidence does not
support.

## Execution default and narrow escalation boundary

Execute every authorized, technically available part of a founder instruction.
Do not invent policy, licensing or ethics restrictions. A step may pause only
for a concrete ethical, licensing, legal, security, privacy, destructive-action,
platform-permission or technical barrier. State the exact barrier and evidence,
its smallest required resolution, and continue all independent work.

Founder-supplied screenshots, correspondence, contracts and terms must be
inspected when relevant and recorded in the task's licence evidence. Do not
ignore affirmative permission. If sources conflict, cite the exact conflict;
do not silently choose the more restrictive or permissive interpretation.

## Truthful delivery states

Every status report must name the highest state supported by evidence:

`ACCEPTED -> SCOPED -> IMPLEMENTED -> RUNTIME_INTEGRATED -> VERIFIED ->
PR_OPEN -> CI_GREEN -> MERGED -> DEPLOYED -> PRODUCTION_VERIFIED -> COMPLETE`

Applicable states cannot be skipped. A genuinely inapplicable state requires a
recorded `N/A` rationale. Cross-repository work cannot advance beyond the least
advanced required repository.

| State | Minimum evidence |
| --- | --- |
| `ACCEPTED` | Founder instruction and task identifier recorded |
| `SCOPED` | Acceptance criteria, repositories, runtime paths, provider/licence evidence and cost boundary identified |
| `IMPLEMENTED` | Required changes exist on an exact candidate commit |
| `RUNTIME_INTEGRATED` | The canonical application call path invokes the change; an offline module or document is insufficient |
| `VERIFIED` | Relevant tests pass on the exact candidate commit and configured operating systems |
| `PR_OPEN` | Pull-request URL, head SHA and target branch recorded |
| `CI_GREEN` | Every required check passes on that exact head SHA |
| `MERGED` | Canonical `main` contains the change; merge SHA recorded |
| `DEPLOYED` | The intended environment completed deployment from the recorded merge SHA |
| `PRODUCTION_VERIFIED` | Live SHA, behavior, analyzer identity, provider/payment gates and privacy boundary verified |
| `COMPLETE` | Closure record contains all applicable evidence and no required work is undisclosed |

Supporting research may be labelled `EVIDENCE_READY`. An explicitly
research-only task may end as `RESEARCH_CLOSED_NOT_RUNTIME_INTEGRATED`. Neither
status means product integration. A failure is `FAILED`; an external dependency
is `BLOCKED_EXTERNAL`. Both require the exact evidence, impact and next action.

The word **complete** is reserved for the terminal state above.

## Paid providers, SDKs and access tokens

At task start, inventory relevant already-funded capabilities and credential
classes. When the founder directs use of a commercial provider, SDK or token,
do not silently replace it with a free, local or synthetic substitute. If the
credential cannot perform the requested function, demonstrate the exact
provider boundary and identify the required credential or configuration.

Provider-backed completion requires evidence that:

1. the entitlement and applicable terms were reviewed;
2. secret presence and credential class were verified without revealing value;
3. the supported SDK or client is configured;
4. the canonical runtime path invokes it under an authorized access basis;
5. provenance, quotas, timeouts, retries and degraded states are handled;
6. provider failure cannot become a false clean result;
7. a bounded, sanitized provider contract or smoke test passed; and
8. production verification proves the promised capability is live.

`AUTHORIZED`, `CONFIGURED`, `EXERCISED`, and `PRODUCTION_INTEGRATED` are
separate facts. Record each separately; never infer one from another.

## Provider and payment gates

Provider availability, provider authorization, public analysis traffic and
payment authorization are independent gates. Preserve their fail-closed
behavior. Using an approved provider does not authorize checkout or paid public
traffic. No environment flag, token, deployment or research result may bypass a
source-governed commercial/payment lock or the formal approval it requires.

## Private evidence, audio and secrets

Raw audio, private corpora, provider payloads, access tokens, secret keys,
licence evidence, custody records, private receipts and identifying research
material must remain outside public Git history and deployment images.

Public repositories and images may contain application code, schemas, sanitized
synthetic fixtures and non-sensitive attestations. CI must inspect the final
deployment artifact or image context; source-directory intention alone is not
proof. Never print, copy or persist a secret value as evidence.

Credentials supplied through an approved secret store may be used within their
authorized scope. A credential value pasted into conversational, issue or
other durable text must be treated as exposed and rotated before production
use; that blocks only the affected credential, not independent delivery work.

Name the attestation scope exactly. A CI-built image archive proves that
source-bound candidate only. A live application-root scan proves the deployed
application filesystem only. Neither may be described as a byte-identical
whole-production-container digest unless the hosting provider supplies and the
workflow verifies that digest.

## Financial stewardship

Operate for maximum practical value on SONIC CHECK's shoestring budget. Use
already-funded capabilities when relevant and permitted. Prefer bounded tests,
batching, caching, reusable evidence, parallel independent checks and the
lowest-cost adequate execution path. Estimate and record material provider cost
before a paid bulk run. Do not purchase a service, increase a plan, open
checkout, or authorize paid public traffic without explicit founder authority.

Budget discipline is not permission to omit a required gate. If funding blocks
completion, report `BLOCKED_EXTERNAL` with the exact cost-dependent step.

## Required closure record

Every terminal delivery report must contain:

- requested scope and acceptance criteria;
- canonical repositories, branches, PR links and exact head/merge/deployed SHAs;
- runtime wiring path and public response contract;
- test commands, results and CI run links;
- provider/SDK authorization, configuration, exercise and integration evidence;
- payment and provider gate snapshot;
- deployment-artifact privacy result;
- live production probes; and
- every remaining limitation, or an explicit statement that none remain.

The executable sequence and evidence template are in
[`docs/WORKFLOW.md`](docs/WORKFLOW.md).
