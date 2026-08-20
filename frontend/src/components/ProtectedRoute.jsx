import { Navigate, useLocation } from "react-router-dom";
import { hasScanEntitlement, useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

function GateMessage({ title, body, action, onAction }) {
  return (
    <div className="mx-auto grid min-h-[62vh] max-w-2xl place-items-center px-6 py-16 text-center">
      <div className="w-full rounded-xl border border-white/10 bg-[#24242C] p-10">
        <div className="mx-auto mb-6 h-1.5 w-24 rounded-full holo-gradient" />
        <h1 className="font-display text-4xl text-[#F0E9D6]">{title}</h1>
        <p className="mx-auto mt-4 max-w-lg text-[#F0E9D6]/65">{body}</p>
        {action && (
          <Button onClick={onAction} className="mt-7 bg-[#D4FF00] text-[#1C1C22] hover:bg-[#D4FF00]/85">
            {action}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function ProtectedRoute({ children }) {
  const { authConfigured, user, loading, error } = useAuth();
  const location = useLocation();

  if (!authConfigured) {
    return (
      <GateMessage
        title="Private beta access is being configured."
        body="This deployment has not received its account publishable key, so account sessions remain closed. The public evidence and pricing contract is still available on the landing page."
      />
    );
  }
  if (loading) {
    return <div className="grid min-h-[60vh] place-items-center font-mono-data text-sm text-[#F0E9D6]/50">Loading account…</div>;
  }
  if (!user && !error) {
    const redirect = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />;
  }
  if (error) {
    return <GateMessage title="Account service unavailable." body={error} action="Try again" onAction={() => window.location.reload()} />;
  }
  return children;
}

export function EntitledRoute({ children }) {
  const { user } = useAuth();
  if (!hasScanEntitlement(user)) return <Navigate to="/app/billing?reason=entitlement" replace />;
  return children;
}
