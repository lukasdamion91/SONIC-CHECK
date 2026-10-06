import { Download } from "lucide-react";
import { scanCategoryView } from "@/lib/scanCategoryPresentation.mjs";
import "@/ScanResultsOverview.css";

export default function ScanResultsOverview({ result = null, pending = false, reportControls, reportNote }) {
  const view = scanCategoryView(result, pending);
  const waiting = view.state === "waiting" || view.state === "processing";
  return (
    <div className="sc-scan-overview">
      <section className="sc-category-results" data-scan-section="categories" aria-labelledby="sc-category-heading">
        <div className="sc-product-overline">03 · Results</div>
        <h2 id="sc-category-heading">Category results</h2>
        <p className="sc-summary-note">{view.reason}</p>
        <div className="sc-category-grid">
          {view.rows.map(row => (
            <article className="sc-category-card" key={row.id} data-category={row.id} style={{ "--category-colour": row.colour }}>
              <div className="sc-category-title"><h3>{row.label}</h3><span>{row.weight == null ? "Weight unavailable" : `${Math.round(row.weight)}% weight`}</span></div>
              <div className="sc-category-signal">{row.checked ? <>{row.signal.toFixed(1)}<small>/100</small></> : <span>{waiting ? "Awaiting result" : "Not scored"}</span>}</div>
              {row.checked && <div className="sc-category-meter" role="meter" aria-label={`${row.label} signal`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={row.signal}><span style={{ width: `${row.signal}%` }} /></div>}
              <p>{row.checked ? `${row.points.toFixed(2)} weighted points` : waiting ? "Results appear after analysis." : "No eligible category contribution reported."}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="sc-overall-score" data-scan-section="aggregate" aria-labelledby="sc-overall-heading">
        <div className="sc-score-heading"><div><div className="sc-product-overline">04 · Weighted result</div><h2 id="sc-overall-heading">Overall aggregate score</h2></div>{view.methodLabel && <span className="sc-score-method">{view.methodLabel}</span>}</div>
        <div className={`sc-score-value${view.value == null ? " sc-score-empty" : ""}`} data-testid="weighted-aggregate-score">{view.value == null ? (waiting ? "Awaiting analysis" : "Score unavailable") : <>{view.value.toFixed(1)}<small>/100</small></>}</div>
        <p>Each category signal × its fixed weight. The weighted points are added together.</p>
        {view.coverage != null && <div className="sc-score-coverage"><strong>{Math.round(view.coverage)}% category-weight coverage</strong><span>{Math.round(view.unscored)}% unscored weight</span></div>}
        <p className="sc-score-limit">Unscored weight stays reserved. This evidence index is not a probability of accuracy or a legal conclusion.</p>
      </section>

      <section className="sc-report-download" data-scan-section="report" aria-labelledby="sc-report-heading">
        <div className="sc-product-overline">05 · Your report</div>
        <h2 id="sc-report-heading">PDF report</h2>
        <div className="sc-report-action">{reportControls || <button type="button" disabled><Download aria-hidden="true" />Download PDF report</button>}</div>
        <div className="sc-summary-note">{reportNote || "Your PDF report becomes available after your scan finishes."}</div>
      </section>

      <section className="sc-category-guide" data-scan-section="explanations" aria-labelledby="sc-category-guide-heading">
        <div className="sc-product-overline">06 · Understand your results</div>
        <h2 id="sc-category-guide-heading">What each category checks</h2>
        <div className="sc-guide-grid">{view.rows.map(row => <article key={row.id}>
          <h3><span style={{ backgroundColor: row.colour }} aria-hidden="true" />{row.label}</h3>
          <p>{row.description}</p><p><strong>Why it matters:</strong> {row.relevance}</p>
        </article>)}</div>
      </section>
    </div>
  );
}
