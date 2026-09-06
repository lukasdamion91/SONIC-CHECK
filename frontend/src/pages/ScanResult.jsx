import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Copy,
  Download,
  ExternalLink,
  FileSearch,
  Link2Off,
  Loader2,
  Share2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ANALYZER_CAPABILITY_MANIFEST_REVISION,
  ANALYZER_IDENTITY,
  ANALYZER_IDENTITY_REVISION,
} from "@/constants/analyzerIdentity.mjs";
import { SCAN } from "@/constants/testIds";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiErrorDetail } from "@/lib/api";
import { resolveAccessPolicy } from "@/lib/accessPolicy.mjs";
import {
  prepareScanResultIntegrity,
  ReportIntegrityError,
  verifyReportDelivery,
} from "@/lib/scanResultIntegrity.mjs";
import {
  buildChannelCoverageRows,
  compositionComparisonDisclosure,
  currentAnalyzerDiagnosticViews,
  multiviewConsistencyView,
  storedAnalyzerLabel,
} from "@/lib/scanResultPresentation.mjs";
import { copyTextBestEffort, refreshAfterCreditAttempt } from "@/lib/userActions.mjs";

const statuses = {
  REVIEW_REQUIRED: {
    label: "Candidate evidence — review required",
    icon: AlertCircle,
    className: "border-amber-300/30 bg-amber-300/5 text-amber-200",
  },
  NO_CANDIDATE_IDENTIFIED: {
    label: "No candidate identified in searched sources",
    icon: FileSearch,
    className: "border-sky-300/30 bg-sky-300/5 text-sky-200",
  },
  INCONCLUSIVE: {
    label: "Inconclusive — source coverage incomplete",
    icon: FileSearch,
    className: "border-white/15 bg-white/5 text-[#F0E9D6]/65",
  },
};

function Metric({ label, value, suffix = "", note }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#17171C] p-5">
      <div className="text-[10px] uppercase tracking-[0.15em] text-[#F0E9D6]/40 font-mono-data">{label}</div>
      <div className="mt-3 text-3xl font-semibold text-[#F0E9D6]">{value ?? "—"}{value != null && suffix}</div>
      {note && <div className="mt-2 text-xs leading-5 text-[#F0E9D6]/42">{note}</div>}
    </div>
  );
}

const coverageStateClasses = {
  not_submitted: "border-white/12 bg-white/[0.035] text-[#F0E9D6]/55",
  searched_no_candidate: "border-sky-300/20 bg-sky-300/5 text-sky-100/75",
  unavailable_degraded: "border-amber-300/20 bg-amber-300/5 text-amber-100/75",
  candidate_evidence: "border-amber-300/25 bg-amber-300/8 text-amber-100",
  comparison_coverage: "border-violet-300/20 bg-violet-300/5 text-violet-100/80",
};

const emptyComparisonState = (baselineScanId) => ({
  baselineScanId,
  records: [],
  comparisonScanId: "",
  transform: "",
  result: null,
  error: "",
  pendingRequestId: null,
});

function ChannelCoverage({ rows }) {
  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-[#202027] p-6 sm:p-8">
      <div className="eyebrow">Channel coverage</div>
      <h2 className="mt-2 text-xl font-semibold text-[#F0E9D6]">What was and was not checked</h2>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[680px] border-separate border-spacing-y-2 text-left text-xs">
          <thead className="text-[9px] uppercase tracking-widest text-[#F0E9D6]/38 font-mono-data">
            <tr><th className="px-3 py-2">Channel</th><th className="px-3 py-2">Input</th><th className="px-3 py-2">Outcome</th><th className="px-3 py-2">Coverage</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="bg-[#17171C] text-[#F0E9D6]/62">
                <th scope="row" className="rounded-l-xl px-3 py-4 font-medium text-[#F0E9D6]/82">{row.channel}</th>
                <td className="px-3 py-4">{row.input}</td>
                <td className="px-3 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 ${coverageStateClasses[row.state]}`}>{row.outcome}</span></td>
                <td className="rounded-r-xl px-3 py-4 leading-5">{row.coverage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function ScanResult() {
  const { user, refresh } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [scan, setScan] = useState(null);
  const [error, setError] = useState("");
  const [action, setAction] = useState("");
  const [badgeUrl, setBadgeUrl] = useState("");
  const [scanResultEnvelopeHash, setScanResultEnvelopeHash] = useState("");
  const [integrityError, setIntegrityError] = useState("");
  const [comparisonState, setComparisonState] = useState(() => emptyComparisonState(id));
  const multiviewRequestSequence = useRef(0);
  const accessPolicy = resolveAccessPolicy(user);

  useEffect(() => {
    let active = true;
    setError("");
    setIntegrityError("");
    setScanResultEnvelopeHash("");
    setBadgeUrl("");
    setScan(null);
    api.get(`/scans/${id}`, { transformResponse: [(data) => data] })
      .then(async ({ data }) => {
        try {
          const prepared = await prepareScanResultIntegrity(data);
          if (!active) return;
          setScan(prepared.scan);
          setScanResultEnvelopeHash(prepared.scanResultEnvelopeHash);
          if (prepared.scan.badge_id) {
            setBadgeUrl(`${window.location.origin}/verify/${prepared.scan.badge_id}`);
          }
        } catch (verificationError) {
          if (!active) return;
          try {
            setScan(typeof data === "string" ? JSON.parse(data) : data);
          } catch {
            setError("The stored evidence record could not be read.");
            return;
          }
          setIntegrityError(verificationError.message || "Report consistency checks are unavailable.");
        }
      })
      .catch((requestError) => {
        if (!active) return;
        let detail = requestError?.response?.data?.detail;
        if (typeof requestError?.response?.data === "string") {
          try { detail = JSON.parse(requestError.response.data)?.detail; } catch { detail = requestError.response.data; }
        }
        setError(formatApiErrorDetail(detail));
      });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    // Changing route identity invalidates both the visible state and every
    // in-flight comparison initiated for the previous baseline.
    multiviewRequestSequence.current += 1;
    setComparisonState(emptyComparisonState(id));
    let active = true;
    api.get("/scans")
      .then(({ data }) => {
        if (!active) return;
        const records = Array.isArray(data)
          ? data.filter((record) => record?.id && record.id !== id)
          : [];
        setComparisonState((current) => (
          current.baselineScanId === id ? { ...current, records } : current
        ));
      })
      .catch(() => {
        if (active) {
          setComparisonState((current) => (
            current.baselineScanId === id ? { ...current, records: [] } : current
          ));
        }
      });
    return () => { active = false; };
  }, [id]);

  // Passive effects run after render. Bind every comparison value to its route
  // so a route transition cannot flash the previous record's result or inputs.
  const activeComparison = comparisonState.baselineScanId === id
    ? comparisonState
    : emptyComparisonState(id);

  const result = scan?.result || {};
  const status = statuses[result.screening_status] || {
    label: "Legacy evidence record — interpret under its original method version",
    icon: FileSearch,
    className: "border-white/15 bg-white/5 text-[#F0E9D6]/65",
  };
  const StatusIcon = status.icon;
  const similarity = result.similarity_analysis || {};
  const composition = result.composition_analysis || {};
  const matches = result.matches || [];
  const compositionComparisons = composition.comparisons || [];
  const limitations = result.evidence?.limitations || [];
  const channelCoverageRows = buildChannelCoverageRows(result);
  const comparisonDisclosure = compositionComparisonDisclosure(composition);
  const { isCurrentCapabilityBoundHarry, v34, v36 } = currentAnalyzerDiagnosticViews(result);
  const v35 = multiviewConsistencyView(activeComparison.result);
  const analyzerLabel = storedAnalyzerLabel(result);
  const analyzer = result.analyzer || {};
  const hasCurrentHarryMarker = (
    analyzer.identity_revision === ANALYZER_IDENTITY_REVISION
    || analyzer.capability_manifest_revision === ANALYZER_CAPABILITY_MANIFEST_REVISION
  );
  const harryContractFailures = [];
  if (hasCurrentHarryMarker && !isCurrentCapabilityBoundHarry) {
    harryContractFailures.push("the stored HARRY identity or capability-manifest binding is incomplete or invalid");
  }
  if (isCurrentCapabilityBoundHarry && !v34?.available) {
    harryContractFailures.push(`V34 structural-missingness output is ${v34?.reason ? `invalid (${v34.reason})` : "missing"}`);
  }
  if (isCurrentCapabilityBoundHarry && !v36?.available) {
    harryContractFailures.push(`V36 channel-loss output is ${v36?.reason ? `invalid (${v36.reason})` : "missing"}`);
  }
  const harryContractWarning = harryContractFailures.length
    ? `Fail-closed capability warning: ${harryContractFailures.join("; ")}. Do not interpret unavailable structural diagnostics as a successful ${ANALYZER_IDENTITY} result.`
    : "";
  const unavailableDiagnosticDetail = hasCurrentHarryMarker
    ? `not shown because the stored ${ANALYZER_IDENTITY} identity or capability-manifest binding is incomplete or invalid`
    : "not present in this legacy or historical record";
  const v34UnavailableDetail = isCurrentCapabilityBoundHarry
    ? (v34?.reason || `required output missing from the current ${ANALYZER_IDENTITY} capability contract`)
    : unavailableDiagnosticDetail;
  const v36UnavailableDetail = isCurrentCapabilityBoundHarry
    ? (v36?.reason || `required output missing from the current ${ANALYZER_IDENTITY} capability contract`)
    : unavailableDiagnosticDetail;
  const reportAvailable = accessPolicy.can_download_report && Boolean(scanResultEnvelopeHash) && !integrityError;

  const provenanceRows = useMemo(() => {
    const provenance = result.evidence?.provenance || {};
    const rows = [];
    if (provenance.audio?.submitted) rows.push(["Audio SHA-256", provenance.audio.sha256]);
    if (provenance.lyrics?.submitted) rows.push(["Lyrics SHA-256", provenance.lyrics.sha256]);
    if (provenance.captured_at) rows.push(["Captured", provenance.captured_at]);
    return rows;
  }, [result.evidence?.provenance]);

  const downloadReport = async () => {
    if (!accessPolicy.can_download_report) {
      toast.error("This account does not currently have report access.");
      return;
    }
    if (!scanResultEnvelopeHash || integrityError) {
      toast.error(integrityError || "This report cannot be downloaded without a valid local scan-result envelope integrity hash.");
      return;
    }
    if (accessPolicy.report_credit_will_be_consumed) {
      const creditCopy = accessPolicy.report_remaining === 1
        ? "your one-time report credit"
        : `one of your ${accessPolicy.report_remaining ?? "available"} report credits`;
      const confirmed = window.confirm(
        `Generate this PDF and consume ${creditCopy}? The server consumes the credit when it generates the report; SonicCheck then checks that its scan-result envelope hash matches this loaded record and that its PDF-byte hash matches the delivered file before saving it.`,
      );
      if (!confirmed) return;
    }
    setAction("report");
    try {
      const response = await api.get(`/scans/${id}/report`, { responseType: "blob" });
      await verifyReportDelivery({
        blob: response.data,
        headers: response.headers,
        expectedScanResultEnvelopeHash: scanResultEnvelopeHash,
      });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `soniccheck-evidence-${id}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Integrity-checked evidence report downloaded");
    } catch (requestError) {
      toast.error(
        requestError instanceof ReportIntegrityError
          ? requestError.message
          : formatApiErrorDetail(requestError?.response?.data?.detail),
      );
    } finally {
      await refreshAfterCreditAttempt(
        accessPolicy.report_credit_will_be_consumed,
        refresh,
      );
      setAction("");
    }
  };

  const createBadge = async () => {
    if (!accessPolicy.can_create_badge) {
      toast.error("This account cannot publish a public evidence-record link.");
      return;
    }
    const confirmed = window.confirm(
      "Publish a public record showing the title, artist, region, submission channels, screening status, analysis version, screening time and badge ID? Anyone with the link can view it. Raw audio, full lyrics and your account email are not shown.",
    );
    if (!confirmed) return;
    setAction("badge");
    try {
      const { data } = await api.post(`/scans/${id}/badge`);
      const url = `${window.location.origin}/verify/${data.badge_id}`;
      setBadgeUrl(url);
      setScan((current) => ({ ...current, badge_id: data.badge_id }));
      const copied = await copyTextBestEffort(url);
      toast.success(
        copied
          ? "Public evidence-record link created and copied"
          : "Public evidence-record link created; copy it manually from the record",
      );
    } catch (requestError) {
      toast.error(formatApiErrorDetail(requestError?.response?.data?.detail));
    } finally {
      setAction("");
    }
  };

  const unpublishBadge = async () => {
    if (!window.confirm("Unpublish this public evidence-record link? The private evidence record will remain in your account.")) return;
    setAction("unpublish");
    try {
      await api.delete(`/scans/${id}/badge`);
      setBadgeUrl("");
      setScan((current) => ({ ...current, badge_id: null }));
      toast.success("Public evidence-record link unpublished");
    } catch (requestError) {
      toast.error(formatApiErrorDetail(requestError?.response?.data?.detail));
    } finally {
      setAction("");
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this evidence record and any uniquely stored audio? This cannot be undone.")) return;
    setAction("delete");
    try {
      await api.delete(`/scans/${id}`);
      toast.success("Evidence record deleted");
      navigate("/app");
    } catch (requestError) {
      toast.error(formatApiErrorDetail(requestError?.response?.data?.detail));
      setAction("");
    }
  };

  const runMultiviewComparison = async () => {
    const baselineScanId = id;
    const comparisonScanId = activeComparison.comparisonScanId;
    const comparisonTransform = activeComparison.transform.trim();
    if (!comparisonScanId || !comparisonTransform) {
      setComparisonState((current) => (
        current.baselineScanId === baselineScanId
          ? { ...current, error: "Choose a comparison record and describe its identity-preserving transform." }
          : current
      ));
      return;
    }
    const requestId = multiviewRequestSequence.current + 1;
    multiviewRequestSequence.current = requestId;
    setComparisonState((current) => (
      current.baselineScanId === baselineScanId
        ? { ...current, result: null, error: "", pendingRequestId: requestId }
        : current
    ));
    try {
      const { data } = await api.post("/diagnostics/multiview-consistency", {
        baseline_view_id: "baseline",
        views: [
          {
            scan_id: baselineScanId,
            view_id: "baseline",
            transform_id: "submitted-baseline",
            expectation: "IDENTITY_PRESERVING",
          },
          {
            scan_id: comparisonScanId,
            view_id: "comparison",
            transform_id: comparisonTransform,
            expectation: "IDENTITY_PRESERVING",
          },
        ],
      });
      if (multiviewRequestSequence.current !== requestId) return;
      const responseError = multiviewConsistencyView(data)
        ? ""
        : "The V35 response failed its diagnostic-only contract and was not displayed.";
      setComparisonState((current) => (
        current.baselineScanId === baselineScanId && current.pendingRequestId === requestId
          ? { ...current, result: responseError ? null : data, error: responseError }
          : current
      ));
    } catch (requestError) {
      if (multiviewRequestSequence.current !== requestId) return;
      setComparisonState((current) => (
        current.baselineScanId === baselineScanId && current.pendingRequestId === requestId
          ? { ...current, error: formatApiErrorDetail(requestError?.response?.data?.detail) }
          : current
      ));
    } finally {
      if (multiviewRequestSequence.current === requestId) {
        setComparisonState((current) => (
          current.baselineScanId === baselineScanId && current.pendingRequestId === requestId
            ? { ...current, pendingRequestId: null }
            : current
        ));
      }
    }
  };

  if (error) return <div className="mx-auto max-w-2xl px-6 py-24 text-center text-red-200">{error}</div>;
  if (!scan) return <div className="grid min-h-[65vh] place-items-center"><Loader2 className="h-7 w-7 animate-spin text-[#F0E9D6]/45" /></div>;

  return (
    <main className="mx-auto max-w-7xl px-6 py-12" data-testid={SCAN.resultCard}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link to="/app" className="inline-flex items-center gap-2 text-sm text-[#F0E9D6]/55 hover:text-[#F0E9D6]"><ArrowLeft className="h-4 w-4" />Dashboard</Link>
        <div className="flex flex-wrap gap-2">
          <Button onClick={downloadReport} disabled={Boolean(action) || !reportAvailable} title={reportAvailable ? "Download PDF with integrity checks" : (integrityError || "Report access unavailable")} variant="outline" className="border-white/15 bg-transparent text-[#F0E9D6] hover:bg-white/10">
            {action === "report" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}{reportAvailable ? "PDF report" : "Report unavailable"}
          </Button>
          <Button onClick={createBadge} disabled={Boolean(action) || !accessPolicy.can_create_badge} title={accessPolicy.can_create_badge ? "Publish a public evidence-record link" : "Public sharing unavailable"} variant="outline" className="border-white/15 bg-transparent text-[#F0E9D6] hover:bg-white/10">
            {action === "badge" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}{accessPolicy.can_create_badge ? "Share record" : "Sharing unavailable"}
          </Button>
          <Button data-testid={SCAN.deleteBtn} onClick={remove} disabled={Boolean(action)} variant="ghost" className="text-red-200 hover:bg-red-400/10 hover:text-red-100"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      <section className="mt-8 rounded-2xl border border-white/10 bg-[#202027] p-7 sm:p-10">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div>
            <div className="eyebrow">Evidence record</div>
            <h1 className="mt-4 font-display text-5xl text-[#F0E9D6]">{scan.title}</h1>
            <div className="mt-3 text-sm text-[#F0E9D6]/50">{scan.artist_name || "Unknown creator"} · {new Date(scan.created_at).toLocaleString("en-AU")}</div>
          </div>
          <div data-testid={SCAN.verdictBadge} className={`inline-flex max-w-sm items-center gap-2 rounded-full border px-4 py-2 text-xs uppercase tracking-widest font-mono-data ${status.className}`}>
            <StatusIcon className="h-4 w-4 shrink-0" />{status.label}
          </div>
        </div>
        <p className="mt-8 max-w-4xl text-lg leading-8 text-[#F0E9D6]/66">{result.screening_summary || "This record predates the current screening-summary schema. Review it under the listed analysis version."}</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Similarity signal" value={similarity.similarity_signal?.value_percent} suffix="%" note="Method-specific signal, not a probability." />
          <Metric label="Aggregate evidence score" value={similarity.evidence_confidence?.value} suffix="/100" note={`${similarity.evidence_confidence?.band || "Coverage dependent"}${similarity.evidence_confidence?.channel_coverage_percent != null ? ` · ${similarity.evidence_confidence.channel_coverage_percent}% weighted channel coverage` : ""}`} />
          <Metric label="Candidates" value={matches.length} note="Named candidate-evidence rows." />
          <Metric label="Regional context" value={result.region || scan.region} note={result.regional_context || "Context recorded only."} />
        </div>
      </section>

      {integrityError && (
        <div className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm leading-6 text-amber-100/75">
          PDF download is disabled because the locally loaded analysis result could not be prepared for the report consistency checks. {integrityError}
        </div>
      )}

      <ChannelCoverage rows={channelCoverageRows} />

      <section className="mt-6 rounded-2xl border border-white/10 bg-[#202027] p-6 sm:p-8">
        <div className="eyebrow">{ANALYZER_IDENTITY} structural diagnostics</div>
        <h2 className="mt-2 text-xl font-semibold text-[#F0E9D6]">Coverage bounds and sensitivity</h2>
        <p className="mt-3 max-w-4xl text-xs leading-5 text-[#F0E9D6]/48">
          These diagnostics describe the evidence returned by this run. They do not change screening status and are not a confidence interval, probability or accuracy estimate.
        </p>

        {harryContractWarning && (
          <div role="alert" className="mt-5 rounded-xl border border-red-300/25 bg-red-300/[0.06] p-4 text-xs leading-5 text-red-100">
            {harryContractWarning}
          </div>
        )}

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-[#17171C] p-5">
            <div className="text-[10px] uppercase tracking-[0.15em] text-[#F0E9D6]/40 font-mono-data">V34 · structural missingness</div>
            {v34?.available ? (
              <>
                <div className="mt-3 text-2xl font-semibold text-[#F0E9D6]">{v34.lower}–{v34.upper}/100</div>
                <p className="mt-2 text-xs leading-5 text-[#F0E9D6]/48">Observed {v34.observed}/100 · {v34.unresolved}% of fixed channel weight unresolved. The selected entity and exact-linkage projection are held fixed.</p>
              </>
            ) : (
              <p className="mt-3 text-xs leading-5 text-[#F0E9D6]/48">Envelope unavailable: {v34UnavailableDetail}.</p>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-[#17171C] p-5">
            <div className="text-[10px] uppercase tracking-[0.15em] text-[#F0E9D6]/40 font-mono-data">V36 · single-channel loss</div>
            {v36?.available ? (
              <>
                <div className="mt-3 text-lg font-semibold text-[#F0E9D6]">{String(v36.reviewStability || "evaluated").replaceAll("_", " ")}</div>
                <p className="mt-2 text-xs leading-5 text-[#F0E9D6]/48">{v36.evaluated} of {v36.possible} observable channel-loss scenarios evaluated{v36.maximumChange != null ? ` · maximum entity-score movement ${v36.maximumChange} points` : ""}. Counterfactual shadow diagnostic only.</p>
              </>
            ) : (
              <p className="mt-3 text-xs leading-5 text-[#F0E9D6]/48">Diagnostic unavailable: {v36UnavailableDetail}.</p>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-violet-300/15 bg-violet-300/[0.035] p-5">
          <div className="text-[10px] uppercase tracking-[0.15em] text-violet-100/60 font-mono-data">V35 · multi-view consistency</div>
          <p className="mt-2 text-xs leading-5 text-[#F0E9D6]/48">Compare this record with another owned scan only when both are views of the same underlying source and the named transform is identity-preserving. SONIC CHECK records this as your assertion; it does not infer or verify source identity.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <select
              value={activeComparison.comparisonScanId}
              disabled={activeComparison.pendingRequestId != null}
              onChange={(event) => {
                const comparisonScanId = event.target.value;
                setComparisonState((current) => (
                  current.baselineScanId === id
                    ? { ...current, comparisonScanId, result: null, error: "" }
                    : current
                ));
              }}
              className="h-10 rounded-md border border-white/15 bg-[#17171C] px-3 text-xs text-[#F0E9D6]"
            >
              <option value="">Choose owned comparison record</option>
              {activeComparison.records.map((record) => <option key={record.id} value={record.id}>{record.title || "Untitled"} · {record.created_at ? new Date(record.created_at).toLocaleDateString("en-AU") : "stored scan"}</option>)}
            </select>
            <input
              value={activeComparison.transform}
              disabled={activeComparison.pendingRequestId != null}
              onChange={(event) => {
                const transform = event.target.value;
                setComparisonState((current) => (
                  current.baselineScanId === id
                    ? { ...current, transform, result: null, error: "" }
                    : current
                ));
              }}
              maxLength={128}
              placeholder="Transform, e.g. lossless-remux"
              className="h-10 rounded-md border border-white/15 bg-[#17171C] px-3 text-xs text-[#F0E9D6] placeholder:text-[#F0E9D6]/30"
            />
            <Button onClick={runMultiviewComparison} disabled={activeComparison.pendingRequestId != null || !activeComparison.comparisonScanId || !activeComparison.transform.trim()} variant="outline" className="border-violet-200/20 bg-transparent text-violet-100 hover:bg-violet-200/10">{activeComparison.pendingRequestId != null ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Compare views</Button>
          </div>
          {activeComparison.error && <p className="mt-3 text-xs leading-5 text-red-200">{activeComparison.error}</p>}
          {v35 && <div className="mt-4 rounded-lg border border-white/10 bg-[#17171C] p-4 text-xs leading-5 text-[#F0E9D6]/58"><span className="font-mono-data text-[#F0E9D6]/82">{v35.status.replaceAll("_", " ")}</span> · {v35.identityPreservingViews} declared views · {v35.exactDivergenceCount} exact divergence{v35.exactDivergenceCount === 1 ? "" : "s"}{v35.minimumExactJaccard != null ? ` · minimum exact-set overlap ${Math.round(v35.minimumExactJaccard * 100)}%` : ""}. Diagnostic only; no provider call, ranking change, match decision or legal conclusion.</div>}
        </div>
      </section>

      {badgeUrl && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-[#D4FF00]/20 bg-[#D4FF00]/5 p-4 text-sm text-[#F0E9D6]/70">
          <ExternalLink className="h-4 w-4 text-[#D4FF00]" /><a href={badgeUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:underline">{badgeUrl}</a>
          <Button size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(badgeUrl)}><Copy className="mr-2 h-4 w-4" />Copy</Button>
          <Button size="sm" variant="ghost" onClick={unpublishBadge} disabled={Boolean(action)} className="text-amber-100 hover:bg-amber-300/10"><Link2Off className="mr-2 h-4 w-4" />Unpublish</Button>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <section className="rounded-2xl border border-white/10 bg-[#202027] p-6 sm:p-8">
          <div className="eyebrow">Candidate evidence</div>
          <h2 className="mt-2 text-xl font-semibold text-[#F0E9D6]">Matched references</h2>
          {matches.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-white/15 p-8 text-sm leading-6 text-[#F0E9D6]/52">No candidate row was returned by the available recording-identity or lyric channels. This is limited to the sources actually searched.</div>
          ) : (
            <div className="mt-6 space-y-4">
              {matches.map((match, index) => (
                <article key={`${match.reference_id || "candidate"}-${index}`} data-testid={SCAN.matchRow} className="rounded-xl border border-white/10 bg-[#17171C] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-[#F0E9D6]">{match.reference_title || "Candidate reference"}</h3>
                      <div className="mt-1 text-xs text-[#F0E9D6]/45">{match.reference_artist || "Unknown creator"} · {match.analysis_type?.replaceAll("_", " ") || "evidence channel"}</div>
                    </div>
                    <span className="rounded-full border border-white/15 px-3 py-1 text-[9px] uppercase tracking-widest text-[#F0E9D6]/55 font-mono-data">human review</span>
                  </div>
                  {(match.matched_snippet || match.your_snippet) && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg bg-white/[0.035] p-3 text-xs leading-5 text-[#F0E9D6]/55"><span className="block text-[9px] uppercase tracking-widest text-[#F0E9D6]/35 font-mono-data">Reference evidence</span>{match.matched_snippet || "—"}</div>
                      <div className="rounded-lg bg-white/[0.035] p-3 text-xs leading-5 text-[#F0E9D6]/55"><span className="block text-[9px] uppercase tracking-widest text-[#F0E9D6]/35 font-mono-data">Submitted evidence</span>{match.your_snippet || "—"}</div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}

          {compositionComparisons.length > 0 && (
            <div className="mt-10">
              <div className="eyebrow">Composition refinement</div>
              <div className="mt-5 space-y-3">
                {compositionComparisons.map((comparison) => (
                  <div key={comparison.reference_id} className="rounded-xl border border-white/10 bg-[#17171C] p-5">
                    <div className="flex flex-wrap justify-between gap-3">
                      <div><div className="font-medium text-[#F0E9D6]">{comparison.title}</div><div className="mt-1 text-xs text-[#F0E9D6]/42">{comparison.creator} · {comparison.rights_basis}</div></div>
                      <div className="text-right font-mono-data">
                        <div className="text-2xl text-[#F0E9D6]">{comparison.composition_signal_percent != null ? `${comparison.composition_signal_percent}%` : "Unavailable"}</div>
                        <div className="text-[9px] uppercase tracking-widest text-[#F0E9D6]/38">{comparison.composition_signal_percent != null ? "feature agreement" : "comparison status"}</div>
                        {comparison.measurement_confidence_percent != null && <div className="mt-2 text-[10px] text-[#F0E9D6]/48">{comparison.measurement_confidence_percent}% measurement quality</div>}
                      </div>
                    </div>
                    {comparison.composition_signal_percent == null && comparison.reason && <p className="mt-3 text-xs leading-5 text-[#F0E9D6]/45">{comparison.reason}</p>}
                  </div>
                ))}
              </div>
              {comparisonDisclosure && <p className="mt-4 text-xs leading-5 text-[#F0E9D6]/48">{comparisonDisclosure.text}</p>}
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-[#24242C] p-6">
            <div className="eyebrow">Method identity</div>
            <dl className="mt-5 space-y-4 text-sm">
              <div><dt className="text-[#F0E9D6]/38">Analysis version</dt><dd className="mt-1 break-all text-[#F0E9D6]/68 font-mono-data">{result.analysis_version || "legacy"}</dd></div>
              <div><dt className="text-[#F0E9D6]/38">Analyzer</dt><dd className="mt-1 break-all text-[#F0E9D6]/68 font-mono-data">{analyzerLabel || "legacy or unverified"}</dd></div>
              <div><dt className="text-[#F0E9D6]/38">Result schema</dt><dd className="mt-1 break-all text-[#F0E9D6]/68 font-mono-data">{result.result_schema_version || "legacy"}</dd></div>
              <div><dt className="text-[#F0E9D6]/38">Composition manifest</dt><dd className="mt-1 break-all text-[#F0E9D6]/68 font-mono-data">{composition.reference_manifest_version || "not used"}</dd></div>
            </dl>
          </div>

          {provenanceRows.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-[#24242C] p-6">
              <div className="eyebrow">Input provenance</div>
              <dl className="mt-5 space-y-4 text-xs">
                {provenanceRows.map(([label, value]) => <div key={label}><dt className="text-[#F0E9D6]/38">{label}</dt><dd className="mt-1 break-all text-[#F0E9D6]/62 font-mono-data">{value}</dd></div>)}
              </dl>
            </div>
          )}

          <div className="rounded-2xl border border-amber-300/18 bg-amber-300/5 p-6">
            <div className="eyebrow !text-amber-200">Interpretation limits</div>
            <ul className="mt-4 space-y-3 text-xs leading-5 text-[#F0E9D6]/60">
              {(limitations.length ? limitations : [
                "Candidate evidence requires qualified human review.",
                "No result establishes authorship, ownership or legal clearance.",
                "No candidate identified does not mean every possible source was searched.",
              ]).map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}
