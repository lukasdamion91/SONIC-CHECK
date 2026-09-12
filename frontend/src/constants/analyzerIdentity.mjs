// Build-owned display identity for the scanner analyser. Runtime API payloads
// must not override this value or relabel the SONIC CHECK interface.
export const ANALYZER_IDENTITY = "HARRY_V37";
export const ANALYZER_IDENTITY_REVISION = "soniccheck-harry-identity/1.3.0";
export const ANALYZER_CAPABILITY_MANIFEST_REVISION = "soniccheck-harry-v37-capabilities/1.0.0";
export const ANALYZER_CAPABILITY_MANIFEST_SHA256 = "19ba678b9b2ba351139e8d5ca4da2e0c344c4bc399c37d2f6826db768151e025";
// Exact locally tested commercial-shadow API candidate for founder review.
// This is not a claim that the candidate is merged or deployed. A reviewed
// release must bind its actual deployed commit and verify the same source tree.
export const ANALYZER_API_RELEASE_COMMIT = "3a789c90377e64ae224a8d7f218046b652ad2217";

// Derived from the reviewed API source with runtime_privacy's canonical helper.
// Update alongside the API release binding; this is an application-root projection.
export const ANALYZER_API_RUNTIME_PROJECTION = Object.freeze({
  application_manifest_sha256: "fe961373b2e347d91f44fc8f11cefd69df1b2e95f89bc67861989d6f7b04f3b8",
  application_files_checked: 54,
  application_bytes_scanned: 1625226,
});
