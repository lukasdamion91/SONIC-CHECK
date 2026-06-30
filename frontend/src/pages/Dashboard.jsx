import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DASH } from "@/constants/testIds";
import { Plus, Music2, AlertTriangle, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const verdictMap = {
  CLEAR: { color: "text-emerald-300 border-emerald-400/40 bg-emerald-400/10", icon: Check, label: "CLEAR" },
  REVIEW: { color: "text-amber-300 border-amber-400/40 bg-amber-400/10", icon: AlertCircle, label: "REVIEW" },
  VIOLATION: { color: "text-red-300 border-red-400/40 bg-red-400/10", icon: AlertTriangle, label: "VIOLATION" },
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

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="mb-2 text-[10px] uppercase tracking-widest text-zinc-500 font-mono-data">Studio dashboard</div>
          <h1 className="font-display text-5xl text-white">Welcome, {user.name?.split(" ")[0] || "Artist"}.</h1>
          <p className="mt-3 max-w-xl text-zinc-400">{scans.length} scan{scans.length === 1 ? "" : "s"} archived · plan quota: {user.scans_used} used</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge data-testid={DASH.planBadge} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-white font-mono-data uppercase tracking-widest">
            {user.plan === "free" ? "Free tier" : user.plan.replace("_", " ")}
          </Badge>
          <div data-testid={DASH.regionSelector}>
            <Select value={user.region} onValueChange={handleRegionChange}>
              <SelectTrigger className="w-[180px] border-white/10 bg-[#121216] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[#121216] text-white">
                {regions.map((r) => (
                  <SelectItem key={r.code} value={r.code}>
                    {r.code} · {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Link to="/scan/new" data-testid={DASH.newScanBtn}>
            <Button className="h-10 rounded-md bg-white text-black btn-lift hover:bg-zinc-200">
              <Plus className="mr-2 h-4 w-4" /> New scan
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total scans" value={scans.length} accent="#3B82F6" />
        <StatCard label="Violations flagged" value={scans.filter((s) => s.result?.verdict === "VIOLATION").length} accent="#EF4444" />
        <StatCard label="Clear releases" value={scans.filter((s) => s.result?.verdict === "CLEAR").length} accent="#10B981" />
      </div>

      <div className="mt-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-2xl text-white">Recent scans</h2>
        </div>
        {loading ? (
          <div className="rounded-md border border-white/10 bg-[#121216] p-12 text-center text-zinc-500 font-mono-data text-sm">Loading…</div>
        ) : scans.length === 0 ? (
          <div data-testid={DASH.emptyState} className="rounded-md border border-dashed border-white/10 bg-[#121216] p-16 text-center">
            <Music2 className="mx-auto h-10 w-10 text-zinc-600" />
            <h3 className="mt-4 font-display text-3xl text-white">No scans yet</h3>
            <p className="mt-2 text-zinc-400">Run your first plagiarism check to see the score, matched references, and regional verdict.</p>
            <Link to="/scan/new" className="mt-6 inline-block">
              <Button className="h-11 rounded-md bg-white px-6 text-black btn-lift hover:bg-zinc-200">Start your first scan</Button>
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
                  className="group grid grid-cols-12 items-center gap-4 rounded-md border border-white/10 bg-[#121216] p-5 transition-colors hover:border-white/20 hover:bg-[#16161B]"
                >
                  <div className="col-span-12 sm:col-span-5">
                    <div className="font-display text-xl text-white">{scan.title}</div>
                    <div className="text-xs text-zinc-500 font-mono-data uppercase tracking-widest">{scan.artist_name || "—"}</div>
                  </div>
                  <div className="col-span-6 sm:col-span-2 font-mono-data text-2xl text-white">
                    {scan.result?.overall_score ?? 0}<span className="text-sm text-zinc-500">%</span>
                  </div>
                  <div className="col-span-6 sm:col-span-2 text-xs text-zinc-400 font-mono-data uppercase tracking-widest">
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
    <div className="rounded-md border border-white/10 bg-[#121216] p-6">
      <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono-data">{label}</div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-mono-data text-5xl text-white">{value}</span>
        <span className="h-3 w-3 rounded-full" style={{ background: accent }} />
      </div>
    </div>
  );
}
