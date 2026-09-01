import { SignUp } from "@clerk/react";
import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import CommercialLicenseNotice from "@/components/CommercialLicenseNotice";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { safeAppRedirect } from "@/lib/safeAppRedirect.mjs";

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

export default function Register() {
  const { authConfigured, isSignedIn, loading } = useAuth();
  const [params] = useSearchParams();
  const [contract, setContract] = useState(null);
  const redirect = safeAppRedirect(params.get("redirect"));

  useEffect(() => {
    let active = true;
    api.get("/product-contract")
      .then(({ data }) => { if (active) setContract(data); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  if (authConfigured && isSignedIn) {
    return <Navigate to={redirect} replace />;
  }

  return (
    <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl gap-12 px-6 py-14 lg:grid-cols-2 lg:items-center lg:gap-24">
      <div>
        <div className="eyebrow">Join SONIC CHECK</div>
        <h1 className="mt-4 font-display text-6xl text-[#F0E9D6]">One account.<br />One protected app.</h1>
        <p className="mt-6 max-w-lg text-lg leading-8 text-[#F0E9D6]/62">
          Create a protected identity for private-beta access. Account creation does not grant paid screening, create an entitlement or open checkout while the formal commercial-licence gate remains closed.
        </p>
        <CommercialLicenseNotice contract={contract} className="mt-8 max-w-lg" />
        <p className="mt-8 text-sm text-[#F0E9D6]/50">Already joined? <Link to="/login" className="text-[#D4FF00] hover:underline">Log in</Link></p>
      </div>

      <div className="flex min-h-[580px] flex-col items-center justify-center gap-5 rounded-2xl border border-white/10 bg-[#202027] p-5 sm:p-8">
        {authConfigured ? (
          loading ? (
            <div className="font-mono-data text-sm text-[#F0E9D6]/50">Completing secure sign-up…</div>
          ) : (
            <SignUp
              routing="hash"
              signInUrl="/login"
              fallbackRedirectUrl={redirect}
              forceRedirectUrl={redirect}
              signInFallbackRedirectUrl={redirect}
              signInForceRedirectUrl={redirect}
              appearance={clerkAppearance}
            />
          )
        ) : (
          <div className="max-w-md text-center">
            <h2 className="font-display text-3xl text-[#F0E9D6]">Joining is temporarily closed.</h2>
            <p className="mt-4 leading-7 text-[#F0E9D6]/60">This deployment needs its Clerk publishable key before private-beta account creation can open.</p>
          </div>
        )}
        {authConfigured && !loading ? (
          <p className="max-w-md text-center text-xs leading-5 text-[#F0E9D6]/48">
            By continuing to create an account, you agree to the <Link className="text-[#D4FF00] hover:underline" to="/terms/">Terms of Use</Link> and acknowledge the <Link className="text-[#D4FF00] hover:underline" to="/privacy/">Privacy Policy</Link>.
          </p>
        ) : null}
      </div>
    </main>
  );
}
