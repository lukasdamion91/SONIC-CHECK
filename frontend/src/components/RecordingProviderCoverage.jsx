import { buildRecordingProviderCoverage } from "@/lib/providerCoveragePresentation.mjs";

export default function RecordingProviderCoverage({ result }) {
  const coverage = buildRecordingProviderCoverage(result);
  const audioSubmitted = result.scan_modes?.audio === true
    || result.evidence?.provenance?.audio?.submitted === true;
  if (!audioSubmitted) return null;
  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-[#202027] p-6 sm:p-8" aria-labelledby="recording-provider-coverage">
      <div className="eyebrow">Recording provider coverage</div>
      <h2 id="recording-provider-coverage" className="mt-2 text-xl font-semibold text-[#F0E9D6]">Which providers searched this audio</h2>
      <p className="mt-3 text-xs leading-5 text-[#F0E9D6]/55">{coverage.recorded ? `${coverage.summary}.` : "This saved scan has no per-provider execution record. Current account or configuration status does not establish which providers searched it."}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {coverage.rows.map((row) => (
          <article key={row.provider} className="rounded-xl border border-white/10 bg-[#17171C] p-5">
            <h3 className="font-semibold text-[#F0E9D6]">{row.provider}</h3>
            <p className={`mt-2 text-sm ${row.completed ? "text-sky-100" : "text-amber-100"}`}>{row.label}</p>
            <p className="mt-2 text-xs leading-5 text-[#F0E9D6]/55">{row.requestLabel}{row.completed && row.candidateCount != null ? ` · ${row.candidateCount} candidate${row.candidateCount === 1 ? "" : "s"}` : ""}</p>
            {row.reason && <p className="mt-2 text-xs leading-5 text-[#F0E9D6]/55">Reason: {row.reason}</p>}
            <p className="mt-2 text-xs leading-5 text-[#F0E9D6]/55">{row.authority}{row.mode ? ` · ${row.mode === "shadow" ? "Shadow execution" : "Disabled execution"}` : ""}</p>
            {row.sample && (
              <details className="mt-3 text-xs leading-5 text-[#F0E9D6]/55">
                <summary className="cursor-pointer">Audio sample provenance</summary>
                <p className="mt-2">Excerpt: {row.sample.startSeconds}s start · {row.sample.durationSeconds}s duration</p>
                <p className="mt-1 break-all font-mono-data">SHA-256: {row.sample.sha256}</p>
              </details>
            )}
          </article>
        ))}
      </div>
      <p className="mt-4 text-xs leading-5 text-[#F0E9D6]/48">Shadow execution can make real recognition requests. Commercial authorisation and shadow execution are separate states. Provider recording evidence does not establish composition similarity or recognition accuracy.</p>
    </section>
  );
}
