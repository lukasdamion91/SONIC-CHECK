import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileSearch,
  Loader2,
  Share2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SCAN } from "@/constants/testIds";
import { api, formatApiErrorDetail } from "@/lib/api";

const statuses = {
  REVIEW_REQUIRED: {
    label: "Candidate evidence — review required",
    icon: AlertCircle,
    className: "border-amber-300/30 bg-amber-300/5 text-amber-200",
  },
  NO_CANDIDATE_IDENTIFIED: {
    label: "No candidate identified in searched sources",
    icon: CheckCircle2,
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

export default function ScanResult() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [scan, setScan] = useState(null);
  const [error, setError] = useState("");
  const [action, setAction] = useState("");
  const [badgeUrl, setBadgeUrl] = useState("");

  useEffect(() => {
    api.get(`/scans/${id}`)
      .then(({ data }) => setScan(data))
      .catch((requestError) => setError(formatApiErrorDetail(requestError?.response?.data?.detail)));
  }, [id]);

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

  const provenanceRows = useMemo(() => {
    const provenance = result.evidence?.provenance || {};
    const rows = [];
    if (provenance.audio?.submitted) rows.push(["Audio SHA-256", provenance.audio.sha256]);
    if (provenance.lyrics?.submitted) rows.push(["Lyrics SHA-256", provenance.lyrics.sha256]);
    if (provenance.captured_at) rows.push(["Captured", provenance.captured_at]);
    return rows;
  }, [result.evidence?.provenance]);

  const downloadReport = async () => {
    setAction("report");
    try {
      const response = await api.get(`/scans/${id}/report`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `soniccheck-evidence-${id}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Evidence report downloaded");
    } catch (requestError) {
      toast.error(formatApiErrorDetail(requestError?.response?.data?.detail));
    } finally {
      setAction("");
    }
  };

  const createBadge = async () => {
    const confirmed = window.confirm(
      "Publish a public record showing the title, artist, region, submission channels, screening status, analysis version, screening time and badge ID? Anyone with the link can view it. Raw audio, full lyrics and your account email are not shown.",
    );
    if (!confirmed) return;
    setAction("badge");
    try {
      const { data } = await api.post(`/scans/${id}/badge`);
      const url = `${window.location.origin}/verify/${data.badge_id}`;
      setBadgeUrl(url);
      await navigator.clipboard?.writeText(url);
      toast.success("Public evidence-record link created");
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

  if (error) return <div className="mx-auto max-w-2xl px-6 py-24 text-center text-red-200">{error}</div>;
  if (!scan) return <div className="grid min-h-[65vh] place-items-center"><Loader2 className="h-7 w-7 animate-spin text-[#F0E9D6]/45" /></div>;

  return (
    <main className="mx-auto max-w-7xl px-6 py-12" data-testid={SCAN.resultCard}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link to="/app" className="inline-flex items-center gap-2 text-sm text-[#F0E9D6]/55 hover:text-[#F0E9D6]"><ArrowLeft className="h-4 w-4" />Dashboard</Link>
        <div className="flex flex-wrap gap-2">
          <Button onClick={downloadReport} disabled={Boolean(action)} variant="outline" className="border-white/15 bg-transparent text-[#F0E9D6] hover:bg-white/10">
            {action === "report" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}PDF report
          </Button>
          <Button onClick={createBadge} disabled={Boolean(action)} variant="outline" className="border-white/15 bg-transparent text-[#F0E9D6] hover:bg-white/10">
            {action === "badge" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}Share record
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
          <Metric label="Evidence confidence" value={similarity.evidence_confidence?.value} suffix="/100" note={similarity.evidence_confidence?.band || "Coverage dependent"} />
          <Metric label="Candidates" value={matches.length} note="Named candidate-evidence rows." />
          <Metric label="Regional context" value={result.region || scan.region} note={result.regional_context || "Context recorded only."} />
        </div>
      </section>

      {badgeUrl && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-[#D4FF00]/20 bg-[#D4FF00]/5 p-4 text-sm text-[#F0E9D6]/70">
          <ExternalLink className="h-4 w-4 text-[#D4FF00]" /><a href={badgeUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:underline">{badgeUrl}</a>
          <Button size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(badgeUrl)}><Copy className="mr-2 h-4 w-4" />Copy</Button>
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
                      <div className="text-right font-mono-data"><div className="text-2xl text-[#F0E9D6]">{comparison.composition_signal_percent}%</div><div className="text-[9px] uppercase tracking-widest text-[#F0E9D6]/38">feature agreement</div></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-[#24242C] p-6">
            <div className="eyebrow">Method identity</div>
            <dl className="mt-5 space-y-4 text-sm">
              <div><dt className="text-[#F0E9D6]/38">Analysis version</dt><dd className="mt-1 break-all text-[#F0E9D6]/68 font-mono-data">{result.analysis_version || "legacy"}</dd></div>
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
