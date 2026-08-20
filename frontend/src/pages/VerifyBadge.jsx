import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { api, API } from "@/lib/api";

const asset = (path) => `${process.env.PUBLIC_URL || ""}${path}`;
const statusLabels = {
  REVIEW_REQUIRED: "Candidate evidence — human review required",
  NO_CANDIDATE_IDENTIFIED: "No candidate identified in searched sources",
  INCONCLUSIVE: "Inconclusive — incomplete source coverage",
  CLEAR: "Legacy record",
  REVIEW: "Legacy record",
  VIOLATION: "Legacy record",
};

export default function VerifyBadge() {
  const { badgeId } = useParams();
  const [record, setRecord] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/verify/${badgeId}`)
      .then(({ data }) => setRecord(data))
      .catch(() => setError("This public evidence record does not exist or has been removed."));
  }, [badgeId]);

  if (error) {
    return <main className="mx-auto max-w-lg px-6 py-24 text-center"><ShieldAlert className="mx-auto h-10 w-10 text-red-300" /><h1 className="mt-6 font-display text-4xl text-[#F0E9D6]">Record not found.</h1><p className="mt-3 text-[#F0E9D6]/58">{error}</p></main>;
  }
  if (!record) return <div className="grid min-h-[65vh] place-items-center"><Loader2 className="h-7 w-7 animate-spin text-[#F0E9D6]/45" /></div>;

  const status = statusLabels[record.screening_status] || "Evidence record";

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <div className="rounded-2xl border border-[#D4FF00]/20 bg-[#202027] p-7 sm:p-10">
        <div className="flex items-center gap-4 border-b border-white/10 pb-7">
          <img src={asset("/brand/logo-icon.png")} alt="" className="h-12 w-12" />
          <div><div className="eyebrow">Public evidence record</div><div className="mt-1 text-lg font-semibold text-[#F0E9D6]">SONIC CHECK verification</div></div>
        </div>

        <div className="mt-8">
          <h1 className="font-display text-5xl text-[#F0E9D6]">{record.title}</h1>
          <div className="mt-2 text-[#F0E9D6]/52">{record.artist_name || "Unknown creator"}</div>
        </div>

        <div className="mt-8 rounded-xl border border-white/10 bg-[#17171C] p-5">
          <div className="text-[10px] uppercase tracking-widest text-[#F0E9D6]/38 font-mono-data">Screening status</div>
          <div className="mt-2 text-lg text-[#F0E9D6]">{status}</div>
          <p className="mt-3 text-sm leading-6 text-[#F0E9D6]/52">This status describes candidate evidence under the listed source coverage. It is not an authorship, ownership, infringement or legal-clearance decision.</p>
        </div>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2">
          {[
            ["Analysis version", record.analysis_version],
            ["Regional context", `${record.region_name || "Not specified"}${record.region ? ` (${record.region})` : ""}`],
            ["Audio channel", record.scan_modes?.audio ? "Submitted" : "Not submitted"],
            ["Lyrics channel", record.scan_modes?.lyrics ? "Submitted" : "Not submitted"],
            ["Screened", record.scanned_at ? new Date(record.scanned_at).toLocaleString("en-AU") : "—"],
            ["Record ID", record.badge_id],
          ].map(([label, value]) => <div key={label} className="rounded-lg border border-white/8 bg-white/[0.025] p-4"><dt className="text-[9px] uppercase tracking-widest text-[#F0E9D6]/35 font-mono-data">{label}</dt><dd className="mt-2 break-all text-sm text-[#F0E9D6]/68">{value || "—"}</dd></div>)}
        </dl>

        <div className="mt-8 flex justify-center overflow-x-auto rounded-xl border border-white/8 bg-[#0A0A0D] p-4">
          <img src={`${API}/verify/${badgeId}/badge.svg`} alt="SONIC CHECK evidence-record badge" />
        </div>
      </div>

      <div className="mt-8 text-center"><Link to="/" className="text-sm text-[#F0E9D6]/55 hover:text-[#F0E9D6]">Return to soniccheck.io</Link></div>
    </main>
  );
}
