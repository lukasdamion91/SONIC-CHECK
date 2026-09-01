import { LockKeyhole } from "lucide-react";
import { commercialLicenseState } from "@/lib/productContract.mjs";

export default function CommercialLicenseNotice({ contract, className = "" }) {
  const state = commercialLicenseState(contract);

  return (
    <div className={`rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 ${className}`} data-license-status={state.status}>
      <div className="flex gap-3">
        <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
        <div>
          <div className="text-[10px] uppercase tracking-widest text-amber-200 font-mono-data">{state.label}</div>
          <p className="mt-2 text-sm leading-6 text-[#F0E9D6]/68">{state.message}</p>
        </div>
      </div>
    </div>
  );
}
