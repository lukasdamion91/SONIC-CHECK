// Build-owned display identity for the scanner analyser. Runtime API payloads
// must not override this value or relabel the SONIC CHECK interface.
export const ANALYZER_IDENTITY = "HARRY_V37";
export const ANALYZER_IDENTITY_REVISION = "soniccheck-harry-identity/1.3.0";
export const ANALYZER_CAPABILITY_MANIFEST_REVISION = "soniccheck-harry-v37-capabilities/1.0.0";
export const ANALYZER_CAPABILITY_MANIFEST_SHA256 = "19ba678b9b2ba351139e8d5ca4da2e0c344c4bc399c37d2f6826db768151e025";
// Observed production API release and application-root projection, captured
// by read-only public probes on 2026-11-01. This is not a whole-image identity,
// security disposition, signed-in scan receipt or deployment approval.
export const ANALYZER_API_RELEASE_COMMIT = "c45d067436c23537649b2fb8ed2ea584ffd9270a";
export const ANALYZER_API_MUSICBRAINZ_REPLICATION_SEQUENCE = 189740;
export const ANALYZER_API_RUNTIME_PROJECTION = Object.freeze({
  "application_manifest_sha256": "456087801efa1861dcc72b7efa4626dbb2d315784d45f148cbc7a4331237df91",
  "application_files_checked": 108,
  "application_bytes_scanned": 3462443
});
