import { compositionAnalysisView } from "@/lib/compositionPresentation.mjs";

const percent = (value) => value === null ? "Unavailable" : `${value}%`;
const count = (value) => value === null ? "Not recorded" : value;

function InputStatus({ input, label }) {
  if (!input) return null;
  return (
    <p className="mt-2 text-xs leading-5 text-[#F0E9D6]/70">
      {label}: {input.label}{input.reasons.length ? ` · ${input.reasons.join("; ")}` : ""}.
    </p>
  );
}

export default function CompositionAnalysis({ analysis }) {
  const view = compositionAnalysisView(analysis);
  return (
    <section aria-labelledby="composition-analysis-heading" data-testid="composition-analysis" className="mt-6 rounded-2xl border border-violet-300/20 bg-[#202027] p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="eyebrow">Musical feature evidence</div>
          <h2 id="composition-analysis-heading" className="mt-2 text-xl font-semibold text-[#F0E9D6]">Composition analysis</h2>
        </div>
        <span className={`rounded-lg border px-3 py-2 text-xs ${view.state === "compared" ? "border-violet-200/25 text-violet-100" : "border-amber-200/25 text-amber-100"}`}>{view.status}</span>
      </div>
      <p className="mt-4 text-sm leading-6 text-[#F0E9D6]/75">{view.reason}</p>
      <InputStatus input={view.queryInput} label="Submitted audio" />
      {view.durationSeconds !== null && <p className="mt-2 text-xs text-[#F0E9D6]/65">Analysed audio: {view.durationSeconds.toFixed(1)} seconds.</p>}

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [view.eligible !== null ? "Eligible references" : "Available entries (reported)", view.eligible ?? view.available],
          ["References considered", view.considered],
          ["Successful comparisons", view.successful],
          ["Unavailable references", view.unavailable],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-lg border border-white/10 bg-[#17171C] p-4">
            <dt className="text-xs leading-5 text-[#F0E9D6]/65">{label}</dt>
            <dd className="mt-2 text-lg font-mono-data text-[#F0E9D6]">{count(value)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs leading-5 text-[#F0E9D6]/70">
        {view.truncated ? "Bounded coverage: reference selection was truncated." : view.coverageReported ? "Coverage is limited to the selected, authorised references; the selected comparison queue was not truncated." : "Reference-selection coverage was not fully recorded."}
        {view.limit !== null ? ` At most ${view.limit} references can be selected per scan.` : ""}
        {view.insufficient !== null ? ` ${view.insufficient} reference signal${view.insufficient === 1 ? " was" : "s were"} insufficient for comparison.` : ""}
        {" "}This does not establish coverage of all music.
      </p>

      {view.comparisons.length > 0 && (
        <div className="mt-6 space-y-4">
          {view.comparisons.map((comparison) => (
            <article key={comparison.key} className="rounded-xl border border-white/10 bg-[#17171C] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="break-words font-semibold text-[#F0E9D6]">{comparison.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-[#F0E9D6]/65">{comparison.creator}{comparison.rightsBasis ? ` · ${comparison.rightsBasis}` : ""}</p>
                  <p className="mt-2 text-xs text-violet-100/85">{comparison.status}</p>
                </div>
                <div className="font-mono-data">
                  <div className="text-2xl text-[#F0E9D6]">{percent(comparison.signal)}</div>
                  <div className="mt-1 text-xs text-[#F0E9D6]/65">Feature agreement</div>
                </div>
              </div>
              {comparison.reason && <p className="mt-3 text-xs leading-5 text-[#F0E9D6]/70">{comparison.reason}</p>}
              <InputStatus input={comparison.queryInput} label="Submitted audio" />
              <InputStatus input={comparison.referenceInput} label="Reference audio" />
              <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {comparison.components.map((component) => (
                  <div key={component.key} className="rounded-lg bg-white/[0.035] p-3">
                    <dt className="text-xs leading-5 text-[#F0E9D6]/70">{component.label}</dt>
                    <dd className="mt-2 font-mono-data text-[#F0E9D6]">{percent(component.percent)}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 space-y-2 text-xs leading-5 text-[#F0E9D6]/65">
                <p>Dominant pitch-class contour is a proxy, not melody transcription. Coarse harmonic sequence describes broad feature changes, not identified song sections.</p>
                {comparison.shift !== null && <p>Reference-to-query alignment: shift reference pitch classes {comparison.shift === 0 ? "by 0 semitones" : `${comparison.shift > 0 ? "up" : "down"} ${Math.abs(comparison.shift)} semitone${Math.abs(comparison.shift) === 1 ? "" : "s"}`} to align with submitted audio.</p>}
                <p>Input measurement quality proxy: {percent(comparison.quality)}. This heuristic is not calibrated confidence in a match.</p>
                <p className="break-words">Source: {comparison.source}{comparison.origin ? ` · ${comparison.origin}` : ""}. Method: {comparison.method || view.method}.</p>
              </div>
            </article>
          ))}
        </div>
      )}
      {view.disclosure && <p className="mt-4 text-xs leading-5 text-[#F0E9D6]/70">{view.disclosure}</p>}
      <p className="mt-5 text-xs leading-5 text-amber-100/90">Research evidence for qualified human review. Feature agreement is not a probability of copying, ownership or infringement. No independently validated operational threshold is established.</p>
      <dl className="mt-5 grid gap-3 border-t border-white/10 pt-4 text-xs leading-5 sm:grid-cols-2">
        <div><dt className="text-[#F0E9D6]/65">Composition method</dt><dd className="break-all font-mono-data text-[#F0E9D6]/85">{view.method}</dd></div>
        <div><dt className="text-[#F0E9D6]/65">Reference manifest</dt><dd className="break-all font-mono-data text-[#F0E9D6]/85">{view.manifest}</dd></div>
      </dl>
    </section>
  );
}
