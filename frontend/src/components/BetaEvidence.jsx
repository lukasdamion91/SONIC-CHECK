import { BETA_RELEASE_ID, BETA_CATALOGUE_RELEASE_ID, BETA_CATALOGUE_WORK_COUNT } from "@/constants/betaRelease.mjs";

export default function BetaEvidence({ result }) {
  const release = result?.beta_release;
  if (!release) return null;
  const hoel = result?.similarity_analysis?.hoel;
  const matches = release.release_id === BETA_RELEASE_ID
    && release.observed_catalogue_release_id === BETA_CATALOGUE_RELEASE_ID
    && release.observed_catalogue_work_count === BETA_CATALOGUE_WORK_COUNT
    && release.scope_matches === true && release.catalogue_binding_status === "MATCH";
  return <section aria-labelledby="beta-evidence-heading" className="mt-6 rounded-2xl border border-white/10 bg-[#202027] p-6 sm:p-8">
    <h2 id="beta-evidence-heading" className="text-xl font-semibold text-[#F0E9D6]">Beta evidence</h2>
    <p className="mt-3 text-sm text-[#F0E9D6]/70">{matches
      ? `${BETA_CATALOGUE_WORK_COUNT.toLocaleString("en-AU")} catalogue works were in scope. The 160 held additions are excluded.`
      : "This saved scan does not match the catalogue scope of this beta release."}</p>
    {hoel && <div className="mt-4 text-sm leading-6 text-[#F0E9D6]/70">
      <h3 className="font-medium text-[#F0E9D6]">HOEL evidence index</h3>
      <p>{hoel.aggregate_index === null ? "Unavailable for this catalogue: the required reliability validation is incomplete." : "The saved HOEL evidence requires a supported calibration record."}</p>
      <p className="mt-2 text-xs">An unavailable index is not measured zero or a clearance result.</p>
    </div>}
    <details className="mt-4 text-xs text-[#F0E9D6]/50"><summary className="cursor-pointer py-2">Saved release details</summary>
      <p className="mt-2 break-all">Release: {release.release_id}</p>
      <p className="mt-2 break-all">API revision: {release.api_commit_sha || "Unverified"}</p>
      <p className="mt-2 break-all">Catalogue: {release.observed_catalogue_release_id || "Unverified"}</p>
    </details>
  </section>;
}
