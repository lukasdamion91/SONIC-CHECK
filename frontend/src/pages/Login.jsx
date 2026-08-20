import { SignIn } from "@clerk/react";
import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const clerkAppearance = {
  variables: {
    colorBackground: "#24242C",
    colorText: "#F0E9D6",
    colorPrimary: "#D4FF00",
    colorInputBackground: "#1C1C22",
    colorInputText: "#F0E9D6",
    borderRadius: "0.6rem",
  },
  elements: {
    cardBox: "shadow-none",
    card: "border border-white/10 shadow-none",
    footerActionLink: "text-[#D4FF00]",
  },
};

function safeRedirect(value) {
  return value?.startsWith("/app") ? value : "/app";
}

export default function Login() {
  const { authConfigured, user } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const redirect = safeRedirect(params.get("redirect"));

  useEffect(() => {
    if (user) navigate(redirect, { replace: true });
  }, [navigate, redirect, user]);

  return (
    <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl gap-12 px-6 py-14 lg:grid-cols-2 lg:items-center lg:gap-24">
      <div>
        <div className="eyebrow">Protected application</div>
        <h1 className="mt-4 font-display text-6xl text-[#F0E9D6]">Welcome<br />back.</h1>
        <p className="mt-6 max-w-lg text-lg leading-8 text-[#F0E9D6]/62">
          Log in through the canonical SONIC CHECK identity flow to reach your evidence records, entitlements, billing and private library.
        </p>
        <p className="mt-8 text-sm text-[#F0E9D6]/50">Need an account? <Link to="/join" className="text-[#D4FF00] hover:underline">Join SONIC CHECK</Link></p>
      </div>

      <div className="flex min-h-[520px] items-center justify-center rounded-2xl border border-white/10 bg-[#202027] p-5 sm:p-8">
        {authConfigured ? (
          <SignIn
            routing="hash"
            signUpUrl="/join"
            fallbackRedirectUrl={redirect}
            forceRedirectUrl={redirect}
            appearance={clerkAppearance}
          />
        ) : (
          <div className="max-w-md text-center">
            <h2 className="font-display text-3xl text-[#F0E9D6]">Account access is not configured.</h2>
            <p className="mt-4 leading-7 text-[#F0E9D6]/60">The Clerk publishable key must be added to this deployment before private-beta sessions can open.</p>
          </div>
        )}
      </div>
    </main>
  );
}
