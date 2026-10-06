// Build-owned display identity for the scanner analyser. Runtime API payloads
// must not override this value or relabel the SONIC CHECK interface.
export const ANALYZER_IDENTITY = "HARRY_V37";
export const ANALYZER_IDENTITY_REVISION = "soniccheck-harry-identity/1.3.0";
export const ANALYZER_CAPABILITY_MANIFEST_REVISION = "soniccheck-harry-v37-capabilities/1.0.0";
export const ANALYZER_CAPABILITY_MANIFEST_SHA256 = "19ba678b9b2ba351139e8d5ca4da2e0c344c4bc399c37d2f6826db768151e025";
// API main release binding; publishing requires the exact deployed revision
// and runtime projection to match this source-owned value.
export const ANALYZER_API_RELEASE_COMMIT = "5d5352cb66369a9f4d6c9a0f6d0c70d6c1b88c36";

// Bound to the retained reviewed image and matched to its live application root.
// Update alongside the API release binding; this is an application-root projection.
export const ANALYZER_API_RUNTIME_PROJECTION = Object.freeze({
  application_manifest_sha256: "15ef6922a78de3493c58d9dad4070ff121fe8bf8093ed6cef97f1edf80c4323d",
  application_files_checked: 92,
  application_bytes_scanned: 2094147,
});
