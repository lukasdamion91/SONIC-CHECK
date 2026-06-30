import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [status, setStatus] = useState("polling"); // polling | paid | failed | expired
  const attempts = useRef(0);

  useEffect(() => {
    if (!sessionId) {
      navigate("/pricing");
      return;
    }
    let cancelled = false;

    const poll = async () => {
      try {
        const { data } = await api.get(`/checkout/status/${sessionId}`);
        if (cancelled) return;
        if (data.payment_status === "paid") {
          setStatus("paid");
          await refresh();
          toast.success("Plan activated!");
          return;
        }
        if (data.status === "expired") {
          setStatus("expired");
          return;
        }
        attempts.current += 1;
        if (attempts.current >= 12) {
          setStatus("failed");
          return;
        }
        setTimeout(poll, 2000);
      } catch (e) {
        if (cancelled) return;
        toast.error(formatApiErrorDetail(e.response?.data?.detail));
        setStatus("failed");
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [sessionId, navigate, refresh]);

  return (
    <div className="mx-auto grid min-h-[60vh] max-w-2xl place-items-center px-6 py-12 text-center">
      <div className="w-full rounded-md border border-white/10 bg-[#121216] p-12">
        {status === "polling" && (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-blue-400" />
            <h1 className="mt-6 font-display text-4xl text-white">Confirming payment…</h1>
            <p className="mt-3 text-zinc-400">This usually takes a few seconds.</p>
          </>
        )}
        {status === "paid" && (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
            <h1 className="mt-6 font-display text-4xl text-white">Plan activated.</h1>
            <p className="mt-3 text-zinc-400">Welcome to the studio. Run unlimited scans now.</p>
            <Button onClick={() => navigate("/dashboard")} className="mt-8 h-11 rounded-md bg-white px-6 text-black btn-lift hover:bg-zinc-200">Go to dashboard</Button>
          </>
        )}
        {(status === "failed" || status === "expired") && (
          <>
            <AlertCircle className="mx-auto h-10 w-10 text-amber-400" />
            <h1 className="mt-6 font-display text-4xl text-white">Payment {status}</h1>
            <p className="mt-3 text-zinc-400">Please try again or contact support.</p>
            <Button onClick={() => navigate("/pricing")} className="mt-8 h-11 rounded-md bg-white px-6 text-black btn-lift hover:bg-zinc-200">Back to pricing</Button>
          </>
        )}
      </div>
    </div>
  );
}
