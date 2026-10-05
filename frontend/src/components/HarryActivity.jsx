import { useState } from "react";
import ResonanceSymbol from "@/components/ResonanceSymbol";
import { componentActivityView } from "@/lib/componentActivity.mjs";

export default function HarryActivity({ progress }) {
  const [paused, setPaused] = useState(false);
  const view = componentActivityView(progress);
  return (
    <div className="sc-harry-activity">
      <ResonanceSymbol colours={view.active.map(row => row.colour)} active={view.active.length > 0} paused={paused} />
      <div className="sc-harry-caption" role="status" aria-live="polite" aria-atomic="true">
        <h3>{view.label}</h3>
        <p>{view.detail}</p>
      </div>
      <details className="sc-component-details" open={view.reported || undefined}>
        <summary>Six HARRY components</summary>
        <ul className="sc-component-list" aria-label="HARRY component activity">
          {view.rows.map(row => (
            <li key={row.id} data-state={row.state}>
              <span className="sc-component-dot" style={{ "--component-colour": row.colour }} aria-hidden="true" />
              <span>{row.label}{row.reasonLabel && <small>{row.reasonLabel}</small>}</span>
              <span className="sc-component-status">{row.statusLabel}</span>
            </li>
          ))}
        </ul>
      </details>
      <button type="button" className="sc-motion-toggle" aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? "Resume gentle glow" : "Pause gentle glow"}</button>
      <span className="sc-reduced-motion-note">Reduced motion is enabled.</span>
    </div>
  );
}
