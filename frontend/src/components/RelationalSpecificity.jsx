import { relationalScoreView } from "@/lib/relationalScorePresentation.mjs";

export default function RelationalSpecificity({ similarity }) {
  const view = relationalScoreView(similarity);
  if (!view) return null;
  return (
    <section aria-labelledby="relational-heading" data-testid="relational-specificity" className="mt-6 rounded-2xl border border-teal-300/20 bg-[#202027] p-6 sm:p-8">
      <div className="eyebrow">HARRY · weighted research analysis</div>
      <h2 id="relational-heading" className="mt-2 text-xl font-semibold text-[#F0E9D6]">{view.six ? "Six functions. One candidate score." : "Relational Specificity · 10%"}</h2>
      {!view.valid ? <p role="alert" className="mt-4 text-sm text-amber-100">{view.reason}</p> : <>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-[#F0E9D6]/65">{view.six ? "Recording, words and musical structure each contribute a fixed share. The diagnostics below test whether ordered relationships carry evidence beyond disrupted controls." : "Checks whether harmony and rhythmic events stay linked in time beyond what disrupted relationships can explain. Alignment is fitted on separate blocks from those used to measure agreement."}</p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{view.six ? "Six" : "Four"}-category aggregate for the selected candidate entity</caption>
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
        {view.six && <div className="mt-6 grid gap-4 lg:grid-cols-3">{[view.diagnostic, ...view.additional].map((detail) => <article key={detail.method_version} className="rounded-xl border border-white/10 bg-black/10 p-4">
          <h3 className="font-medium text-[#F0E9D6]">{detail.label} <span className="text-teal-200">{detail.weight_percent}%</span></h3>
          <p className="mt-3 text-2xl text-[#F0E9D6]">{detail.selected_signal_percent == null ? "Unscored" : `${detail.selected_signal_percent.toFixed(1)}%`}</p>
          <p className="mt-2 text-xs leading-5 text-[#F0E9D6]/60">{detail.interpretation}</p>
          {Object.hasOwn(detail, "selected_rule_decision") && <p className="mt-2 text-xs text-teal-100/70">
            Selected interval rule: {detail.selected_rule_decision === true ? "Review signal" : detail.selected_rule_decision === false ? "Below the selected rule" : "Decision unavailable"}
          </p>}
          <p className="mt-3 text-xs text-teal-100/70">{detail.aggregate_contribution_points == null ? "Weight reserved" : `${detail.aggregate_contribution_points.toFixed(2)} / ${detail.weight_percent} points`} · {detail.completed_comparisons} comparison(s)</p>
          <details className="mt-3 text-xs text-[#F0E9D6]/50"><summary className="cursor-pointer py-2">Evidence and limits</summary>
            {detail.limitations?.map((limit) => <p className="mt-2 leading-5" key={limit}>{limit}</p>)}
            <p className="mt-3 break-words">{detail.method_version}</p>
          </details>
        </article>)}</div>}
        <p className="mt-3 text-xs leading-5 text-[#F0E9D6]/45">{view.diagnostic.completed_comparisons} candidate comparison(s) measured, using up to 24 governed references and 127 disrupted controls per comparison. This category shares musical features with composition analysis. Timed lyric alignment is unavailable in this version.</p>
        <details className="mt-4 text-xs text-[#F0E9D6]/55"><summary className="cursor-pointer py-2">Measurement details and limits</summary>
          <p className="mt-2 leading-5">Relational Specificity supports whole-window relative timing, global key rotation and a bounded time offset. Real-world accuracy improvement has not yet been established. The original feature inventory below describes measurements within the recording, lyric and composition channels; those measurements are not additional aggregate categories.</p>
          <p className="mt-2 break-words leading-5">Method: {view.diagnostic.method_version}</p>
        </details>
      </>}
    </section>
  );
}
