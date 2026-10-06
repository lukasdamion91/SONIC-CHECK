# Repository cleanup — 6 October 2026

Damion Lukas authorized this maintenance cleanup following the repository audit.

The current product is a controlled beta using HARRY V37. Scientific certification and public paid-launch acceptance are not established by repository maintenance or passing CI.

## Changes

- Correct the frontend README's old HARRY V36 label to V37.
- Refresh repository navigation and distinguish current state from dated RC-0 records.
- Bind the frontend release gate to the retained reviewed API image's source and runtime projection, as already checked by the active feature candidate. The cleanup PR must pass its own build, privacy and exact API/beta checks before merge.
- Preserve merged branch histories under `archive/merged-branches-20261006` before removing routine merged refs. [Recovery manifest](MERGED_BRANCH_RECOVERY_2026-10-06.json).

Archive commit: `6cd492b104561c5bd47bf9a5afe79c1be195d673`. Every listed merged branch head is a parent of this archive-only commit. Restore a removed branch at its original manifest SHA. Existing research/review/recovery/archive refs and active PR71 remain intact.

## Active work

PR71 remains a draft. Its recorded build and API checks passed, but mobile/visual, reduced-motion and authenticated-transition acceptance are NOT RUN. The signed-in redesign is not part of this cleanup.

## Effects, gates and rollback

Main pushes automatically run the existing build, privacy and API gates, then deploy through GitHub Pages and verify production. The release binding update changes verification expectations; it adds no feature, provider call, payment activation, secret or scientific claim. No new expenditure is authorized. Before merge require passing build and exact API checks; after merge verify the workflow's deployment and production checks. Revert this cleanup commit to restore the previous documentation and binding. Branch restoration is independent and uses the preserved archive.
