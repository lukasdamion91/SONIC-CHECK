import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Waveform from "@/components/Waveform";
import { SCAN } from "@/constants/testIds";
import { AlertTriangle, Check, AlertCircle, Trash2, ArrowLeft, Scale } from "lucide-react";
import { toast } from "sonner";

const verdictMap = {
  CLEAR: { color: "text-emerald-300 border-emerald-400/40 bg-emerald-400/10", icon: Check, label: "CLEAR" },
  REVIEW: { color: "text-amber-300 border-amber-400/40 bg-amber-400/10", icon: AlertCircle, label: "REVIEW" },
  VIOLATION: { color: "text-red-300 border-red-400/40 bg-red-400/10", icon: AlertTriangle, label: "VIOLATION" },
};

export default function ScanResult() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [scan, setScan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/scans/${id}`).then((r) => setScan(r.data)).catch((e) => {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
      navigate("/dashboard");
    }).finally(() => setLoading(false));
  }, [id, navigate]);

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

  if (loading) return <div className="mx-auto max-w-5xl px-6 py-20 text-center text-zinc-500 font-mono-data">Loading scan…</div>;
  if (!scan) return null;

  const result = scan.result || {};
  const V = verdictMap[result.verdict] || verdictMap.REVIEW;

  return (
    <div className="mx-auto max-w-7xl px-6 py-12" data-testid={SCAN.resultCard}>
      <div className="mb-8 flex items-center justify-between">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
        <Button
          data-testid={SCAN.deleteBtn}
          onClick={onDelete}
          variant="ghost"
          className="text-red-300 hover:bg-red-500/10 hover:text-red-200"
        >
          <Trash2 className="mr-2 h-4 w-4" /> Delete scan
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Headline */}
        <div className="lg:col-span-8 rounded-md border border-white/10 bg-[#121216] p-8">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono-data">Track</div>
          <h1 className="font-display text-5xl text-white mt-2">{scan.title}</h1>
          <div className="mt-2 text-zinc-400">{scan.artist_name || "—"}</div>
          <div className="mt-8 flex flex-wrap items-end gap-8">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono-data">Overall plagiarism score</div>
              <div data-testid={SCAN.overallScore} className="font-mono-data text-[88px] leading-none text-white">{result.overall_score}<span className="text-3xl text-zinc-500">%</span></div>
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
        <div className="lg:col-span-4 rounded-md border border-white/10 bg-gradient-to-br from-[#1A1A20] to-[#121216] p-8">
          <Scale className="h-6 w-6 text-blue-400" />
          <div className="mt-4 text-[10px] uppercase tracking-widest text-zinc-500 font-mono-data">Jurisdiction</div>
          <div className="mt-2 font-display text-3xl text-white">{result.region_name}</div>
          <div className="mt-1 text-sm text-zinc-400">{result.doctrine}</div>

          <div className="mt-6 space-y-3">
            <RegionLine label="Lyric verdict" verdict={result.lyric_verdict} threshold={result.lyric_threshold} val={result.top_lyric_similarity} />
            <RegionLine label="Melody verdict" verdict={result.melody_verdict} threshold={result.melody_threshold} val={result.top_melody_similarity} />
          </div>

          <p className="mt-6 text-xs text-zinc-500 leading-relaxed">{result.regional_notes}</p>
        </div>

        {/* Waveform */}
        {result.scan_modes?.audio && (
          <div className="lg:col-span-12 rounded-md border border-white/10 bg-[#121216] p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono-data">Audio segments</div>
                <h3 className="font-display text-2xl text-white mt-1">Waveform analysis</h3>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono-data text-zinc-400">
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-blue-500" /> Clean</div>
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-red-500" /> Flagged</div>
              </div>
            </div>
            <Waveform bars={result.waveform || []} flagged={result.flagged_segments || []} height={140} />
          </div>
        )}

        {/* Matches */}
        <div className="lg:col-span-12 rounded-md border border-white/10 bg-[#121216] p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono-data">Reference matches</div>
              <h3 className="font-display text-2xl text-white mt-1">{result.matches?.length || 0} works examined</h3>
            </div>
          </div>
          <div className="grid gap-3">
            {(result.matches || []).map((m) => (
              <div key={m.reference_id} data-testid={SCAN.matchRow} className="rounded-md border border-white/10 bg-[#0F0F14] p-5">
                <div className="grid gap-4 sm:grid-cols-12 items-center">
                  <div className="sm:col-span-4">
                    <div className="font-display text-lg text-white">{m.reference_title}</div>
                    <div className="text-xs text-zinc-500 font-mono-data uppercase tracking-widest">{m.reference_artist} · {m.reference_year}</div>
                  </div>
                  <div className="sm:col-span-6 space-y-2">
                    <Bar label="Lyric" v={m.lyric_similarity} t={result.lyric_threshold} />
                    <Bar label="Melodic" v={m.melodic_similarity} t={result.melody_threshold} />
                    <Bar label="Chords" v={m.chord_progression_similarity} t={result.melody_threshold} />
                  </div>
                  <div className="sm:col-span-2 text-right">
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono-data">Confidence</div>
                    <div className="font-mono-data text-3xl text-white">{Math.round(m.confidence * 100)}%</div>
                  </div>
                </div>
                {m.matched_snippet && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
                    <div className="rounded-md border border-white/10 bg-[#121216] p-3 font-mono-data text-zinc-300">
                      <div className="mb-1 text-[10px] uppercase tracking-widest text-zinc-500">Their lyric</div>
                      &ldquo;{m.matched_snippet}&rdquo;
                    </div>
                    <div className="rounded-md border border-white/10 bg-[#121216] p-3 font-mono-data text-zinc-300">
                      <div className="mb-1 text-[10px] uppercase tracking-widest text-zinc-500">Your snippet</div>
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

function Metric({ label, val, threshold, suffix = "%" }) {
  const over = threshold != null && val > threshold;
  return (
    <div className="rounded-md border border-white/10 bg-[#0F0F14] p-4">
      <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono-data">{label}</div>
      <div className={`mt-2 font-mono-data text-3xl ${over ? "text-red-300" : "text-white"}`}>{val}{suffix}</div>
      {threshold != null && <div className="mt-1 text-xs text-zinc-500 font-mono-data">Limit: {threshold}%</div>}
    </div>
  );
}

function RegionLine({ label, verdict, threshold, val }) {
  const ok = verdict !== "VIOLATION";
  return (
    <div className="flex items-center justify-between rounded-md border border-white/10 bg-[#0F0F14] px-3 py-2">
      <span className="text-sm text-zinc-300">{label}</span>
      <span className={`font-mono-data text-xs uppercase tracking-widest ${ok ? "text-emerald-300" : "text-red-300"}`}>
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
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>{label}</span>
        <span className="font-mono-data">{v}%{t != null ? ` / ${t}%` : ""}</span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-white/5">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: over ? "#EF4444" : "#3B82F6" }} />
      </div>
    </div>
  );
}
