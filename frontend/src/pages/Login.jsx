import { SignIn } from "@clerk/react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { safeAppRedirect } from "@/lib/safeAppRedirect.mjs";

const clerkAppearance = {
  variables: {
    colorBackground: "#141e2b",
    colorText: "#f3f2eb",
    colorPrimary: "#bcebd8",
    colorInputBackground: "#101216",
    colorInputText: "#f3f2eb",
    borderRadius: "0.6rem",
  },
  elements: {
    cardBox: "shadow-none",
    card: "border border-white/10 shadow-none",
    footerActionLink: "text-[#bcebd8]",
  },
};

export default function Login() {
  const { authConfigured, isSignedIn, loading } = useAuth();
  const [params] = useSearchParams();
  const redirect = safeAppRedirect(params.get("redirect"));

  if (authConfigured && isSignedIn) {
    return <Navigate to={redirect} replace />;
  }

  return (
    <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl gap-12 px-6 py-14 lg:grid-cols-2 lg:items-center lg:gap-24">
      <div>
        <div className="eyebrow">Your evidence studio</div>
        <h1 className="mt-4 font-display text-6xl text-[#f3f2eb]">Welcome<br />back.</h1>
        <p className="mt-6 max-w-lg text-lg leading-8 text-[#f3f2eb]/70">
          Return to your evidence records, private library and creative work.
        </p>
        <p className="mt-8 text-sm text-[#f3f2eb]/70">Need an account? <Link to="/join" className="text-[#bcebd8] hover:underline">Join SONIC CHECK</Link></p>
      </div>

      <div className="flex min-h-[520px] items-center justify-center rounded-2xl border border-white/10 bg-[#122b40] p-5 sm:p-8">
        {authConfigured ? (
          loading ? (
            <div className="font-mono-data text-sm text-[#f3f2eb]/70">Completing secure sign-in…</div>
          ) : (
            <SignIn
              routing="hash"
              withSignUp={true}
              signUpUrl="/join"
              fallbackRedirectUrl={redirect}
              forceRedirectUrl={redirect}
              signUpFallbackRedirectUrl={redirect}
              signUpForceRedirectUrl={redirect}
              appearance={clerkAppearance}
            />
          )
        ) : (
          <div className="max-w-md text-center">
            <h2 className="font-display text-3xl text-[#f3f2eb]">Account access is not configured.</h2>
            <p className="mt-4 leading-7 text-[#f3f2eb]/70">The Clerk publishable key must be added to this deployment before private-beta sessions can open.</p>
          </div>
        )}
      </div>
    </main>
  );
}
