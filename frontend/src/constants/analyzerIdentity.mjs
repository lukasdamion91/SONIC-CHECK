// Build-owned display identity for the scanner analyser. Runtime API payloads
// must not override this value or relabel the SONIC CHECK interface.
export const ANALYZER_IDENTITY = "HARRY_V37";
export const ANALYZER_IDENTITY_REVISION = "soniccheck-harry-identity/1.3.0";
export const ANALYZER_CAPABILITY_MANIFEST_REVISION = "soniccheck-harry-v37-capabilities/1.0.0";
export const ANALYZER_CAPABILITY_MANIFEST_SHA256 = "19ba678b9b2ba351139e8d5ca4da2e0c344c4bc399c37d2f6826db768151e025";
// API main release binding; publishing requires the exact deployed revision
// and runtime projection to match this source-owned value.
export const ANALYZER_API_RELEASE_COMMIT = "d8adeaeb6cf7d3b949b6a5c2aa0d8f0c9c7e5e39";

// Derived from the reviewed API source with runtime_privacy's canonical helper.
// Update alongside the API release binding; this is an application-root projection.
export const ANALYZER_API_RUNTIME_PROJECTION = Object.freeze({
  application_manifest_sha256: "a81050786934d0a299ce710eddc96bc911d47aface31af75c6283fca66829ebb",
  application_files_checked: 87,
  application_bytes_scanned: 2040431,
});
