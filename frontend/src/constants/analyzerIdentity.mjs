// Build-owned display identity for the scanner analyser. Runtime API payloads
// must not override this value or relabel the SONIC CHECK interface.
export const ANALYZER_IDENTITY = "HARRY_V37";
export const ANALYZER_IDENTITY_REVISION = "soniccheck-harry-identity/1.3.0";
export const ANALYZER_CAPABILITY_MANIFEST_REVISION = "soniccheck-harry-v37-capabilities/1.0.0";
export const ANALYZER_CAPABILITY_MANIFEST_SHA256 = "19ba678b9b2ba351139e8d5ca4da2e0c344c4bc399c37d2f6826db768151e025";
// The deployed API still reports this retained release identifier. Its actual
// reviewed source/image is bound by the independently verified projection below;
// see HARRY_RESONANCE_RELEASE_2026-10-18.md for the publication-to-Render chain.
export const ANALYZER_API_RELEASE_COMMIT = "5d5352cb66369a9f4d6c9a0f6d0c70d6c1b88c36";

// PR112 source f77a74fc, reviewed image config 634b6b16, registry manifest 987f9e27.
// Matched to retained CI/publication artifacts and the live Render application root.
// This is an application-root projection, not a whole-container digest.
export const ANALYZER_API_RUNTIME_PROJECTION = Object.freeze({
  application_manifest_sha256: "0ef19ebdcae3c6ef39f530f9a08d6704af799577298c9f06b55e954a148c12d5",
  application_files_checked: 99,
  application_bytes_scanned: 2198842,
});
