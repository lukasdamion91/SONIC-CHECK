import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { PRICING } from "@/constants/testIds";
import { Check, Sparkles } from "lucide-react";
import { toast } from "sonner";

const planMeta = {
  artist_pro: { tagline: "For recording artists releasing tracks.", highlight: false, accent: "#0047FF" },
  producer_pro: { tagline: "For working producers and studios.", highlight: true, accent: "#D4FF00" },
  student: { tagline: "For students at conservatories & programs.", highlight: false, accent: "#0047FF" },
};

export default function Pricing() {
  const [plans, setPlans] = useState([]);
  const [loadingPlan, setLoadingPlan] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/plans").then((r) => setPlans(r.data)).catch(() => {});
  }, []);

  const onCheckout = async (planId) => {
    if (!user) return navigate("/login");
    setLoadingPlan(planId);
    try {
      const { data } = await api.post("/checkout/session", {
        plan_id: planId,
        origin_url: window.location.origin,
      });
      window.location.href = data.url;
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
      setLoadingPlan(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-20">
      <div className="text-center">
        <div className="mb-3 text-[10px] uppercase tracking-widest text-[#F0E9D6]/50 font-mono-data">Pricing · USD · monthly</div>
        <h1 className="font-display text-6xl text-[#F0E9D6]">Pick your studio plan.</h1>
        <p className="mx-auto mt-4 max-w-xl text-[#F0E9D6]/65">Free tier is permanently free with 3 lifetime scans. Upgrade only when you are ready to release.</p>
      </div>

      <div className="mt-16 grid gap-5 md:grid-cols-3">
        {plans.map((p) => {
          const meta = planMeta[p.id] || {};
          const isCurrent = user?.plan === p.id;
          return (
            <div
              key={p.id}
              data-testid={PRICING.planCard}
              className={`relative flex flex-col rounded-md border p-8 ${meta.highlight ? "border-white/20 bg-gradient-to-b from-[#2E2E38] to-[#24242C] glow-blue" : "border-white/10 bg-[#24242C]"}`}
            >
              {meta.highlight && (
                <div className="absolute -top-3 left-8 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[10px] font-mono-data uppercase tracking-widest text-black">
                  <Sparkles className="h-3 w-3" /> Most popular
                </div>
              )}
              <h3 className="font-display text-3xl text-[#F0E9D6]">{p.name}</h3>
              <p className="mt-2 text-sm text-[#F0E9D6]/65">{meta.tagline}</p>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="font-mono-data text-5xl text-[#F0E9D6]">${p.price}</span>
                <span className="text-sm text-[#F0E9D6]/50">/ month</span>
              </div>
              <div className="mt-1 text-xs text-[#F0E9D6]/50 font-mono-data uppercase tracking-widest">{p.scans_per_month} scans / month</div>

              <ul className="mt-8 space-y-3 text-sm text-[#F0E9D6]/85 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: meta.accent }} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                data-testid={PRICING.checkoutBtn}
                onClick={() => onCheckout(p.id)}
                disabled={loadingPlan === p.id || isCurrent}
                className={`mt-8 h-11 rounded-md btn-lift ${meta.highlight ? "bg-[#D4FF00] text-[#1C1C22] hover:bg-[#D4FF00]/85" : "border border-white/15 bg-transparent text-[#F0E9D6] hover:bg-white/10"}`}
              >
                {isCurrent ? "Current plan" : loadingPlan === p.id ? "Redirecting…" : `Choose ${p.name}`}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="mt-16 rounded-md border border-white/10 bg-[#24242C] p-8 text-center">
        <p className="text-sm text-[#F0E9D6]/65">Need a label-wide plan or bulk catalog scanning? <a className="text-[#F0E9D6] underline-offset-4 hover:underline" href="mailto:sales@soniccheck.io">Contact sales</a>.</p>
      </div>
    </div>
  );
}
