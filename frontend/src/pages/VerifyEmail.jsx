import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { MailCheck, MailX, Loader2 } from "lucide-react";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [status, setStatus] = useState("verifying"); // verifying | success | error
  const [message, setMessage] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token. Use the link from your verification email.");
      return;
    }
    api.post("/auth/verify-email", { token })
      .then((r) => {
        setStatus("success");
        setMessage(`${r.data.email} is now verified.`);
      })
      .catch((e) => {
        setStatus("error");
        setMessage(formatApiErrorDetail(e.response?.data?.detail) || "Verification failed.");
      });
  }, [token]);

  return (
    <div className="mx-auto max-w-lg px-6 py-24 text-center" data-testid="verify-email-page">
      <div className="rounded-md border border-white/10 bg-[#24242C] p-12">
        {status === "verifying" && (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-[#0047FF]" />
            <h1 className="mt-6 font-display text-3xl text-[#F0E9D6]">Verifying your email…</h1>
          </>
        )}
        {status === "success" && (
          <>
            <MailCheck className="mx-auto h-10 w-10 text-[#D4FF00]" />
            <h1 className="mt-6 font-display text-3xl text-[#F0E9D6]">Email verified</h1>
            <p data-testid="verify-email-message" className="mt-3 text-[#F0E9D6]/65">{message}</p>
            <Link to="/dashboard" className="mt-8 inline-block">
              <Button data-testid="verify-email-dashboard-btn" className="h-11 rounded-md bg-[#D4FF00] px-6 text-[#1C1C22] btn-lift hover:bg-[#D4FF00]/85">Go to dashboard</Button>
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <MailX className="mx-auto h-10 w-10 text-red-400" />
            <h1 className="mt-6 font-display text-3xl text-[#F0E9D6]">Verification failed</h1>
            <p data-testid="verify-email-message" className="mt-3 text-[#F0E9D6]/65">{message}</p>
            <Link to="/dashboard" className="mt-8 inline-block">
              <Button variant="outline" className="h-11 rounded-md border-white/15 px-6 text-[#F0E9D6] hover:bg-white/5">Back to dashboard</Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
