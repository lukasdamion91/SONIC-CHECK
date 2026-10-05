import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, CreditCard, Loader2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import CommercialLicenseNotice from "@/components/CommercialLicenseNotice";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { commercialLicenseState } from "@/lib/productContract.mjs";

const aud = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

function cadence(plan) {
  if (plan.billing_interval === "one-time") return "one time";
  return `per ${plan.billing_interval}`;
}

export default function Pricing() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [plans, setPlans] = useState([]);
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState("");
  const [includeReport, setIncludeReport] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.allSettled([api.get("/product-contract"), api.get("/plans")])
      .then(([contractResult, plansResult]) => {
        if (!active) return;
        const nextContract = contractResult.status === "fulfilled"
          ? contractResult.value.data
          : null;
        const nextPlans = nextContract?.pricing?.plans
          || (plansResult.status === "fulfilled" ? plansResult.value.data : null);
        if (nextContract) setContract(nextContract);
        if (Array.isArray(nextPlans)) {
          setPlans(nextPlans);
        } else {
          const requestError = contractResult.status === "rejected"
            ? contractResult.reason
            : plansResult.reason;
          setError(formatApiErrorDetail(requestError?.response?.data?.detail));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const licenseState = useMemo(() => commercialLicenseState(contract), [contract]);
  const checkoutOpen = useMemo(
    () => licenseState.checkoutOpen && plans.some((plan) => plan.checkout_enabled),
    [licenseState.checkoutOpen, plans],
  );
  const hasSubscription = ["pro_monthly", "pro_annual", "enterprise_annual"].includes(user?.plan);

  const beginCheckout = async (plan) => {
    if (!checkoutOpen || !plan.checkout_enabled || plan.sales_only) return;
    setStarting(plan.id);
    try {
      const { data } = await api.post("/checkout/session", {
        plan_id: plan.id,
        origin_url: window.location.origin,
        include_report: plan.id === "single_scan" && includeReport,
      });
      window.location.assign(data.url);
    } catch (requestError) {
      toast.error(formatApiErrorDetail(requestError?.response?.data?.detail));
      setStarting("");
    }
  };

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const { data } = await api.post("/checkout/portal", { origin_url: window.location.origin });
      window.location.assign(data.url);
    } catch (requestError) {
      toast.error(formatApiErrorDetail(requestError?.response?.data?.detail));
      setPortalLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-14">
      <div className="flex flex-wrap items-end justify-between gap-7">
        <div>
          <div className="eyebrow">Plan &amp; billing</div>
          <h1 className="mt-4 font-display text-5xl text-[#f3f2eb] sm:text-6xl">Your plan. Your workspace.</h1>
          <p className="mt-5 max-w-2xl leading-7 text-[#f3f2eb]/70">Review your current access, available plans and report credits. All prices are in Australian dollars.</p>
        </div>
        {hasSubscription && (
          <Button onClick={openPortal} disabled={portalLoading} variant="outline" className="border-white/15 bg-transparent text-[#f3f2eb] hover:bg-white/10">
            {portalLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
            Manage subscription
          </Button>
        )}
      </div>

      {params.get("reason") === "entitlement" && (
        <div className="mt-8 flex gap-3 rounded-xl border border-[#bcebd8]/25 bg-[#bcebd8]/5 p-4 text-sm text-[#f3f2eb]/72">
          <LockKeyhole className="h-5 w-5 shrink-0 text-[#bcebd8]" />
          This account cannot create a new evidence screen. Historical owner-scoped records remain available; current access and checkout gates are shown below.
        </div>
      )}

      <div className="mt-6 rounded-xl border border-white/10 bg-[#122b40] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#f3f2eb]/70 font-mono-data">Current account</div>
            <div className="mt-1 text-sm text-[#f3f2eb]">{user?.email} · {user?.plan || "account"}</div>
          </div>
          <div className="text-xs text-[#f3f2eb]/70 font-mono-data">Scan credits: {user?.scan_credits || 0} · Report credits: {user?.report_credits || 0}</div>
        </div>
      </div>

      <CommercialLicenseNotice contract={contract} className="mt-6" />

      {error && <div className="mt-8 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200">{error}</div>}
      {loading ? (
        <div className="grid min-h-[320px] place-items-center text-[#f3f2eb]/70"><Loader2 className="h-7 w-7 animate-spin" /></div>
      ) : (
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => {
            const current = user?.plan === plan.id;
            const disabled = !checkoutOpen || !plan.checkout_enabled || Boolean(plan.sales_only) || current;
            return (
              <article key={plan.id} className={`flex flex-col rounded-xl border p-6 ${current ? "border-[#bcebd8]/35 bg-[#bcebd8]/5" : "border-white/10 bg-[#141e2b]"}`}>
                <div className="text-xs uppercase tracking-[0.16em] text-[#f3f2eb]/70 font-mono-data">{plan.name}</div>
                <div className="mt-6 text-4xl font-semibold text-[#f3f2eb]">{aud.format(plan.price)}</div>
                <div className="mt-1 text-xs text-[#f3f2eb]/70">AUD · {cadence(plan)}</div>
                {plan.id === "single_scan" && (
                  <label
                    aria-disabled={!checkoutOpen || !plan.checkout_enabled}
                    className={`mt-5 flex items-center gap-2 rounded-lg border border-white/10 bg-black/10 p-3 text-xs ${checkoutOpen && plan.checkout_enabled ? "text-[#f3f2eb]/70" : "text-[#f3f2eb]/70"}`}
                  >
                    <Checkbox
                      checked={includeReport}
                      disabled={!checkoutOpen || !plan.checkout_enabled}
                      onCheckedChange={(checked) => setIncludeReport(checked === true)}
                    />
                    Add detailed PDF report ({aud.format(plan.report_addon_price || 5)})
                  </label>
                )}
                <ul className="mt-6 flex-1 space-y-3 text-sm leading-5 text-[#f3f2eb]/70">
                  {plan.features.map((feature) => <li key={feature} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#bcebd8]" />{feature}</li>)}
                </ul>
                <Button
                  onClick={() => beginCheckout(plan)}
                  disabled={disabled || Boolean(starting)}
                  className="mt-8 w-full bg-[#bcebd8] text-[#101216] hover:bg-[#bcebd8]/85 disabled:bg-white/10 disabled:text-[#f3f2eb]/40"
                >
                  {starting === plan.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {current ? "Current plan" : !checkoutOpen ? "Paid checkout closed" : plan.sales_only ? "Organisation review required" : plan.checkout_enabled ? "Continue to secure checkout" : "Checkout gated"}
                </Button>
              </article>
            );
          })}
        </div>
      )}

      <p className="mt-8 text-xs leading-5 text-[#f3f2eb]/70">
        All amounts are Australian dollars. Candidate-evidence screening supports qualified human review and does not provide a legal conclusion or ownership decision.
      </p>
    </main>
  );
}
