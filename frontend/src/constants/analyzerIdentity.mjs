// Build-owned display identity for the scanner analyser. Runtime API payloads
// must not override this value or relabel the SONIC CHECK interface.
export const ANALYZER_IDENTITY = "HARRY_V37";
export const ANALYZER_IDENTITY_REVISION = "soniccheck-harry-identity/1.3.0";
export const ANALYZER_CAPABILITY_MANIFEST_REVISION = "soniccheck-harry-v37-capabilities/1.0.0";
export const ANALYZER_CAPABILITY_MANIFEST_SHA256 = "19ba678b9b2ba351139e8d5ca4da2e0c344c4bc399c37d2f6826db768151e025";
// V125 source and application-root projection verified on the canonical API.
export const ANALYZER_API_RELEASE_COMMIT = "6d73dc514dbde2fadcb022a27a3624e405d9622c";
export const ANALYZER_API_MUSICBRAINZ_REPLICATION_SEQUENCE = 189740;
export const ANALYZER_API_RUNTIME_PROJECTION = Object.freeze({
  "application_manifest_sha256": "d306ede795bdb34c4b66631f8de9d8c4e4eff1b49454db37d87d7d2e13681f00",
  "application_files_checked": 109,
  "application_bytes_scanned": 3481711
});
