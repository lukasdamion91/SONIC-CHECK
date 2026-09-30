# Coordinated native, authentication and PDF custody release

API PR98 replaces the broad packaged fingerprint executable with the restricted
FFmpeg/Chromaprint runtime, upgrades PyJWT to 2.15.1 and displays complete input
hashes in PDFs. The current website binds the preceding API release, so this
change updates its source-owned API identity and application projection.

The selected API main is `b0460286059c80a664e15eec7b193f6f9d574c91`, squash-merged
from PR98 after full PR CI `36675097623` passed all 11 jobs. The tested merge
reference `b718c7e7b3413e92ebb238340e1b4113a3151cda` and reviewed head
`e7ab7bc9557f624278c2972a5a5201d5ee40a610` have identical tree
`a03be13b1cfc5d71caa15dc44981679d61e2486a`. Its runtime application projection is
`6e2687408556de56d7bacfdb56d96a3ec2b0bbeaa5559870927a907299677772`, 92 files and
2,093,988 bytes. The existing beta scientific evidence digest is unchanged.

Final PR image artifact `11080610910` was downloaded and verified against
SHA-256 `462f3d7d1e06ed8b5d0b56de0c8168e862b02dc4af0983c5e950222991880663`.
All 11 native fingerprint/duration equivalence cases passed. The actual image
completed six-format HTTP/MongoDB/S3 lifecycle checks, owner isolation,
retained-audio hashes, PDF generation, 100 MB acceptance, next-byte rejection
and two simultaneous 100 MB requests. Nine successes produced nine debits and
no disposable storage objects remained. Only CI authentication was replaced
with controlled actors; this does not establish production capacity or
scientific accuracy.

The inventory reports 205 findings across 90 CVEs: zero critical, 47 high,
58 medium, 90 low and 10 unknown. There are no reported PyJWT findings or
high/critical rows with a listed fix. Remaining findings and the custom-native
source inventory remain open. No zero-vulnerability or deployment-fitness
claim follows from this reduction.

API main CI `36676894060` passed all 11 jobs on the selected merged commit.
Main artifact `11080702452` was downloaded and hash-verified
(`59586adad0c3c0e9fe49c57b9c34747919b3bf11cf499375517660be7e51a22c`).
Its source revision and application projection exactly match this binding. All
11 oracle cases and the complete real storage lifecycle passed again; the
vulnerability inventory remained 205 findings / 90 CVEs with zero critical and
no PyJWT findings. The main image harness peak RSS was 731,460 KiB.

Render automatically deployed the selected commit as
`dep-dauan2bbc2fs73ce0ti0`, live at `2026-09-30T06:27:27.192699Z`. The first
post-deploy probe failed on required readiness at 06:27:52Z and is retained.
A subsequent readiness observation returned every required control true. The
unchanged exact source-bound verifier passed at `2026-09-30T06:29:13.223841Z`,
including the expected commit/projection, provider boundaries, self-tests,
routes and closed payments. No failing gate was disabled or relaxed.

Web PR/main CI must
also pass the unchanged exact-API, beta, build/privacy and production gates.

Local validation passed all 305 operational tests and public-claims validation
for 25 deployed files. This website change only updates three release-binding
values and this action record. Historical failed CI and prior release records
remain preserved.

The previous verified pair is API
`d4397f3ca5ca373d69b3ddaadfe156c87acce5e9` with website
`0296eca4653984addc3b3b6708e073487845840c`. Any rollback requires the paired
source-owned binding and a fresh verification of the selected state. The
30 September focused Founder instruction authorizes this coordinated release
after full CI. No provider setting, credential, permission, catalogue, payment
gate or commercial launch state changes here. The ten separate added
requirements remain OPEN in the canonical API acceptance register.
