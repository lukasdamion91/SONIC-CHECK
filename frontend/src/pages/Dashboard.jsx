import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DASH } from "@/constants/testIds";
import { Plus, Music2, AlertTriangle, Check, AlertCircle, MailWarning } from "lucide-react";
import { toast } from "sonner";

const verdictMap = {
  CLEAR: { color: "text-[#0047FF] border-emerald-400/40 bg-emerald-400/10", icon: Check, label: "CLEAR" },
  REVIEW: { color: "text-[#F0E9D6] border-amber-400/40 bg-amber-400/10", icon: AlertCircle, label: "REVIEW" },
  VIOLATION: { color: "text-[#D4FF00] border-red-400/40 bg-red-400/10", icon: AlertTriangle, label: "VIOLATION" },
};

export default function Dashboard() {
  const { user, updateRegion } = useAuth();
  const [scans, setScans] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, r] = await Promise.all([api.get("/scans"), api.get("/regions")]);
        setScans(s.data);
        setRegions(r.data);
      } catch (e) {
        toast.error(formatApiErrorDetail(e.response?.data?.detail));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleRegionChange = async (region) => {
    try {
      await updateRegion(region);
      toast.success(`Region set to ${region}`);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const handleResendVerification = async () => {
    try {
      await api.post("/auth/resend-verification");
      toast.success("Verification link sent — it's logged on the server console (free tier)");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      {user.email_verified === false && (
        <div data-testid="dashboard-verify-banner" className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-md border border-[#D4FF00]/30 bg-[#D4FF00]/5 px-5 py-4">
          <div className="flex items-center gap-3">
            <MailWarning className="h-5 w-5 text-[#D4FF00]" />
            <div>
              <div className="text-sm text-[#F0E9D6]">Your email is not verified yet.</div>
              <div className="text-xs text-[#F0E9D6]/50">Check your verification link, or resend it below.</div>
            </div>
          </div>
          <Button data-testid="dashboard-resend-verification-btn" onClick={handleResendVerification} variant="outline" className="h-9 rounded-md border-[#D4FF00]/40 bg-transparent text-[#D4FF00] hover:bg-[#D4FF00]/10 hover:text-[#D4FF00]">
            Resend verification
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="mb-2 text-[10px] uppercase tracking-widest text-[#F0E9D6]/50 font-mono-data">Studio dashboard</div>
          <h1 className="font-display text-5xl text-[#F0E9D6]">Welcome, {user.name?.split(" ")[0] || "Artist"}.</h1>
          <p className="mt-3 max-w-xl text-[#F0E9D6]/65">{scans.length} scan{scans.length === 1 ? "" : "s"} archived · plan quota: {user.scans_used} used</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge data-testid={DASH.planBadge} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[#F0E9D6] font-mono-data uppercase tracking-widest">
            {user.plan === "free" ? "Free tier" : user.plan.replace("_", " ")}
          </Badge>
          <div>
            <Select value={user.region} onValueChange={handleRegionChange}>
              <SelectTrigger data-testid={DASH.regionSelector} className="w-[180px] border-white/10 bg-[#24242C] text-[#F0E9D6]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[#24242C] text-[#F0E9D6]">
                {regions.map((r) => (
                  <SelectItem key={r.code} value={r.code}>
                    {r.code} · {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Link to="/scan/new" data-testid={DASH.newScanBtn}>
            <Button className="h-10 rounded-md bg-[#D4FF00] text-[#1C1C22] btn-lift hover:bg-[#D4FF00]/85">
              <Plus className="mr-2 h-4 w-4" /> New scan
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total scans" value={scans.length} accent="#0047FF" />
        <StatCard label="Violations flagged" value={scans.filter((s) => s.result?.verdict === "VIOLATION").length} accent="#D4FF00" />
        <StatCard label="Clear releases" value={scans.filter((s) => s.result?.verdict === "CLEAR").length} accent="#0047FF" />
      </div>

      <div className="mt-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-2xl text-[#F0E9D6]">Recent scans</h2>
        </div>
        {loading ? (
          <div className="rounded-md border border-white/10 bg-[#24242C] p-12 text-center text-[#F0E9D6]/50 font-mono-data text-sm">Loading…</div>
        ) : scans.length === 0 ? (
          <div data-testid={DASH.emptyState} className="rounded-md border border-dashed border-white/10 bg-[#24242C] p-16 text-center">
            <Music2 className="mx-auto h-10 w-10 text-[#F0E9D6]/35" />
            <h3 className="mt-4 font-display text-3xl text-[#F0E9D6]">No scans yet</h3>
            <p className="mt-2 text-[#F0E9D6]/65">Run your first plagiarism check to see the score, matched references, and regional verdict.</p>
            <Link to="/scan/new" className="mt-6 inline-block">
              <Button className="h-11 rounded-md bg-white px-6 text-black btn-lift hover:bg-[#D4FF00]/85">Start your first scan</Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {scans.map((scan) => {
              const verdict = scan.result?.verdict || "REVIEW";
              const V = verdictMap[verdict];
              return (
                <Link
                  key={scan.id}
                  to={`/scan/${scan.id}`}
                  data-testid={DASH.scanCard}
                  className="group grid grid-cols-12 items-center gap-4 rounded-md border border-white/10 bg-[#24242C] p-5 transition-colors hover:border-white/20 hover:bg-[#2E2E38]"
                >
                  <div className="col-span-12 sm:col-span-5">
                    <div className="font-display text-xl text-[#F0E9D6]">{scan.title}</div>
                    <div className="text-xs text-[#F0E9D6]/50 font-mono-data uppercase tracking-widest">{scan.artist_name || "—"}</div>
                  </div>
                  <div className="col-span-6 sm:col-span-2 font-mono-data text-2xl text-[#F0E9D6]">
                    {scan.result?.overall_score ?? 0}<span className="text-sm text-[#F0E9D6]/50">%</span>
                  </div>
                  <div className="col-span-6 sm:col-span-2 text-xs text-[#F0E9D6]/65 font-mono-data uppercase tracking-widest">
                    {scan.region} · {scan.result?.doctrine}
                  </div>
                  <div className={`col-span-12 sm:col-span-3 inline-flex items-center gap-2 self-start rounded-full border px-3 py-1 text-xs font-mono-data uppercase tracking-widest ${V.color}`}>
                    <V.icon className="h-3 w-3" /> {V.label}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="rounded-md border border-white/10 bg-[#24242C] p-6">
      <div className="text-[10px] uppercase tracking-widest text-[#F0E9D6]/50 font-mono-data">{label}</div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-mono-data text-5xl text-[#F0E9D6]">{value}</span>
        <span className="h-3 w-3 rounded-full" style={{ background: accent }} />
      </div>
    </div>
  );
}
