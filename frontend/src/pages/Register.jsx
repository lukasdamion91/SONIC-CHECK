import { SignUp } from "@clerk/react";
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

export default function Register() {
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
        <div className="eyebrow">Join SONIC CHECK</div>
        <h1 className="mt-4 font-display text-6xl text-[#F0E9D6]">One account.<br />One protected app.</h1>
        <p className="mt-6 max-w-lg text-lg leading-8 text-[#F0E9D6]/62">
          Create your identity first. Inside the application you can select an AUD plan, receive an entitlement and use only the functionality available to your account.
        </p>
        <p className="mt-8 text-sm text-[#F0E9D6]/50">Already joined? <Link to="/login" className="text-[#D4FF00] hover:underline">Log in</Link></p>
      </div>

      <div className="flex min-h-[580px] items-center justify-center rounded-2xl border border-white/10 bg-[#202027] p-5 sm:p-8">
        {authConfigured ? (
          <SignUp
            routing="hash"
            signInUrl="/login"
            fallbackRedirectUrl={redirect}
            forceRedirectUrl={redirect}
            signInFallbackRedirectUrl={redirect}
            signInForceRedirectUrl={redirect}
            appearance={clerkAppearance}
          />
        ) : (
          <div className="max-w-md text-center">
            <h2 className="font-display text-3xl text-[#F0E9D6]">Joining is temporarily closed.</h2>
            <p className="mt-4 leading-7 text-[#F0E9D6]/60">This deployment needs its Clerk publishable key before private-beta account creation can open.</p>
          </div>
        )}
      </div>
    </main>
  );
}
