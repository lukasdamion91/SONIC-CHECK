// Build-owned display identity for the scanner analyser. Runtime API payloads
// must not override this value or relabel the SONIC CHECK interface.
export const ANALYZER_IDENTITY = "HARRY_V36";
export const ANALYZER_IDENTITY_REVISION = "soniccheck-harry-identity/1.2.0";
export const ANALYZER_CAPABILITY_MANIFEST_REVISION = "soniccheck-harry-v36-capabilities/1.0.0";
export const ANALYZER_CAPABILITY_MANIFEST_SHA256 = "e594f8b3282de37e89ce7da853efde590e779b4db75dc59c6547944cf2fe8b6b";
// Candidate binding follows tested API main. Merge and deploy this web release
// only after its exact live API verification gate passes.
export const ANALYZER_API_RELEASE_COMMIT = "7f893bd5fc2958c8431e9e16741c88b93e8063ab";

// Derived from the reviewed API source with runtime_privacy's canonical helper.
// Update alongside the API release binding; this is an application-root projection.
export const ANALYZER_API_RUNTIME_PROJECTION = Object.freeze({
  application_manifest_sha256: "ad1f5682842383dcb0e9b365a85ed33b164dfdfad6c493fcbad5c2435036e290",
  application_files_checked: 52,
  application_bytes_scanned: 1527772,
});
