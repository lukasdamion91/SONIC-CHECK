// Build-owned display identity for the scanner analyser. Runtime API payloads
// must not override this value or relabel the SONIC CHECK interface.
export const ANALYZER_IDENTITY = "HARRY_V37";
export const ANALYZER_IDENTITY_REVISION = "soniccheck-harry-identity/1.3.0";
export const ANALYZER_CAPABILITY_MANIFEST_REVISION = "soniccheck-harry-v37-capabilities/1.0.0";
export const ANALYZER_CAPABILITY_MANIFEST_SHA256 = "19ba678b9b2ba351139e8d5ca4da2e0c344c4bc399c37d2f6826db768151e025";
// Exact founder-authorized six-function API merge. The deployment
// gate must verify this live commit and application-root projection before
// releasing the matching frontend. Stored historical identities are unchanged.
export const ANALYZER_API_RELEASE_COMMIT = "d8eef9753c11cfae1f1a552fb90d5032088a146a";

// Derived from the reviewed API source with runtime_privacy's canonical helper.
// Update alongside the API release binding; this is an application-root projection.
export const ANALYZER_API_RUNTIME_PROJECTION = Object.freeze({
  application_manifest_sha256: "e489f9c204c41e96eb578f2e60d9cb0c751fc0d9925c1a72710ca1eb636875c4",
  application_files_checked: 61,
  application_bytes_scanned: 1693907,
});
