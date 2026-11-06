// Build-owned display identity for the scanner analyser. Runtime API payloads
// must not override this value or relabel the SONIC CHECK interface.
export const ANALYZER_IDENTITY = "HARRY_V37";
export const ANALYZER_IDENTITY_REVISION = "soniccheck-harry-identity/1.3.0";
export const ANALYZER_CAPABILITY_MANIFEST_REVISION = "soniccheck-harry-v37-capabilities/1.0.0";
export const ANALYZER_CAPABILITY_MANIFEST_SHA256 = "19ba678b9b2ba351139e8d5ca4da2e0c344c4bc399c37d2f6826db768151e025";
// Source label and application-root projection observed in the V90 image
// startup and layer inspection receipts from API Actions run 41621425822.
export const ANALYZER_API_RELEASE_COMMIT = "cf0a8eaac9e2cb130ee65c09ccf4891b5c22db40";
export const ANALYZER_API_MUSICBRAINZ_REPLICATION_SEQUENCE = 189740;
export const ANALYZER_API_RUNTIME_PROJECTION = Object.freeze({
  "application_manifest_sha256": "4ab8c2cf93cca70a6c31f35bd149ac5940a5e400ea556e44f9c0e9a70e20a0f2",
  "application_files_checked": 109,
  "application_bytes_scanned": 3471929
});
