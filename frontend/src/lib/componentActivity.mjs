// Same six colours approved for the landing-page Resonance sculpture.
// Only explicit component activity may select a colour in the live scanner.
export const COMPONENT_ACTIVITY_SCHEMA = "soniccheck-component-activity/1.0.0";
export const HARRY_COMPONENTS = Object.freeze([
  { id: "recording_identity", label: "Recording identity", colour: "#8defe4" },
  { id: "lyric_overlap", label: "Exact lyric overlap", colour: "#dfbd79" },
  { id: "composition_similarity", label: "Composition similarity", colour: "#9db8f0" },
  { id: "relational_specificity", label: "Relational Specificity", colour: "#a5edbc" },
  { id: "lyric_order_recovery", label: "Lyric Order Recovery", colour: "#d9a8e8" },
  { id: "interval_path_specificity", label: "Interval Path Specificity", colour: "#ff9fc7" },
].map(Object.freeze));

const STATES = new Set(["waiting", "running", "complete", "skipped", "unavailable", "error"]);
const REASONS = Object.freeze({
  not_submitted: "Input not submitted",
  no_reference: "No usable reference",
  not_configured: "Not configured",
  source_unavailable: "Source unavailable",
  analysis_failed: "Analysis stopped",
  cancelled: "Scan interrupted",
});

export function parseComponentActivity(data) {
  if (!data || data.schema_version !== COMPONENT_ACTIVITY_SCHEMA || !Number.isSafeInteger(data.revision) || data.revision < 0) return null;
  if (!Array.isArray(data.components) || data.components.length !== HARRY_COMPONENTS.length) return null;
  const rows = new Map();
  for (const row of data.components) {
    if (!row || !HARRY_COMPONENTS.some(component => component.id === row.id) || rows.has(row.id) || !STATES.has(row.state)) return null;
    if (row.reason != null && !Object.hasOwn(REASONS, row.reason)) return null;
    rows.set(row.id, { id: row.id, state: row.state, reason: row.reason || null });
  }
  return { revision: data.revision, components: HARRY_COMPONENTS.map(({ id }) => rows.get(id)) };
}

export function componentActivityView(progress = {}) {
  const activity = progress.componentActivity;
  const analysing = progress.phase === "analysing";
  const trustworthy = analysing && !["failed", "completed"].includes(progress.serverState) && activity && progress.componentTelemetryAvailable === true;
  const rows = HARRY_COMPONENTS.map(component => {
    const observed = trustworthy ? activity.components.find(row => row.id === component.id) : null;
    const state = observed?.state || "unreported";
    const labels = { waiting: "Waiting", running: "Running", complete: "Complete", skipped: "Skipped", unavailable: "Unavailable", error: "Error", unreported: "Not reported" };
    return { ...component, state, statusLabel: labels[state], reasonLabel: REASONS[observed?.reason] || null };
  });
  const active = rows.filter(row => row.state === "running");
  let label = "HARRY is ready";
  let detail = "Resonance represents HARRY. Component activity appears when your scan reports it.";
  if (["preparing", "uploading"].includes(progress.phase)) {
    label = progress.phase === "uploading" ? "Uploading your material" : "Preparing your material";
    detail = "HARRY component activity has not been reported yet.";
  } else if (analysing) {
    label = active.length ? active.map(row => row.label).join(" + ") : trustworthy ? "Waiting for the next pipeline step" : "Processing your submission";
    detail = active.length > 1 ? "These components are running in parallel, as reported by the server."
      : active.length === 1 ? "Current component reported by the server."
        : trustworthy ? "Completed components are listed below; none is currently reported as running."
          : "Live component detail is unavailable. HARRY is processing; no individual component is being inferred.";
  } else if (progress.phase === "complete") {
    label = "Analysis complete";
    detail = "Your evidence record is ready for review. Completion does not establish originality or clearance.";
  } else if (progress.phase === "error") {
    label = "Scan interrupted";
    detail = "Review the submission status before retrying. No component is shown as running.";
  }
  return { rows, active, label, detail, reported: Boolean(trustworthy) };
}
