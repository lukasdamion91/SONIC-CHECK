// Build-owned display identity for the scanner analyser. Runtime API payloads
// must not override this value or relabel the SONIC CHECK interface.
export const ANALYZER_IDENTITY = "HARRY_V37";
export const ANALYZER_IDENTITY_REVISION = "soniccheck-harry-identity/1.3.0";
export const ANALYZER_CAPABILITY_MANIFEST_REVISION = "soniccheck-harry-v37-capabilities/1.0.0";
export const ANALYZER_CAPABILITY_MANIFEST_SHA256 = "19ba678b9b2ba351139e8d5ca4da2e0c344c4bc399c37d2f6826db768151e025";
// Exact merged V37 API verified live before this web release was prepared.
// The web workflow must verify this same commit again before deployment.
export const ANALYZER_API_RELEASE_COMMIT = "7679b35e99ee744df5b7c789b5fbfa9096934052";

// Derived from the reviewed API source with runtime_privacy's canonical helper.
// Update alongside the API release binding; this is an application-root projection.
export const ANALYZER_API_RUNTIME_PROJECTION = Object.freeze({
  application_manifest_sha256: "7be004d1c5b54aa35b3a8c0f7f424cbace8fa257771358f015e4ce336a42b4c4",
  application_files_checked: 54,
  application_bytes_scanned: 1606296,
});
