# Current SONIC CHECK acceptance standard

**SC-ACCEPTANCE-2026-09-22.1 — direct founder instruction, 22 September 2026.**

Independent adjudication is abolished and banned as a mandatory SONIC CHECK
standard. It must not be required for threshold selection, corpus admission,
held-out execution, HOEL validation, catalogue acceptance or launch readiness.
There is no minimum reviewer count, independent reviewer assignment, external
corpus audit, reviewer registry or signature quorum. These requirements must not
be reintroduced under another name or through an older protocol.

Owner, developer and automated evidence records are eligible. Record their actual
source and basis. A factual record still needs documented input identities,
permissions, labels and source lineage. A similarity score is not its own truth
label. Missing measurements remain missing; controlled fixtures remain controlled
fixtures. Reviewer identity or independence does not determine eligibility.

Calibration and held-out data must remain separate by source family and bytes.
Freeze the candidate, protocol, corpus and thresholds before held-out scoring.
Measure coverage, recall, false positives, retrieval, operational behaviour and
the complete product flow on the identified candidate. The existing numerical
targets are unchanged by this instruction. Distinct data families and distinct
physical origins are properties of evidence, not requirements for independent
people to adjudicate it.

Current API repository entry points are `validation_lab.harry_benchmark`,
`validation_lab.release_evidence`, `validation_lab.hoel_provenance_adapter` and
`validation_lab.catalogue_acceptance`. New benchmark runs default to
`validation/harry-benchmark/protocol-current.json`. The machine-readable policy is
`reference/acceptance_standard.current.json`.

The new corpus and HOEL admission modules supersede the corresponding proposed
modules in the saved R6 launch package. This integrates those admission controls
into the catalogue candidate; it does not integrate R6's separate experimental
interval algorithms or claim their calibration results on this candidate.

Historical V17–V25 contracts, dated protocols, sealed R6 packets and old receipts
retain their original bytes for replay. Their former human/independent review
requirements have no current acceptance authority. A historical replay result
must never be imported as a current launch blocker solely for that requirement.
The historical benchmark replay explicitly uses its captured evaluator.

This policy applies immediately to project work. The 23 September governance
revision delegates in-scope repository and deployment actions; evidence and
scientific gates still apply. Source integrity and retained historical results
do not imply live deployment.
