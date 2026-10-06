import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, FileClock, FileSearch, Loader2, ShieldCheck } from "lucide-react";
import ResonanceSymbol from "@/components/ResonanceSymbol";
import { Button } from "@/components/ui/button";
import { hasScanEntitlement, useAuth } from "@/context/AuthContext";
import { api, formatApiErrorDetail } from "@/lib/api";
import { resolveAccessPolicy, scanDenialCopy } from "@/lib/accessPolicy.mjs";

const statusCopy = {
  REVIEW_REQUIRED: { label: "Candidate evidence", className: "border-amber-300/25 bg-amber-300/5 text-amber-200" },
  NO_CANDIDATE_IDENTIFIED: { label: "No candidate identified", className: "border-sky-300/25 bg-sky-300/5 text-sky-200" },
  INCONCLUSIVE: { label: "Inconclusive", className: "border-white/15 bg-white/5 text-[#f3f2eb]/70" },
};

function statusFor(scan) {
  const status = scan?.result?.screening_status;
  if (statusCopy[status]) return statusCopy[status];
  return { label: "Legacy evidence record", className: "border-white/15 bg-white/5 text-[#f3f2eb]/70" };
}

function Stat({ label, value, note }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#141e2b] p-5">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[#f3f2eb]/70 font-mono-data">{label}</div>
      <div className="sc-product-stat-value mt-3 text-4xl font-semibold text-[#f3f2eb]">{value}</div>
      <div className="mt-1 text-xs text-[#f3f2eb]/70">{note}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const entitled = hasScanEntitlement(user);
  const accessPolicy = resolveAccessPolicy(user);

  useEffect(() => {
    api.get("/scans")
      .then(({ data }) => setScans(data))
      .catch((requestError) => setError(formatApiErrorDetail(requestError?.response?.data?.detail)))
      .finally(() => setLoading(false));
  }, []);

  const metrics = useMemo(() => ({
    review: scans.filter((scan) => scan.result?.screening_status === "REVIEW_REQUIRED").length,
    noCandidate: scans.filter((scan) => scan.result?.screening_status === "NO_CANDIDATE_IDENTIFIED").length,
    inconclusive: scans.filter((scan) => scan.result?.screening_status === "INCONCLUSIVE").length,
  }), [scans]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-14">
      <div className="sc-product-hero">
        <div>
          <div className="eyebrow">Your evidence studio</div>
          <h1 className="mt-4 font-display text-5xl text-[#f3f2eb] sm:text-6xl">Hello, {user?.name || "creator"}.</h1>
          <p className="mt-5 max-w-2xl leading-7 text-[#f3f2eb]/70">A considered space for your creative work. Start a screen, revisit the evidence and keep your source material close.</p>
        <Link to={entitled ? "/app/scan/new" : "/app/billing?reason=entitlement"}>
          <Button className="mt-6 h-11 bg-[#bcebd8] px-6 text-[#101216] hover:bg-[#bcebd8]/85">
            {entitled ? "Start evidence screen" : "Review access status"}<ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
        </div>
        <figure>
          <ResonanceSymbol colours={["#dfbd79", "#bcebd8"]} />
          <figcaption>Resonance · HARRY</figcaption>
        </figure>
      </div>

      <section className="sc-product-stats mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="Evidence records" value={scans.length} note="Up to 100 most recent" />
        <Stat label="Candidate evidence" value={metrics.review} note="Human review required" />
        <Stat label="No candidate" value={metrics.noCandidate} note="Within searched sources only" />
        <Stat label="Inconclusive" value={metrics.inconclusive} note="Unavailable or incomplete sources" />
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-[1.45fr_0.55fr]">
        <div className="rounded-xl border border-white/10 bg-[#122b40] p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="eyebrow">Recent records</div>
              <h2 className="mt-2 text-xl font-semibold text-[#f3f2eb]">Evidence-screen history</h2>
            </div>
            <Link to="/app/library" className="text-sm text-[#9DB8F0] hover:text-[#f3f2eb]">Open library</Link>
          </div>

          {loading ? (
            <div className="grid min-h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-[#f3f2eb]/70" /></div>
          ) : error ? (
            <div className="mt-7 flex gap-3 rounded-lg border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200"><AlertCircle className="h-5 w-5 shrink-0" />{error}</div>
          ) : scans.length === 0 ? (
            <div className="mt-8 rounded-xl border border-dashed border-white/15 p-10 text-center">
              <FileSearch className="mx-auto h-8 w-8 text-[#9DB8F0]" />
              <h3 className="mt-5 text-lg font-semibold text-[#f3f2eb]">No evidence records yet.</h3>
              <p className="mt-2 text-sm text-[#f3f2eb]/70">A completed screen will appear here after it has been stored successfully.</p>
            </div>
          ) : (
            <div className="sc-record-list mt-6 divide-y divide-white/8">
              {scans.slice(0, 8).map((scan) => {
                const state = statusFor(scan);
                const body = (
                  <>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-[#f3f2eb]">{scan.title}</div>
                      <div className="mt-1 text-xs text-[#f3f2eb]/70">{scan.artist_name || "Unknown creator"} · {new Date(scan.created_at).toLocaleDateString("en-AU")}</div>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-widest font-mono-data ${state.className}`}>{state.label}</span>
                  </>
                );
                return <Link key={scan.id} to={`/app/scans/${scan.id}`} className="flex items-center gap-4 py-4 hover:bg-white/[0.02]">{body}</Link>;
              })}
            </div>
          )}
        </div>

        <aside className="space-y-5">
          <div className="rounded-xl border border-white/10 bg-[#141e2b] p-6">
            <ShieldCheck className="h-6 w-6 text-[#bcebd8]" />
            <div className="mt-5 text-[10px] uppercase tracking-widest text-[#f3f2eb]/70 font-mono-data">Account entitlement</div>
            <div className="mt-2 text-2xl font-semibold text-[#f3f2eb]">{user?.plan || "account"}</div>
            <div className="mt-3 text-sm leading-6 text-[#f3f2eb]/70">{entitled ? "A new evidence screen is available for this account." : scanDenialCopy(accessPolicy.scan_denial_reason)}</div>
            <div className="mt-5 border-t border-white/10 pt-4 text-xs text-[#f3f2eb]/70 font-mono-data">Remaining: {accessPolicy.scan_remaining == null ? "unmetered" : accessPolicy.scan_remaining} · Used this period: {user?.scans_used || 0}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#141e2b] p-6">
            <FileClock className="h-6 w-6 text-[#9DB8F0]" />
            <h3 className="mt-5 font-semibold text-[#f3f2eb]">Decision boundary</h3>
            <p className="mt-3 text-sm leading-6 text-[#f3f2eb]/70">The application reports candidate evidence and method-specific signals. Every material result requires human review.</p>
          </div>
        </aside>
      </section>
    </main>
  );
}
