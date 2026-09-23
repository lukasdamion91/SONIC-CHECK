import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, formatApiErrorDetail } from "@/lib/api";
import {
  RESEARCH_PAIR_LANES,
  buildResearchPairRequest,
  createResearchRequestId,
  diagnosticReasons,
  diagnosticText,
  researchLaneView,
  researchPairCapabilityView,
  researchRuntimeRows,
  verifyResearchHtmlReport,
  verifyResearchPairRecordIntegrity,
} from "@/lib/researchPairPresentation.mjs";

const inputClass = "h-10 w-full rounded-md border border-white/15 bg-[#17171C] px-3 text-sm text-[#F0E9D6]";
const buttonClass = "border-teal-200/20 bg-transparent text-teal-100 hover:bg-teal-200/10";

function requestMessage(error) {
  const detail = error?.response?.data?.detail;
  if (detail != null) return typeof detail === "object" && !Array.isArray(detail)
    ? [detail.message, detail.reason, ...(Array.isArray(detail.reason_codes) ? detail.reason_codes : [])].filter((item) => typeof item === "string").join(" · ") || formatApiErrorDetail(detail)
    : formatApiErrorDetail(detail);
  if (error?.code === "ECONNABORTED") return "The request timed out. Its server outcome is UNKNOWN until its request identifier is reconciled.";
  return error?.message || "The comparison service could not be reached.";
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Metrics({ rows }) {
  return <dl className="mt-4 grid gap-3 sm:grid-cols-2">{rows.map(([label, value]) => <div key={label}>
    <dt className="text-xs text-[#F0E9D6]/50">{label}</dt>
    <dd className="mt-1 break-words text-sm text-[#F0E9D6]/90">{value}</dd>
  </div>)}</dl>;
}

function LaneResult({ id, result, canonicalProfileSource }) {
  const view = researchLaneView(id, result, canonicalProfileSource);
  return <article className="rounded-xl border border-white/10 bg-[#17171C] p-5">
    <h3 className="font-medium text-[#F0E9D6]">{view.name}</h3>
    <p className="mt-2 break-words text-xs text-teal-100">{view.status}</p>
    {view.methodId && <p className="mt-1 break-all text-xs text-[#F0E9D6]/45">{view.methodId}</p>}
    {view.reasons.length > 0 && <p className="mt-2 break-words text-xs text-amber-100">{view.reasons.join(" · ")}</p>}
    {view.metrics.length > 0 && <Metrics rows={view.metrics} />}
    {view.components.map((component) => <div key={component.name} className="mt-4 rounded-lg border border-white/10 p-3">
      <h4 className="text-sm capitalize text-[#F0E9D6]">{component.name}</h4>
      <p className="mt-1 text-xs text-[#F0E9D6]/60">{component.status}</p>
      {component.reasons.length > 0 && <p className="mt-1 text-xs text-amber-100">{component.reasons.join(" · ")}</p>}
      <Metrics rows={component.metrics} />
    </div>)}
    {view.fragments?.length > 0 && <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[480px] text-left text-xs text-[#F0E9D6]/70">
      <caption className="mb-2 text-left">Selected passage intervals in canonical profile order</caption>
      <thead><tr>{["Fragment", "Matched atoms", "Normalized support", view.profileALabel, view.profileBLabel].map((label) => <th key={label} className="px-2 py-2">{label}</th>)}</tr></thead>
      <tbody>{view.fragments.map((fragment, index) => <tr key={index} className="border-t border-white/10">
        <th scope="row" className="px-2 py-2">{index + 1}</th><td className="px-2 py-2">{fragment.matchedAtoms}</td><td className="px-2 py-2">{fragment.normalisedSeconds} s</td><td className="px-2 py-2">{fragment.profileA}</td><td className="px-2 py-2">{fragment.profileB}</td>
      </tr>)}</tbody>
    </table></div>}
    {view.notes.map((note) => <p key={note} className="mt-4 text-xs leading-5 text-[#F0E9D6]/55">{note}</p>)}
  </article>;
}

// The parent keys this component by account and scan identity. Request generation
// also rejects late results after a reload or an unmount.
export default function ResearchPairDiagnostic({ scanId, ownedScans = [] }) {
  const [capability, setCapability] = useState(null);
  const [capabilityError, setCapabilityError] = useState("");
  const [capabilityLoading, setCapabilityLoading] = useState(true);
  const [researchRuntime, setResearchRuntime] = useState(null);
  const [runtimeError, setRuntimeError] = useState("");
  const [rightScanId, setRightScanId] = useState("");
  const [lanes, setLanes] = useState(RESEARCH_PAIR_LANES.map((lane) => lane.id));
  const [record, setRecord] = useState(null);
  const [savedRecordId, setSavedRecordId] = useState("");
  const [requestIdToReconcile, setRequestIdToReconcile] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const requestGeneration = useRef(0);
  const capabilityGeneration = useRef(0);
  const capabilityView = researchPairCapabilityView(capability);
  const selectableScans = ownedScans.filter((scan) => (
    typeof scan?.id === "string"
    && scan.id !== scanId
    && scan.private_audio_available_for_diagnostic !== false
  ));

  const refreshCapability = useCallback(async () => {
    const generation = ++capabilityGeneration.current;
    setCapabilityLoading(true);
    setCapabilityError("");
    setCapability(null);
    setRuntimeError("");
    setResearchRuntime(null);
    try {
      const pairResponse = await api.get("/capabilities/mda2-pairwise");
      if (capabilityGeneration.current !== generation) return;
      setCapability(pairResponse.data);
      const view = researchPairCapabilityView(pairResponse.data);
      if (view.researchVisibilityAllowed) {
        try {
          const runtimeResponse = await api.get("/capabilities/research-continuation");
          if (capabilityGeneration.current === generation) setResearchRuntime(runtimeResponse.data);
        } catch (runtimeFailure) {
          if (capabilityGeneration.current === generation) setRuntimeError(runtimeFailure?.response?.status === 404
            ? "This deployment does not expose the administrator research-continuation endpoint. V-series modes remain UNKNOWN."
            : requestMessage(runtimeFailure));
        }
      }
    } catch (pairFailure) {
      if (capabilityGeneration.current === generation) setCapabilityError(pairFailure?.response?.status === 404
        ? "This deployment does not expose the pairwise capability endpoint. Availability is UNKNOWN."
        : requestMessage(pairFailure));
    } finally {
      if (capabilityGeneration.current === generation) setCapabilityLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCapability();
    return () => { requestGeneration.current += 1; capabilityGeneration.current += 1; };
  }, [scanId, refreshCapability]); // Component identity additionally includes the signed-in account.

  async function acceptRecord(data, expectedRightScanId, expectedRequestId, generation) {
    const verified = await verifyResearchPairRecordIntegrity(data, scanId, expectedRightScanId, expectedRequestId);
    if (requestGeneration.current !== generation) return null;
    setRecord(verified);
    setSavedRecordId(verified.id);
    setRequestIdToReconcile(verified.request_id);
    setRightScanId(verified.right_scan_id);
    return verified;
  }

  async function reconcileRequest(requestId, expectedRightScanId, generation, quiet = false) {
    try {
      const { data } = await api.get(`/diagnostics/mda2-pairwise/request/${encodeURIComponent(requestId)}`);
      return await acceptRecord(data, expectedRightScanId, requestId, generation);
    } catch (requestError) {
      if (!quiet && requestGeneration.current === generation) setError(requestMessage(requestError));
      return null;
    }
  }

  async function runComparison(event) {
    event.preventDefault();
    if (!capabilityView.canRun || pending) return;
    const requestId = createResearchRequestId();
    let payload;
    try { payload = buildResearchPairRequest(scanId, rightScanId, lanes, requestId); }
    catch (validationError) { setError(validationError.message); return; }
    const generation = ++requestGeneration.current;
    setPending("compare");
    setError("");
    setRecord(null);
    setRequestIdToReconcile(requestId);
    try {
      const { data } = await api.post("/diagnostics/mda2-pairwise", payload, { timeout: 120000 });
      await acceptRecord(data, payload.right_scan_id, requestId, generation);
    } catch (requestError) {
      if (requestGeneration.current !== generation) return;
      if (requestError?.code === "ECONNABORTED") {
        const recovered = await reconcileRequest(requestId, payload.right_scan_id, generation, true);
        if (!recovered && requestGeneration.current === generation) {
          setError(`The request timed out and no sealed receipt is visible yet. Server outcome remains UNKNOWN. Reconcile request ${requestId} before starting another run.`);
        }
      } else {
        setError(requestMessage(requestError));
      }
    } finally {
      if (requestGeneration.current === generation) setPending("");
    }
  }

  async function retrieveRecord() {
    if (!savedRecordId.trim() || pending) return;
    const generation = ++requestGeneration.current;
    setPending("retrieve");
    setError("");
    setRecord(null);
    try {
      const { data } = await api.get(`/diagnostics/mda2-pairwise/${encodeURIComponent(savedRecordId.trim())}`);
      await acceptRecord(data, null, null, generation);
    } catch (requestError) {
      if (requestGeneration.current === generation) setError(requestMessage(requestError));
    } finally {
      if (requestGeneration.current === generation) setPending("");
    }
  }

  async function retrieveRequest() {
    const requestId = requestIdToReconcile.trim().toLowerCase();
    if (!requestId || pending) return;
    const generation = ++requestGeneration.current;
    setPending("reconcile");
    setError("");
    setRecord(null);
    try {
      const recovered = await reconcileRequest(requestId, null, generation, true);
      if (!recovered && requestGeneration.current === generation) setError("No sealed receipt is currently visible for this request identifier. Its server outcome remains UNKNOWN.");
    } finally {
      if (requestGeneration.current === generation) setPending("");
    }
  }

  async function downloadHtml() {
    if (!record?.id || pending) return;
    const generation = ++requestGeneration.current;
    const recordId = record.id;
    setPending("report");
    setError("");
    try {
      const response = await api.get(`/diagnostics/mda2-pairwise/${encodeURIComponent(recordId)}/report`, { responseType: "blob" });
      await verifyResearchHtmlReport(response.data, response.headers, record.receipt_sha256);
      if (requestGeneration.current === generation) downloadBlob(response.data, `soniccheck-pair-${recordId}.html`);
    } catch (requestError) {
      if (requestGeneration.current === generation) setError(requestMessage(requestError));
    } finally {
      if (requestGeneration.current === generation) setPending("");
    }
  }

  return <section aria-labelledby="research-pair-heading" className="mt-6 rounded-2xl border border-teal-300/20 bg-[#202027] p-6 sm:p-8">
    <div className="eyebrow">HARRY · Research continuation</div>
    <h2 id="research-pair-heading" className="mt-2 text-xl font-semibold text-[#F0E9D6]">Compare two private recordings</h2>
    <p className="mt-3 text-sm leading-6 text-[#F0E9D6]/65">Select saved scans owned by your account. Both need retained private audio of at most 90 seconds and 16 MiB per file. S5.4 needs at least 10 seconds per input; component comparison needs aligned equal durations and usable primary evidence. Four-fragment support needs at least 60 normalized matched seconds.</p>
    <p className="mt-2 text-xs leading-5 text-[#F0E9D6]/55">These local diagnostics make no paid-provider call and do not change the scan score or screening decision. They are candidate continuations of S5.4–S5.6; independent scientific validation remains unfinished. Every completed comparison is bound to a client request identifier, side-specific input custody and two SHA-256 seals.</p>
    <div aria-live="polite" className="mt-4 rounded-lg border border-white/10 p-4 text-sm text-[#F0E9D6]/70">
      {capabilityLoading ? "Checking runtime availability…" : capabilityView.summary}
      <div className="mt-1 text-xs">Runtime mode: {capabilityView.mode}</div>
      {capabilityView.reasons.length > 0 && <p className="mt-2 break-words text-xs">{capabilityView.reasons.join(" · ")}</p>}
      {capabilityError && <p className="mt-2 text-amber-100">{capabilityError}</p>}
      <Button type="button" onClick={refreshCapability} disabled={capabilityLoading || Boolean(pending)} size="sm" variant="outline" className={`mt-3 ${buttonClass}`}><RefreshCw className="mr-2 h-3 w-3" />Refresh availability</Button>
    </div>

    {capabilityView.researchVisibilityAllowed && <div className="mt-4 rounded-lg border border-white/10 p-4">
      <h3 className="text-sm font-semibold text-[#F0E9D6]/90">Administrator research process observations</h3>
      <p className="mt-2 text-xs leading-5 text-[#F0E9D6]/55">Configuration and source checks do not prove execution or accuracy. Deployment provenance: {diagnosticText(researchRuntime?.deployment_provenance)}.</p>
      {runtimeError && <p className="mt-2 text-xs text-amber-100">{runtimeError}</p>}
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs text-[#F0E9D6]/70">
        <thead><tr>{["Method", "Configured mode", "Effective status", "Execution observed"].map((label) => <th key={label} className="px-2 py-2">{label}</th>)}</tr></thead>
        <tbody>{researchRuntimeRows(researchRuntime).map((row) => <tr key={row.id} className="border-t border-white/10">
          <th scope="row" className="px-2 py-3">{row.name}</th><td className="px-2 py-3">{row.mode}</td><td className="break-words px-2 py-3">{row.effectiveStatus}</td><td className="px-2 py-3">{row.executionState}</td>
        </tr>)}</tbody>
      </table></div>
      {researchRuntimeRows(researchRuntime).some((row) => row.blockers.length > 0) && <details className="mt-3 text-xs text-[#F0E9D6]/60">
        <summary className="cursor-pointer">Recorded blockers and continuation work</summary>
        <ul className="mt-3 space-y-2">{researchRuntimeRows(researchRuntime).flatMap((row) => row.blockers.map((blocker) => <li key={`${row.id}:${blocker.reason}:${blocker.continuation}`} className="break-words">{row.name}: {blocker.reason} · {blocker.continuation}</li>))}</ul>
      </details>}
    </div>}

    <form onSubmit={runComparison} className="mt-5 space-y-4">
      <p className="break-all text-xs text-[#F0E9D6]/55">First scan: {scanId}</p>
      <label className="block text-sm text-[#F0E9D6]/80">Second saved scan with retained private audio
        <select className={`mt-2 ${inputClass}`} value={selectableScans.some((scan) => scan.id === rightScanId) ? rightScanId : ""} disabled={Boolean(pending)} onChange={(event) => { setRightScanId(event.target.value); setRecord(null); setError(""); }}>
          <option value="">Choose one of your eligible saved scans</option>
          {selectableScans.map((scan) => <option key={scan.id} value={scan.id}>{scan.title || "Untitled"} · {scan.id}</option>)}
        </select>
      </label>
      <label className="block text-xs text-[#F0E9D6]/65">Or enter your saved scan ID
        <input className={`mt-2 ${inputClass}`} value={rightScanId} disabled={Boolean(pending)} maxLength={128} onChange={(event) => { setRightScanId(event.target.value); setRecord(null); setError(""); }} placeholder="Second scan ID" autoComplete="off" />
      </label>
      <fieldset disabled={Boolean(pending)} className="space-y-3">
        <legend className="mb-3 text-sm text-[#F0E9D6]/80">Comparison methods</legend>
        {RESEARCH_PAIR_LANES.map((lane) => <label key={lane.id} className="flex items-start gap-3 rounded-lg border border-white/10 p-3 text-sm text-[#F0E9D6]/80">
          <input type="checkbox" checked={lanes.includes(lane.id)} onChange={(event) => { setLanes((current) => event.target.checked ? [...current, lane.id] : current.filter((id) => id !== lane.id)); setRecord(null); }} className="mt-1" />
          <span>{lane.name}<span className="mt-1 block text-xs leading-5 text-[#F0E9D6]/50">{lane.description}</span></span>
        </label>)}
      </fieldset>
      <Button type="submit" disabled={!capabilityView.canRun || Boolean(pending) || !rightScanId.trim() || !lanes.length || rightScanId.trim() === scanId} variant="outline" className={buttonClass}>{pending === "compare" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Run selected comparisons</Button>
    </form>

    <div className="mt-5 grid gap-4 border-t border-white/10 pt-5 lg:grid-cols-2">
      <div>
        <label className="block text-xs text-[#F0E9D6]/65">Reconcile a request identifier
          <input className={`mt-2 ${inputClass}`} value={requestIdToReconcile} disabled={Boolean(pending)} maxLength={36} onChange={(event) => setRequestIdToReconcile(event.target.value)} placeholder="xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx" autoComplete="off" />
        </label>
        <Button type="button" onClick={retrieveRequest} disabled={Boolean(pending) || !requestIdToReconcile.trim()} size="sm" variant="outline" className={`mt-3 ${buttonClass}`}>{pending === "reconcile" && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Reconcile request</Button>
      </div>
      <div>
        <label className="block text-xs text-[#F0E9D6]/65">Reopen a saved receipt by record ID
          <input className={`mt-2 ${inputClass}`} value={savedRecordId} disabled={Boolean(pending)} maxLength={128} onChange={(event) => setSavedRecordId(event.target.value)} placeholder="Comparison record ID" autoComplete="off" />
        </label>
        <Button type="button" onClick={retrieveRecord} disabled={Boolean(pending) || !savedRecordId.trim()} size="sm" variant="outline" className={`mt-3 ${buttonClass}`}>{pending === "retrieve" && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Load saved receipt</Button>
      </div>
    </div>
    {error && <p role="alert" className="mt-4 text-sm leading-6 text-red-200">{error}</p>}
    {record && <div className="mt-6 space-y-4" aria-live="polite">
      <div className="rounded-lg border border-teal-300/20 p-4 text-sm text-[#F0E9D6]/75">
        <h3 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-teal-200" />Verified sealed comparison · {record.status}</h3>
        <p className="mt-2 break-all text-xs">Record ID: {record.id}</p>
        <p className="mt-1 break-all text-xs">Request ID: {record.request_id}</p>
        <p className="mt-1 break-all text-xs">First scan: {record.left_scan_id}</p>
        <p className="mt-1 break-all text-xs">Second scan: {record.right_scan_id}</p>
        <p className="mt-1 break-all text-xs">Receipt SHA-256: {record.receipt_sha256}</p>
        <p className="mt-1 break-all text-xs">Result SHA-256: {record.result_sha256}</p>
        <p className="mt-2 text-xs">Primary comparison: {diagnosticText(record.result?.baseline?.status, "Not reported")}</p>
        {diagnosticReasons(record.result?.reason_codes).length > 0 && <p className="mt-2 text-xs text-amber-100">{diagnosticReasons(record.result.reason_codes).join(" · ")}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" className={buttonClass} onClick={() => downloadBlob(new Blob([`${JSON.stringify(record, null, 2)}\n`], { type: "application/json" }), `soniccheck-pair-${record.id}.json`)}><Download className="mr-2 h-3 w-3" />Download verified JSON</Button>
          <Button type="button" size="sm" variant="outline" className={buttonClass} disabled={Boolean(pending)} onClick={downloadHtml}>{pending === "report" ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Download className="mr-2 h-3 w-3" />}Download verified HTML</Button>
        </div>
      </div>
      {RESEARCH_PAIR_LANES.map((lane) => <LaneResult key={lane.id} id={lane.id} result={record.result?.lanes?.[lane.id]} canonicalProfileSource={record.result?.canonical_profile_source} />)}
    </div>}
  </section>;
}
