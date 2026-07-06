import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, API, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Waveform from "@/components/Waveform";
import { SCAN } from "@/constants/testIds";
import { AlertTriangle, Check, AlertCircle, Trash2, ArrowLeft, Scale, FileDown, Loader2, BadgeCheck, Copy } from "lucide-react";
import { toast } from "sonner";

const verdictMap = {
  CLEAR: { color: "text-[#0047FF] border-emerald-400/40 bg-emerald-400/10", icon: Check, label: "CLEAR" },
  REVIEW: { color: "text-[#F0E9D6] border-amber-400/40 bg-amber-400/10", icon: AlertCircle, label: "REVIEW" },
  VIOLATION: { color: "text-[#D4FF00] border-red-400/40 bg-red-400/10", icon: AlertTriangle, label: "VIOLATION" },
};

export default function ScanResult() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [scan, setScan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [badgeId, setBadgeId] = useState(null);
  const [creatingBadge, setCreatingBadge] = useState(false);

  useEffect(() => {
    api.get(`/scans/${id}`).then((r) => { setScan(r.data); setBadgeId(r.data.badge_id || null); }).catch((e) => {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
      navigate("/dashboard");
    }).finally(() => setLoading(false));
  }, [id, navigate]);

  useEffect(() => {
    if (!scan?.audio_storage_path) return;
    let url;
    api.get(`/scans/${id}/audio`, { responseType: "blob" })
      .then((res) => {
        url = URL.createObjectURL(res.data);
        setAudioUrl(url);
      })
      .catch(() => {});
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [scan?.audio_storage_path, id]);

  const onDownloadReport = async () => {
    setDownloading(true);
    try {
      const res = await api.get(`/scans/${id}/report`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `soniccheck_report_${(scan?.title || "scan").replace(/[^a-zA-Z0-9 _-]/g, "").replace(/ /g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("PDF report downloaded");
    } catch (e) {
      if (e.response?.status === 402) {
        toast.error("PDF reports are a Pro feature — upgrade to unlock", {
          action: { label: "See plans", onClick: () => navigate("/pricing") },
        });
      } else {
        const detail = e.response?.data instanceof Blob ? "Could not generate report" : formatApiErrorDetail(e.response?.data?.detail);
        toast.error(detail || "Could not generate report");
      }
    } finally {
      setDownloading(false);
    }
  };

  const onCreateBadge = async () => {
    setCreatingBadge(true);
    try {
      const { data } = await api.post(`/scans/${id}/badge`);
      setBadgeId(data.badge_id);
      toast.success("Verification badge created — share it anywhere");
    } catch (e) {
      if (e.response?.status === 402) {
        toast.error("Verification badges are a Pro feature", {
          action: { label: "See plans", onClick: () => navigate("/pricing") },
        });
      } else {
        toast.error(formatApiErrorDetail(e.response?.data?.detail));
      }
    } finally {
      setCreatingBadge(false);
    }
  };

  const onDelete = async () => {
    if (!window.confirm("Delete this scan permanently?")) return;
    try {
      await api.delete(`/scans/${id}`);
      toast.success("Scan deleted");
      navigate("/dashboard");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  if (loading) return <div className="mx-auto max-w-5xl px-6 py-20 text-center text-[#F0E9D6]/50 font-mono-data">Loading scan…</div>;
  if (!scan) return null;

  const result = scan.result || {};
  const V = verdictMap[result.verdict] || verdictMap.REVIEW;
  const fpBlock = result.fingerprint || result.acr;
  const fpEngine = fpBlock?.engine || "ACRCloud";

  return (
    <div className="mx-auto max-w-7xl px-6 py-12" data-testid={SCAN.resultCard}>
      <div className="mb-8 flex items-center justify-between">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-[#F0E9D6]/65 hover:text-[#F0E9D6]">
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
        <div className="flex items-center gap-2">
          <Button
            data-testid="scan-create-badge-btn"
            onClick={onCreateBadge}
            disabled={creatingBadge || !!badgeId}
            variant="outline"
            className="border-[#D4FF00]/40 bg-transparent text-[#D4FF00] hover:bg-[#D4FF00]/10 hover:text-[#D4FF00]"
          >
            {creatingBadge ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BadgeCheck className="mr-2 h-4 w-4" />}
            {badgeId ? "Badge active" : "Verification badge"}
          </Button>
          <Button
            data-testid="scan-download-report-btn"
            onClick={onDownloadReport}
            disabled={downloading}
            variant="outline"
            className="border-[#0047FF]/40 bg-transparent text-[#F0E9D6] hover:bg-[#0047FF]/15 hover:text-[#F0E9D6]"
          >
            {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
            {downloading ? "Generating…" : "PDF report"}
          </Button>
          <Button
            data-testid={SCAN.deleteBtn}
            onClick={onDelete}
            variant="ghost"
            className="text-[#D4FF00] hover:bg-red-500/10 hover:text-[#D4FF00]/90"
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete scan
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Headline */}
        <div className="lg:col-span-8 rounded-md border border-white/10 bg-[#24242C] p-8">
          <div className="text-[10px] uppercase tracking-widest text-[#F0E9D6]/50 font-mono-data">Track</div>
          <h1 className="font-display text-5xl text-[#F0E9D6] mt-2">{scan.title}</h1>
          <div className="mt-2 text-[#F0E9D6]/65">{scan.artist_name || "—"}</div>
          <div className="mt-8 flex flex-wrap items-end gap-8">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-[#F0E9D6]/50 font-mono-data">Overall plagiarism score</div>
              <div data-testid={SCAN.overallScore} className="font-mono-data text-[88px] leading-none text-[#F0E9D6]">{result.overall_score}<span className="text-3xl text-[#F0E9D6]/50">%</span></div>
            </div>
            <div data-testid={SCAN.verdictBadge} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-mono-data uppercase tracking-widest ${V.color}`}>
              <V.icon className="h-4 w-4" /> {V.label}
            </div>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Metric label="Lyric similarity" val={result.top_lyric_similarity} threshold={result.lyric_threshold} />
            <Metric label="Melodic similarity" val={result.top_melody_similarity} threshold={result.melody_threshold} />
            <Metric label="Confidence" val={result.matches?.[0]?.confidence ? Math.round(result.matches[0].confidence * 100) : 0} suffix="%" />
          </div>
        </div>

        {/* Regional verdict */}
        <div className="lg:col-span-4 rounded-md border border-white/10 bg-gradient-to-br from-[#2E2E38] to-[#24242C] p-8">
          <Scale className="h-6 w-6 text-[#0047FF]" />
          <div className="mt-4 text-[10px] uppercase tracking-widest text-[#F0E9D6]/50 font-mono-data">Jurisdiction</div>
          <div className="mt-2 font-display text-3xl text-[#F0E9D6]">{result.region_name}</div>
          <div className="mt-1 text-sm text-[#F0E9D6]/65">{result.doctrine}</div>

          <div className="mt-6 space-y-3">
            <RegionLine label="Lyric verdict" verdict={result.lyric_verdict} threshold={result.lyric_threshold} val={result.top_lyric_similarity} />
            <RegionLine label="Melody verdict" verdict={result.melody_verdict} threshold={result.melody_threshold} val={result.top_melody_similarity} />
          </div>

          <p className="mt-6 text-xs text-[#F0E9D6]/50 leading-relaxed">{result.regional_notes}</p>
        </div>

        {/* Fingerprint engine results */}
        {fpBlock && (
          <div className="lg:col-span-12 rounded-md border border-white/10 bg-[#24242C] p-6" data-testid="scan-fingerprint-panel">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-[#F0E9D6]/50 font-mono-data">Fingerprint engine · {fpEngine}</div>
                <h3 className="font-display text-2xl text-[#F0E9D6] mt-1">
                  {fpBlock.match_count > 0
                    ? `${fpBlock.match_count} commercial match${fpBlock.match_count === 1 ? "" : "es"} found`
                    : "No commercial matches"}
                </h3>
              </div>
              <div className={`rounded-full border px-3 py-1 text-xs font-mono-data uppercase tracking-widest ${
                fpBlock.status_code === 0 ? "border-red-400/40 bg-red-400/10 text-[#D4FF00]" :
                fpBlock.status_code === 1001 ? "border-emerald-400/40 bg-emerald-400/10 text-[#0047FF]" :
                "border-zinc-400/40 bg-zinc-400/10 text-[#F0E9D6]/85"
              }`}>
                {fpBlock.status_msg}
              </div>
            </div>
            {fpBlock.matches?.length > 0 ? (
              <div className="grid gap-3">
                {fpBlock.matches.map((t, i) => (
                  <div key={t.mbid || t.acoustid || t.acrid || `fp-${i}-${t.title}`} data-testid="scan-fingerprint-match" className="rounded-md border border-red-400/30 bg-red-400/5 p-4">
                    <div className="grid gap-2 sm:grid-cols-12 items-center">
                      <div className="sm:col-span-5">
                        <div className="font-display text-lg text-[#F0E9D6]">{t.title}</div>
                        <div className="text-xs text-[#F0E9D6]/65 font-mono-data uppercase tracking-widest">{t.artist} · {t.album || "—"}</div>
                      </div>
                      <div className="sm:col-span-4 text-xs text-[#F0E9D6]/50 font-mono-data">
                        {t.isrc ? <div>ISRC: <span className="text-[#F0E9D6]/85">{t.isrc}</span></div> : t.mbid ? <div>MusicBrainz: <span className="text-[#F0E9D6]/85">{t.mbid.slice(0, 13)}…</span></div> : null}
                        <div>Source: <span className="text-[#F0E9D6]/85">{t.source || t.label || "n/a"}</span></div>
                      </div>
                      <div className="sm:col-span-3 text-right">
                        <div className="text-[10px] uppercase tracking-widest text-[#F0E9D6]/50 font-mono-data">Match score</div>
                        <div className="font-mono-data text-2xl text-[#F0E9D6]">{t.confidence}%</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#F0E9D6]/50">
                {fpBlock.status_code === 1001
                  ? "No matches in the open AcoustID/MusicBrainz catalog. This is expected for unreleased / draft tracks."
                  : fpBlock.status_msg}
              </p>
            )}
          </div>
        )}

        {/* AI lyric analysis */}
        {result.lyric_analysis && (
          <div className="lg:col-span-12 rounded-md border border-white/10 bg-[#24242C] p-6" data-testid="scan-lyric-analysis-panel">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-[#F0E9D6]/50 font-mono-data">Lyric engine · {result.lyric_analysis.engine}</div>
                <h3 className="font-display text-2xl text-[#F0E9D6] mt-1">AI semantic analysis</h3>
              </div>
              <div className="flex items-center gap-4">
                {result.lyric_analysis.candidates_checked > 0 && (
                  <span className="text-xs font-mono-data text-[#F0E9D6]/50 uppercase tracking-widest">{result.lyric_analysis.candidates_checked} Genius candidate{result.lyric_analysis.candidates_checked === 1 ? "" : "s"} checked</span>
                )}
                {result.lyric_analysis.originality_score != null && (
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-widest text-[#F0E9D6]/50 font-mono-data">Originality</div>
                    <div data-testid="scan-originality-score" className="font-mono-data text-2xl text-[#D4FF00]">{result.lyric_analysis.originality_score}%</div>
                  </div>
                )}
              </div>
            </div>
            {result.lyric_analysis.ok ? (
              <p data-testid="scan-lyric-summary" className="text-sm leading-relaxed text-[#F0E9D6]/85">{result.lyric_analysis.summary}</p>
            ) : (
              <p className="text-sm text-[#F0E9D6]/50">AI lyric analysis unavailable: {result.lyric_analysis.error || "unknown error"}</p>
            )}
          </div>
        )}

        {/* Verification badge share panel */}
        {badgeId && (
          <div className="lg:col-span-12 rounded-md border border-[#D4FF00]/25 bg-[#24242C] p-6" data-testid="scan-badge-panel">
            <div className="mb-4">
              <div className="text-[10px] uppercase tracking-widest text-[#F0E9D6]/50 font-mono-data">Public verification</div>
              <h3 className="font-display text-2xl text-[#F0E9D6] mt-1">Verified by SonicCheck badge</h3>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="flex items-center justify-center rounded-md border border-white/10 bg-[#1C1C22] p-6">
                <img src={`${API}/verify/${badgeId}/badge.svg`} alt="Verified by SonicCheck badge" data-testid="scan-badge-preview" />
              </div>
              <div className="space-y-3">
                <CopyField label="Public link" testId="scan-badge-link" value={`${window.location.origin}/verify/${badgeId}`} />
                <CopyField label="Embed (HTML)" testId="scan-badge-embed-html" value={`<a href="${window.location.origin}/verify/${badgeId}"><img src="${API}/verify/${badgeId}/badge.svg" alt="Verified by SonicCheck" /></a>`} />
                <CopyField label="Markdown" testId="scan-badge-embed-md" value={`[![Verified by SonicCheck](${API}/verify/${badgeId}/badge.svg)](${window.location.origin}/verify/${badgeId})`} />
              </div>
            </div>
          </div>
        )}

        {/* Waveform */}
        {result.scan_modes?.audio && (
          <div className="lg:col-span-12 rounded-md border border-white/10 bg-[#24242C] p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-[#F0E9D6]/50 font-mono-data">Audio segments</div>
                <h3 className="font-display text-2xl text-[#F0E9D6] mt-1">Waveform analysis</h3>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono-data text-[#F0E9D6]/65">
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-blue-500" /> Clean</div>
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-red-500" /> Flagged</div>
              </div>
            </div>
            <Waveform bars={result.waveform || []} flagged={result.flagged_segments || []} height={140} />
            {scan.audio_storage_path ? (
              audioUrl ? (
                <div className="mt-4" data-testid="scan-audio-player">
                  <div className="mb-2 text-[10px] uppercase tracking-widest text-[#F0E9D6]/50 font-mono-data">Stored audio · {scan.audio_filename || "your upload"}</div>
                  <audio controls src={audioUrl} className="w-full" style={{ filter: "invert(0.9) hue-rotate(180deg)" }} />
                </div>
              ) : (
                <div className="mt-4 text-xs text-[#F0E9D6]/50 font-mono-data">Loading stored audio…</div>
              )
            ) : (
              user?.plan === "free" && (
                <div data-testid="scan-audio-upsell" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#0047FF]/25 bg-[#0047FF]/5 px-4 py-3">
                  <span className="text-xs text-[#F0E9D6]/65">Audio was analyzed but not stored — permanent audio storage &amp; playback is a Pro feature.</span>
                  <Link to="/pricing" className="text-xs font-mono-data uppercase tracking-widest text-[#D4FF00] hover:underline">Upgrade →</Link>
                </div>
              )
            )}
          </div>
        )}

        {/* Matches */}
        <div className="lg:col-span-12 rounded-md border border-white/10 bg-[#24242C] p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-[#F0E9D6]/50 font-mono-data">Reference matches</div>
              <h3 className="font-display text-2xl text-[#F0E9D6] mt-1">{result.matches?.length || 0} works examined</h3>
            </div>
          </div>
          <div className="grid gap-3">
            {(result.matches || []).map((m) => (
              <div key={m.reference_id} data-testid={SCAN.matchRow} className="rounded-md border border-white/10 bg-[#24242C] p-5">
                <div className="grid gap-4 sm:grid-cols-12 items-center">
                  <div className="sm:col-span-4">
                    <div className="font-display text-lg text-[#F0E9D6]">{m.reference_title}</div>
                    <div className="text-xs text-[#F0E9D6]/50 font-mono-data uppercase tracking-widest">{m.reference_artist} · {m.reference_year}</div>
                  </div>
                  <div className="sm:col-span-6 space-y-2">
                    <Bar label="Lyric" v={m.lyric_similarity} t={result.lyric_threshold} />
                    <Bar label="Melodic" v={m.melodic_similarity} t={result.melody_threshold} />
                    <Bar label="Chords" v={m.chord_progression_similarity} t={result.melody_threshold} />
                  </div>
                  <div className="sm:col-span-2 text-right">
                    <div className="text-[10px] uppercase tracking-widest text-[#F0E9D6]/50 font-mono-data">Confidence</div>
                    <div className="font-mono-data text-3xl text-[#F0E9D6]">{Math.round(m.confidence * 100)}%</div>
                  </div>
                </div>
                {m.matched_snippet && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
                    <div className="rounded-md border border-white/10 bg-[#24242C] p-3 font-mono-data text-[#F0E9D6]/85">
                      <div className="mb-1 text-[10px] uppercase tracking-widest text-[#F0E9D6]/50">Their lyric</div>
                      &ldquo;{m.matched_snippet}&rdquo;
                    </div>
                    <div className="rounded-md border border-white/10 bg-[#24242C] p-3 font-mono-data text-[#F0E9D6]/85">
                      <div className="mb-1 text-[10px] uppercase tracking-widest text-[#F0E9D6]/50">Your snippet</div>
                      &ldquo;{m.your_snippet}&rdquo;
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CopyField({ label, value, testId }) {
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed — select and copy manually");
    }
  };
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-widest text-[#F0E9D6]/50 font-mono-data">{label}</div>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={value}
          data-testid={testId}
          className="h-9 w-full rounded-md border border-white/10 bg-[#1C1C22] px-3 font-mono-data text-xs text-[#F0E9D6]/85"
          onFocus={(e) => e.target.select()}
        />
        <Button data-testid={`${testId}-copy-btn`} onClick={onCopy} variant="ghost" className="h-9 px-3 text-[#F0E9D6]/85 hover:bg-white/10 hover:text-[#F0E9D6]">
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function Metric({ label, val, threshold, suffix = "%" }) {
  const over = threshold != null && val > threshold;
  return (
    <div className="rounded-md border border-white/10 bg-[#24242C] p-4">
      <div className="text-[10px] uppercase tracking-widest text-[#F0E9D6]/50 font-mono-data">{label}</div>
      <div className={`mt-2 font-mono-data text-3xl ${over ? "text-[#D4FF00]" : "text-[#F0E9D6]"}`}>{val}{suffix}</div>
      {threshold != null && <div className="mt-1 text-xs text-[#F0E9D6]/50 font-mono-data">Limit: {threshold}%</div>}
    </div>
  );
}

function RegionLine({ label, verdict, threshold, val }) {
  const ok = verdict !== "VIOLATION";
  return (
    <div className="flex items-center justify-between rounded-md border border-white/10 bg-[#24242C] px-3 py-2">
      <span className="text-sm text-[#F0E9D6]/85">{label}</span>
      <span className={`font-mono-data text-xs uppercase tracking-widest ${ok ? "text-[#0047FF]" : "text-[#D4FF00]"}`}>
        {val}% / {threshold}% · {verdict === "VIOLATION" ? "OVER" : "OK"}
      </span>
    </div>
  );
}

function Bar({ label, v, t }) {
  const over = t != null && v > t;
  const pct = Math.min(100, v * 3);
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-[#F0E9D6]/65">
        <span>{label}</span>
        <span className="font-mono-data">{v}%{t != null ? ` / ${t}%` : ""}</span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-white/5">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: over ? "#D4FF00" : "#0047FF" }} />
      </div>
    </div>
  );
}
