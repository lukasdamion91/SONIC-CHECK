import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiErrorDetail } from "@/lib/api";

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [status, setStatus] = useState("polling");
  const attempts = useRef(0);

  useEffect(() => {
    if (!sessionId) {
      navigate("/app/billing", { replace: true });
      return undefined;
    }
    let cancelled = false;
    let timer;

    const poll = async () => {
      try {
        const { data } = await api.get(`/checkout/status/${sessionId}`);
        if (cancelled) return;
        if (["paid", "no_payment_required"].includes(data.payment_status) && data.fulfillment_status === "fulfilled") {
          setStatus("paid");
          await refresh();
          toast.success("Account entitlement activated");
          return;
        }
        if (data.status === "expired") {
          setStatus("expired");
          return;
        }
        attempts.current += 1;
        if (attempts.current >= 15) {
          setStatus("pending");
          return;
        }
        timer = window.setTimeout(poll, 2000);
      } catch (requestError) {
        if (cancelled) return;
        toast.error(formatApiErrorDetail(requestError?.response?.data?.detail));
        setStatus("failed");
      }
    };
    poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [navigate, refresh, sessionId]);

  return (
    <main className="mx-auto grid min-h-[65vh] max-w-2xl place-items-center px-6 py-14 text-center">
      <div className="w-full rounded-2xl border border-white/10 bg-[#202027] p-10 sm:p-12">
        {status === "polling" && <><Loader2 className="mx-auto h-10 w-10 animate-spin text-[#9DB8F0]" /><h1 className="mt-6 font-display text-4xl text-[#F0E9D6]">Confirming entitlement…</h1><p className="mt-3 text-[#F0E9D6]/58">The app is waiting for Stripe settlement and idempotent fulfilment.</p></>}
        {status === "paid" && <><CheckCircle2 className="mx-auto h-10 w-10 text-[#D4FF00]" /><h1 className="mt-6 font-display text-4xl text-[#F0E9D6]">Entitlement active.</h1><p className="mt-3 text-[#F0E9D6]/58">Your available application functionality has been updated.</p><Button onClick={() => navigate("/app")} className="mt-8 bg-[#D4FF00] px-6 text-[#1C1C22] hover:bg-[#D4FF00]/85">Open dashboard</Button></>}
        {["failed", "expired", "pending"].includes(status) && <><AlertCircle className="mx-auto h-10 w-10 text-amber-200" /><h1 className="mt-6 font-display text-4xl text-[#F0E9D6]">Payment {status}.</h1><p className="mt-3 text-[#F0E9D6]/58">No duplicate fulfilment will be applied. Return to billing to review the account state or retry.</p><Button onClick={() => navigate("/app/billing")} className="mt-8 bg-[#D4FF00] px-6 text-[#1C1C22] hover:bg-[#D4FF00]/85">Back to plan &amp; billing</Button></>}
      </div>
    </main>
  );
}
