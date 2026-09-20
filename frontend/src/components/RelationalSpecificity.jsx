import { relationalScoreView } from "@/lib/relationalScorePresentation.mjs";

export default function RelationalSpecificity({ similarity }) {
  const view = relationalScoreView(similarity);
  if (!view) return null;
  return (
    <section aria-labelledby="relational-heading" data-testid="relational-specificity" className="mt-6 rounded-2xl border border-teal-300/20 bg-[#202027] p-6 sm:p-8">
      <div className="eyebrow">HARRY · weighted research analysis</div>
      <h2 id="relational-heading" className="mt-2 text-xl font-semibold text-[#F0E9D6]">Relational Specificity <span className="text-teal-200">10%</span></h2>
      {!view.valid ? <p role="alert" className="mt-4 text-sm text-amber-100">{view.reason}</p> : <>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-[#F0E9D6]/65">Checks whether harmony and rhythmic events stay linked in time beyond what disrupted relationships can explain. Alignment is fitted on separate blocks from those used to measure agreement.</p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Four-category aggregate for the selected candidate entity</caption>
            <thead className="text-xs text-[#F0E9D6]/50"><tr><th className="py-3">Category</th><th>Weight</th><th>Signal</th><th>Points</th></tr></thead>
            <tbody>{view.components.map((row) => <tr key={row.modality} className="border-t border-white/10">
              <th scope="row" className="py-3 font-normal text-[#F0E9D6]">{row.label}</th>
              <td className="text-[#F0E9D6]/65">{Math.round(row.base_weight * 100)}%</td>
              <td className="text-[#F0E9D6]/65">{row.checked ? `${row.signal_percent.toFixed(1)}%` : "Unscored"}</td>
              <td className="text-[#F0E9D6]/65">{row.checked ? row.weighted_signal_points.toFixed(2) : "—"}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className="mt-4 text-xs leading-5 text-[#F0E9D6]/55">Only evidence linked to the same eligible candidate is added. Unscored weight ({view.score.unscored_weight_percent}%) is not redistributed. This research index is not an accuracy or infringement probability.</p>
        <p className="mt-3 text-xs leading-5 text-[#F0E9D6]/45">{view.diagnostic.completed_comparisons} candidate comparison(s) measured, using up to 24 governed references and 127 disrupted controls per comparison. This category shares musical features with composition analysis. Timed lyric alignment is unavailable in this version.</p>
        <details className="mt-4 text-xs text-[#F0E9D6]/55"><summary className="cursor-pointer py-2">Measurement details and limits</summary>
          <p className="mt-2 leading-5">Whole-window relative timing, global key rotation and a bounded time offset are supported. Arbitrary excerpts and local tempo changes are not fully aligned. Real-world accuracy improvement has not yet been established. The six-feature inventory below describes the original three channels; this is the additional seventh analysis.</p>
          <p className="mt-2 break-words leading-5">Method: {view.diagnostic.method_version}</p>
        </details>
      </>}
    </section>
  );
}
