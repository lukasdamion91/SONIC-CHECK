# SONIC CHECK

## SUPERSEDING FOUNDER GOVERNANCE & OPERATING STANDARD

**Governance ID:** `SC-FOUNDER-GOV/2026-09-11.1`
**Status:** **FOUNDER APPROVED — CONTROLLING PROJECT GOVERNANCE**
**Effective date:** 12 September 2026 — explicit Founder installation instruction
**Project:** SONIC CHECK / HARRY
**Founder authority:** Luke Damion
**Document character:** Controlling project governance under explicit Founder approval

---

# 1. PURPOSE

This document establishes the controlling governance framework for all work undertaken in relation to SONIC CHECK and its HARRY analyzer.

It is intended to ensure that development is conducted with complete operational candour, evidentiary integrity, founder control, preservation of research, accurate reporting, and an unambiguous separation between preparing work and authorising consequential action.

This governance is introduced following material failures in prior project execution, including instances of incomplete work being represented too broadly, research or implemented functionality not being converted into the requested operational capability, insufficient disclosure of inactive or shadow functionality, and inadequate distinction between technical restrictions and Founder-authorised restrictions.

The purpose of this document is corrective and prospective.

It does not rewrite historical evidence.

It establishes how SONIC CHECK must operate from this point forward.

---

# 2. GOVERNANCE HIERARCHY

Upon Founder approval, the following hierarchy applies to SONIC CHECK project operations:

### LEVEL 1 — DIRECT FOUNDER INSTRUCTION

An unmistakable current instruction from Luke Damion concerning SONIC CHECK is the highest project-level authority.

### LEVEL 2 — FOUNDER MANUAL REVIEW AND SPECIFIC APPROVAL

Any consequential change requiring application, publication, merging, deployment, activation, deletion, archival, configuration change, production modification, or expenditure requires the Founder to review the proposed action and expressly approve that specific action.

### LEVEL 3 — THIS GOVERNANCE STANDARD

`SC-FOUNDER-GOV/2026-09-11.1`

This document controls project execution unless subsequently amended or superseded by the Founder.

### LEVEL 4 — PROJECT OPERATING DOCUMENTS

This includes:

* `OPERATING_GUIDE.md`
* `docs/WORKFLOW.md`
* continuity guides;
* closure ledgers;
* launch ledgers;
* provider-governance records;
* research programmes;
* validation policies;
* release procedures; and
* repository-specific instructions.

These documents remain applicable only to the extent that they do not conflict with Levels 1–3.

### LEVEL 5 — HISTORICAL MATERIAL

Historical V-series documents, research reports, manifests, receipts, branches, PR descriptions, CI results, screenshots, previous instructions and earlier governance revisions remain evidence.

They do **not** independently grant current operational authority.

---

# 3. SUPERSESSION OF PREVIOUS AUTONOMOUS AUTHORITY

All previous general, continuing or blanket authority granted to ChatGPT, Codex, agents, connectors, automated workflows or other project collaborators to work autonomously through versions, merge work, publish changes, deploy changes, activate services or otherwise exercise consequential discretion is hereby **SUPERSEDED**.

Historical records documenting such authority remain historically accurate and must not be altered merely because the authority has subsequently been superseded.

However, those historical permissions cannot be relied upon as current authority.

There is no implied continuing authority arising from:

* previous autonomous-development instructions;
* previous permission to work through multiple V-series stages;
* previous merge authority;
* previous deployment authority;
* previous provider-integration authority;
* a successful test;
* a green CI result;
* a previously approved similar change;
* urgency;
* project objectives;
* Founder silence;
* an assumed preference;
* or the fact that a change appears technically beneficial.

**Current specific Founder approval governs.**

---

# 4. ABSOLUTE TRUTH AND TRANSPARENCY REQUIREMENT

All SONIC CHECK operations must be conducted with maximum factual accuracy and operational transparency.

No interaction or collaborator (human or AI)  may knowingly:

* fabricate progress;
* invent test results;
* claim a test was performed when it was not;
* claim a provider was exercised when it was not;
* claim functionality is integrated when it exists only as research or isolated code;
* claim code is merged when it exists only on a branch or pull request;
* claim a merge is deployed;
* claim a deployment is production-verified without actual verification;
* conceal a known failure;
* conceal unfinished work;
* silently narrow the Founder’s requested scope;
* misrepresent a technical limitation as Founder policy;
* invent licensing restrictions;
* exaggerate provider coverage;
* describe configured credentials as exercised capability;
* describe research evidence as production accuracy;
* or knowingly give the Founder a materially misleading impression of project readiness.

Where evidence is incomplete, the correct status is **UNKNOWN**, **UNVERIFIED**, **NOT RUN**, **PARTIAL**, or **BLOCKED**, as applicable.

Uncertainty must not be converted into certainty for convenience.

---

# 5. PROHIBITION ON DECEPTION, COERCION AND FABRICATED AUTHORITY

No project process or AI interactions may use deception, fabricated authority, selective disclosure or coercive framing to obtain Founder approval or to circumvent Founder review.

Recommendations may be made.

Risks may be explained.

Strong technical advice may be given.

However, the final project decision remains the Founder’s unless an action cannot lawfully, safely, technically or contractually be performed.

Where such a barrier exists, it must be identified precisely.

The existence of a barrier does not authorise unrelated work to be abandoned.

---

# 6. EXECUTION OBLIGATION

When the Founder directs a task, the objective is the **actual requested outcome**, not the earliest intermediate state that can plausibly be described as progress.

Work should therefore proceed through every technically available preparatory stage required to place the requested outcome before the Founder for review.

Documentation alone is not implementation.

Implementation alone is not runtime integration.

Runtime integration alone is not verification.

Verification alone is not Founder approval.

Founder approval alone is not deployment unless deployment was specifically approved.

A task must not be silently abandoned because an intermediate milestone has been reached.

If completion cannot presently be achieved, the task must remain visibly incomplete.

---

# 7. NO PUBLISHING OR DEPLOYMENT WITHOUT SPECIFIC FOUNDER APPROVAL

ChatGPT and associated project tooling have **no standing authority** under this governance to perform consequential release actions.

Without specific Founder approval following manual review, the following actions must not occur:

* merging a pull request into canonical `main`;
* pushing directly to protected or production branches;
* publishing a release;
* deploying to Render, Cloudflare or another production environment;
* changing production environment variables;
* activating or deactivating production providers;
* changing production DNS;
* opening public paid traffic;
* changing Stripe production behaviour;
* publishing customer-facing claims;
* deleting production resources;
* deleting repositories;
* deleting branches containing unique evidence;
* permanently archiving unique project material;
* altering provider licensing status;
* rotating or replacing production credentials unless specifically directed;
* changing authoritative scoring behaviour;
* activating new catalogue releases; or
* otherwise materially changing the live SONIC CHECK system.

---

# 8. FOUNDER REVIEW GATE

Before a consequential action is performed, the Founder must be given a review package containing, where applicable:

1. **Requested objective**
2. **Exact proposed change**
3. **Files affected**
4. **Practical effect**
5. **Scientific or analytical effect**
6. **Provider implications**
7. **Privacy implications**
8. **Financial implications**
9. **Tests actually performed**
10. **Tests not performed**
11. **Known failures**
12. **Known limitations**
13. **Regression risk**
14. **Rollback method**
15. **Exact candidate revision or diff**
16. **Recommended action**
17. **Explicit statement that Founder approval is required**

The correct terminal state before Founder approval is:

**READY FOR FOUNDER MANUAL REVIEW**

It is not:

**COMPLETE**

**DEPLOYED**

or

**PRODUCTION VERIFIED**

unless those states have actually occurred under separate Founder authority.

---

# 9. APPROVAL MUST BE SPECIFIC

Founder approval applies to the reviewed action.

Approval of one candidate does not automatically authorise a materially changed candidate.

If a proposed implementation materially changes after review because of:

* merge conflict;
* failed test;
* dependency change;
* provider change;
* configuration change;
* additional code;
* altered runtime behaviour;
* changed privacy implications;
* changed financial implications;
* or another substantive modification,

the revised implementation must return to the Founder for review.

Minor non-substantive evidence updates may be presented alongside the candidate but must not be used to disguise substantive changes.

---

# 10. STATUS VOCABULARY

SONIC CHECK must use precise operational states.

### `PROPOSED`

A change has been suggested but not authorised for implementation.

### `AUTHORISED_TO_PREPARE`

The Founder has authorised preparation or investigation but not consequential application.

### `IN_PROGRESS`

Work is actively being prepared.

### `IMPLEMENTED_IN_CANDIDATE`

The code or configuration exists in a candidate workspace, branch or proposed diff.

### `TESTED`

Specified tests have actually run against the identified candidate.

This does not imply all testing has passed.

### `TESTED_PASS`

The identified tests passed.

### `TESTED_FAIL`

One or more identified tests failed.

### `BLOCKED`

A concrete dependency prevents further progress.

The blocker must be identified.

### `READY_FOR_FOUNDER_MANUAL_REVIEW`

The candidate and evidence package are ready for Luke's inspection.

### `FOUNDER_APPROVED`

Luke has explicitly approved the identified action.

### `APPLIED`

The approved change has been applied to the specifically authorised destination.

### `MERGED`

The reviewed change exists on the identified canonical branch.

### `DEPLOYED`

The approved revision has been deployed to the identified environment.

### `PRODUCTION_VERIFIED`

The deployed revision and required behaviour have actually been verified in production.

### `COMPLETE`

Every applicable requirement of the Founder’s instruction has been satisfied and the closure evidence contains no undisclosed required work.

### `UNKNOWN`

Available evidence cannot establish the state.

**Unknown must remain unknown until evidence resolves it.**

---

# 11. FAILURE DISCLOSURE

Failures are evidence.

They must never be hidden, deleted merely because they are inconvenient, or retrospectively converted into successes.

A failed test must identify:

* what failed;
* when;
* against which revision;
* known or suspected cause;
* practical impact;
* corrective action;
* and whether the correction itself has been verified.

A later successful run may supersede the operational effect of a failure.

It does not erase the historical failure.

---

# 12. NO SILENT SUPPRESSION OF RESEARCH OR CAPABILITY

Research, diagnostics, algorithms, catalogues, provider integrations and experimental capabilities must not be silently disabled, suppressed, quarantined, archived or removed from the development trajectory.

Where a capability is:

* disabled;
* shadow-only;
* research-only;
* dormant;
* rejected;
* blocked;
* archived;
* superseded;
* excluded;
* or not production-integrated,

that state and its reason must be disclosed.

Where changing that state is proposed, the Founder must be informed of:

* what would become active;
* why it was inactive;
* evidence supporting activation;
* risks;
* expected benefit;
* and required safeguards.

No collaborator, ChatGPT or any AI may independently convert a Founder-directed capability into permanent research-only status merely because that collaborator considers such treatment preferable.

---

# 13. RESEARCH PRESERVATION

All material SONIC CHECK research should remain explicitly and easily recoverable.

This includes:

* V-series research;
* HARRY development;
* experimental methods;
* benchmarks;
* negative results;
* failed experiments;
* rejected challengers;
* raw non-sensitive evidence;
* validation receipts;
* manifests;
* test results;
* historical branches;
* catalogue research;
* provider evaluations;
* and methodological decisions.

Archiving must not be used as a euphemism for deletion.

Where archival is appropriate, the archive should preserve:

* source revision;
* provenance;
* reason for archival;
* relationship to successor work;
* recovery instructions;
* and integrity evidence where appropriate.

Unique evidence must not be permanently destroyed without specific Founder approval.

---

# 14. HISTORICAL INTEGRITY

Historical evidence can never be rewritten merely to make the project appear cleaner.

If a historical statement is subsequently discovered to be wrong, the preferred approach is an additive correction identifying:

* the original statement;
* why it was incorrect;
* the correct state;
* the evidence supporting the correction;
* and its practical consequence.

A correction must not falsely imply that the corrected knowledge existed at the earlier date.

---

# 15. PROVIDER AND COMMERCIAL CAPABILITY GOVERNANCE

For each external provider, the following facts must remain separate:

* `AUTHORISATION`
* `CREDENTIALS_PRESENT`
* `CONFIGURED`
* `RUNTIME_WIRED`
* `EXERCISED`
* `RESULT_RECEIVED`
* `PRODUCTION_INTEGRATED`
* `ACTIVE`
* `PAID_USE_AUTHORISED`

One state must not be inferred from another.

For example:

A credential being present does not prove the provider was called.

A successful provider call does not authorise production activation.

A commercial account does not automatically authorise every provider product.

A licence does not automatically authorise payment collection.

A provider being inactive must not be concealed from the Founder.

---

# 16. FUNDED CAPABILITY DISCLOSURE

Where the Founder has purchased, subscribed to or otherwise obtained access to a provider capability relevant to an authorised task, that capability must be considered explicitly.

If it is not used, the reason must be disclosed.

It must not be silently replaced with a weaker synthetic, free or local substitute while representing the task as equivalent.

A synthetic or local substitute may be used for development or testing where appropriate, but it must be labelled accordingly.

---

# 17. LICENSING AND RIGHTS

Licensing conclusions must be based on founder written confirmation.

The project must not invent additional licence restrictions.

Equally, it must not invent permission that does not exist.

Founder-supplied agreements, correspondence, screenshots, approvals and provider terms relevant to a task should be considered.

Where authority cannot be established, the correct state is:

**AUTHORITY UNVERIFIED**

rather than either presumed permission or presumed prohibition.

---

# 18. CATALOGUE GOVERNANCE

Catalogue records must distinguish:

* discovered material;
* candidate material;
* technically processed material;
* rights-reviewed material;
* culturally reviewed material;
* sealed material;
* indexed material;
* active production material.

A large source count must not be described as active scanner coverage unless those works are actually available through the production comparison path.

Similarly, legitimate approved catalogue material must not be excluded without an identifiable reason.

Any bulk exclusion or quarantine should maintain:

* member identities;
* reason codes;
* decision authority;
* policy version;
* date;
* evidence reference;
* and recovery/review procedure.

Unrecoverable exclusion authority is now superseded by the founder Luke Damion. 

---

# 19. SCIENTIFIC CLAIMS

SONIC CHECK is an evidence and candidate-review system.

Research metrics must be described according to what they actually measure.

No research result may be transformed into an unsupported claim of:

* legal infringement;
* plagiarism;
* originality;
* clearance;
* forensic certainty;
* universal detection;
* global catalogue coverage;
* or calibrated probability,

unless future evidence genuinely supports such a claim and its use has been separately authorised. 

Conduct and methodology when developing SONIC CHECK should be carried out with the ultimate end goal of becoming forensically certified.

This restriction protects the integrity of SONIC CHECK's work.

It must not be used as justification for concealing legitimate research findings or preventing continued development.

---

# 20. SECURITY AND PRIVACY

Raw customer audio, private corpora, provider secrets, access tokens, credentials, confidential agreements and identifying private evidence must not be placed in public repositories or public deployment artefacts.

Security protections must be maintained.

However, security must not be used as a vague explanation for unfinished work.

Where security prevents a requested action, the exact security issue and a viable compliant alternative should be identified and presented to Luke for approval.

---

# 21. FINANCIAL AUTHORITY

No new expenditure, subscription, paid provider run, plan increase, public checkout activation or financial commitment may be made without Founder approval.

Existing paid capabilities may be investigated and prepared for authorised use within their documented entitlement, but consequential paid execution must respect the Founder’s specific financial instructions.

Cost estimates should be disclosed before material expenditure.

---

# 22. NO DELETION OR ARCHIVAL WITHOUT DISCLOSURE

No unique SONIC CHECK research, branch, repository, dataset, catalogue, evidence package, workflow artefact or development record will be deliberately deleted or permanently archived without approval from the Founder where the action is consequential.

Before such an action, the Founder should be told:

* what is being affected;
* why;
* whether anything unique exists there;
* what has been migrated;
* where recovery will remain possible;
* and what would become unrecoverable.

---

# 23. BLOCKERS

A blocker must be concrete.

Valid blocker categories include:

* technical;
* external service;
* provider;
* licensing;
* privacy;
* security;
* platform permission;
* unavailable evidence;
* unavailable required data;
* or explicit Founder hold.

A blocker must not become a general excuse to stop unrelated work.

All independent portions of the authorised task should continue to the review-ready state where technically possible.

---

# 24. CORRECTION DUTY

If ChatGPT or another collaborator discovers that an earlier project statement was materially inaccurate, the error must be corrected.

The correction should state:

1. what was previously represented;
2. what the evidence now establishes;
3. why the discrepancy occurred if known;
4. what project decisions were affected;
5. whether remediation is required.

A correction must not be quietly buried in later documentation.

---

# 25. COMPLETION STANDARD

A SONIC CHECK task may be described as **COMPLETE** only when the requested scope has actually been completed.

If the Founder requested research only, research completion may be sufficient.

If the Founder requested integration, research completion is insufficient.

If the Founder requested a candidate for review, the task can end at `READY_FOR_FOUNDER_MANUAL_REVIEW`.

If the Founder separately authorises merge or deployment, those actions must actually occur before those respective states may be claimed.

No status may be inflated to create an appearance of greater progress.

---

# 26. HANDOFF REQUIREMENT

Every substantial development workstream should conclude with a concise truth-based handoff containing:

**Requested**

What Luke asked for.

**Delivered**

What was actually produced.

**Evidence**

Tests, files, revisions and observations supporting the delivery.

**Not delivered**

Anything requested but not completed.

**Failures**

Known failures and their status.

**Inactive functionality**

Relevant functionality remaining disabled, shadow, dormant or research-only.

**External dependencies**

Anything requiring another party or unavailable resource.

**Costs**

Any material cost incurred or anticipated.

**Recommended next action**

The technically preferred continuation.

**Founder decision required**

The precise consequential action awaiting Luke's approval.

---

#
