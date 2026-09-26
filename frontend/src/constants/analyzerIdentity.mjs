// Build-owned display identity for the scanner analyser. Runtime API payloads
// must not override this value or relabel the SONIC CHECK interface.
export const ANALYZER_IDENTITY = "HARRY_V37";
export const ANALYZER_IDENTITY_REVISION = "soniccheck-harry-identity/1.3.0";
export const ANALYZER_CAPABILITY_MANIFEST_REVISION = "soniccheck-harry-v37-capabilities/1.0.0";
export const ANALYZER_CAPABILITY_MANIFEST_SHA256 = "19ba678b9b2ba351139e8d5ca4da2e0c344c4bc399c37d2f6826db768151e025";
// API main release binding; publishing requires the exact deployed revision
// and runtime projection to match this source-owned value.
export const ANALYZER_API_RELEASE_COMMIT = "ce07f0dd288a0a6ce0aac2c268315596d35d2c6e";

// Derived from the reviewed API source with runtime_privacy's canonical helper.
// Update alongside the API release binding; this is an application-root projection.
export const ANALYZER_API_RUNTIME_PROJECTION = Object.freeze({
  application_manifest_sha256: "57b7a544fc20c122715c5a2cae953ae7594fc9b54e96d2657a39e657f81e44a0",
  application_files_checked: 87,
  application_bytes_scanned: 2050053,
});
