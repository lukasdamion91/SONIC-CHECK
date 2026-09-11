# Project-wide governance routing and installation boundary

Controlling authority: **SC-FOUNDER-GOV/2026-09-11.1**, in
[../GOVERNANCE.md](../GOVERNANCE.md). Founder installation approved
12 September 2026 (Australia/Melbourne). The source's 26 sections are unchanged;
only adoption metadata and UTF-8 LF line endings differ from the upload.
The separately proposed closing addendum was not adopted or inserted.

| Project surface | Governing entry point |
| --- | --- |
| Entire API/HARRY and frontend repository trees | Root AGENTS.md and GOVERNANCE.md |
| Operating procedures and delivery | OPERATING_GUIDE.md and docs/WORKFLOW.md |
| Human/AI review and GitHub tooling | .github/AGENTS.md, copilot-instructions.md and PR template |
| V-series research and scanner documentation | docs/scanner/AGENTS.md plus root authority |
| Executable research, ingestion and maintenance scripts | Root AGENTS.md applies recursively to retrieval_lab/, scripts/ and reference/ |
| Catalogues, provider permissions and exclusions | GOVERNANCE.md sections 12 and 15-18; actual changes require reviewed approval |
| Validation, holdouts, historical receipts and tests | validation/AGENTS.md plus root authority |
| Hosting, DNS, payments, recovery and release operations | operations/AGENTS.md plus sections 7-9, 20-23 |
| Historical evidence and legacy recovery work | Current root authority; historical bytes and outcomes are preserved |

The previous AGENTS, operating guide, workflow and PR template are copied
unchanged into operations/governance/predecessor/. They remain accessible
provenance, not current autonomous authority. Existing dated research records,
application code and provider settings are not rewritten by this installation.
Root governance applies even where adding a file inside an immutable runtime
or research directory would unnecessarily change its historical file inventory.

## Technical-enforcement boundary

Repository instructions and review templates are installed policy, not a
cryptographic or hosting permission barrier. This installation does not alter
Render automatic deployment settings, GitHub branch/environment protection,
Cloudflare permissions, provider credentials, runtime scoring, catalogue
activation, checkout or AI-platform/project settings. No application deployment
is authorised by this installation. Documentation commits carry [skip ci]
[skip render] [skip deploy] to avoid automatically releasing this change.

Automatic hosting/release settings and account-level enforcement require a
separately reviewed configuration change with verified effects. Old running
jobs, external clones, other conversations and tools that do not load these
files cannot be claimed updated merely because a repository was changed.
Report those limits explicitly. No completed forensic certification, recovered
historical rights evidence, scanner improvement or full CI pass is implied.

## Recovery and verification

The original upload is retained separately with SHA-256
b6436d633d29e11ce3f697a5f36536b8b2e79fdc1dec7c1d2f5dbdfb427183cb.
GOVERNANCE.md has SHA-256
d7312203dac1f02f772924ff28a363fa7c778426a75550fea44516cdc834cc64.
See operations/governance/ADOPTION.json. Check these against actual bytes and
record the resulting Git commit separately; a commit cannot contain its own
future identifier. Any rollback or later governance amendment requires Luke's
specific instruction. Do not delete predecessor evidence to perform a rollback.
