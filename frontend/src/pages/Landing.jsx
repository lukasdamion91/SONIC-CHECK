import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BadgeCheck,
  BookOpenCheck,
  Database,
  FileSearch,
  Fingerprint,
  LockKeyhole,
  Music2,
  Route,
  Shuffle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ChromaticText from "@/components/ChromaticText";
import CommercialLicenseNotice from "@/components/CommercialLicenseNotice";
import { LANDING } from "@/constants/testIds";
import { api } from "@/lib/api";
import { commercialLicenseState } from "@/lib/productContract.mjs";

const asset = (path) => `${process.env.PUBLIC_URL || ""}${path}`;
const aud = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

// Confirmed against six_function_scoring.py, harry-six-function-score/1.0.0-research.
// These allocations describe the score, not measured accuracy or independent evidence.
const HARRY_COMPONENTS = [
  { Icon: Fingerprint, label: "Recording identity", weight: 18, detail: "Recording matches", copy: "Uses available recognition-provider evidence to identify candidate recordings and preserve their source identities." },
  { Icon: BookOpenCheck, label: "Lyric overlap", weight: 18, detail: "Exact phrase evidence", copy: "Finds distinctive exact phrases shared by submitted lyrics and an available, authorised reference text." },
  { Icon: Music2, label: "Composition similarity", weight: 24, detail: "Musical structure", copy: "Compares features extracted from decoded audio with governed symbolic reference profiles to surface musical similarities." },
  { Icon: Shuffle, label: "Relational Specificity", weight: 10, detail: "Harmony and onset relationships", copy: "Examines how harmony and note-onset patterns fit together, using deliberately disrupted relationships as comparison controls." },
  { Icon: FileSearch, label: "Lyric Order Recovery", weight: 15, detail: "Ordered word sequences", copy: "Measures ordered word correspondence with bounded spelling tolerance and repetition weighting, compared with shuffled controls." },
  { Icon: Route, label: "Interval Path Specificity", weight: 15, detail: "Ordered pitch-class movement", copy: "Compares stable pitch-class interval sequences from the audio mix, accounting for global key shifts and testing against reordered controls." },
];

// SC-CATALOGUE-RESEARCH-20260922-R1 and SC-AB-2022-FULL-20260922.
// Research inventory is separate from the API-owned active release count below.
const RESEARCH_CATALOGUE = { acousticRecords: 7541578, symbolicReferences: 71196, additions: 70, vectorsPerView: 1011117 };

function intervalLabel(plan) {
  if (plan.billing_interval === "one-time") return "one time";
  return `per ${plan.billing_interval}`;
}

export default function Landing() {
  const [contract, setContract] = useState(null);
  const [catalogue, setCatalogue] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.allSettled([api.get("/product-contract"), api.get("/catalogue/manifest")]).then(([contractResult, catalogueResult]) => {
      if (!active) return;
      if (contractResult.status === "fulfilled") setContract(contractResult.value.data);
      if (catalogueResult.status === "fulfilled") setCatalogue(catalogueResult.value.data);
    });
    return () => { active = false; };
  }, []);

  const plans = contract?.pricing?.plans || [];
  const activeProfiles = catalogue?.coverage_summary?.comparison_eligible_entries;
  const paidOpen = commercialLicenseState(contract).checkoutOpen;

  return (
    <main>
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="mx-auto grid max-w-7xl gap-14 px-6 pb-24 pt-20 lg:grid-cols-[1.25fr_0.75fr] lg:items-end lg:pb-32 lg:pt-28">
          <div className="relative z-10 fade-up">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#D4FF00]/25 bg-[#D4FF00]/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-[#D4FF00] font-mono-data">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D4FF00]" /> Controlled private beta
            </div>
            <img src={asset("/brand/logo-full.png")} alt="SONIC CHECK" className="mb-10 h-20 w-auto sm:h-28" />
            <h1 className="max-w-5xl font-display text-6xl text-[#F0E9D6] sm:text-7xl lg:text-[6.4rem]">
              Originality,<br /><ChromaticText>checked through evidence.</ChromaticText>
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-[#F0E9D6]/66">
              Meet HARRY: SONIC CHECK’s six-component analysis engine. Explore recording identity, lyrics, musical structure and the relationships within them in one traceable evidence screen.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/join" data-testid={LANDING.heroCta}>
                <Button className="h-12 bg-[#D4FF00] px-7 text-[#1C1C22] btn-lift hover:bg-[#D4FF00]/85">Join SONIC CHECK</Button>
              </Link>
              <Link to="/login" data-testid={LANDING.heroSecondaryCta}>
                <Button variant="outline" className="h-12 border-white/15 bg-transparent px-7 text-[#F0E9D6] hover:bg-white/10">Log in</Button>
              </Link>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-7 gap-y-3 text-xs uppercase tracking-[0.14em] text-[#F0E9D6]/45 font-mono-data">
              <span>Private submissions</span>
              <span>Method-labelled signals</span>
              <span>Human review required</span>
            </div>
          </div>

          <div className="relative z-10 fade-up delay-200">
            <div className="metallic-evidence-card rounded-2xl border p-6 sm:p-8">
              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#F0E9D6]/45 font-mono-data">Evidence record</div>
                  <div className="mt-1 text-lg font-semibold text-[#F0E9D6]">HARRY’s six components</div>
                </div>
                <BadgeCheck className="h-7 w-7 text-[#D4FF00]" />
              </div>
              <div className="mt-6 space-y-3">
                {HARRY_COMPONENTS.map(({ Icon, label, detail, weight }) => (
                  <div key={label} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.025] p-3">
                    <Icon className="h-5 w-5 shrink-0 text-[#9DB8F0]" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-[#F0E9D6]">{label}</div>
                      <div className="mt-0.5 text-xs text-[#F0E9D6]/60">{detail}</div>
                    </div>
                    <span className="shrink-0 rounded-full border border-[#D4FF00]/25 bg-[#D4FF00]/5 px-2.5 py-1 text-sm text-[#D4FF00] font-mono-data">{weight}%</span>
                  </div>
                ))}
              </div>
              <p className="mt-5 text-sm leading-6 text-[#F0E9D6]/65">Score allocations total 100%. Components need usable inputs and reference evidence; unavailable components remain unscored.</p>
              <p className="mt-3 text-xs leading-5 text-[#F0E9D6]/55">
                Output is candidate evidence, not a determination of plagiarism, authorship, ownership, infringement, legal clearance or admissibility.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="landing-content">
      <section id="method" className="mx-auto max-w-7xl px-6 py-24">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <div className="eyebrow">The HARRY method</div>
            <h2 className="mt-4 font-display text-5xl text-[#F0E9D6] sm:text-6xl">Six perspectives.<br />Deeper insight.</h2>
            <p className="mt-6 max-w-lg leading-7 text-[#F0E9D6]/62">
              HARRY’s power comes from examining sound, words, musical structure and ordered relationships together. SONIC CHECK’s distinctive design keeps each contribution visible and combines eligible evidence around the same identified candidate, giving creators a detailed view of what matched and why.
            </p>
            <p className="mt-5 max-w-lg leading-7 text-[#F0E9D6]/62">Every available result carries its method and reference context. Missing evidence stays visible, and score weights are not accuracy percentages.</p>
            <div className="mt-7 rounded-xl border border-white/10 bg-white/[0.025] p-5">
              <h3 className="text-lg font-semibold text-[#F0E9D6]">HOEL: evidence relationships</h3>
              <p className="mt-3 text-sm leading-6 text-[#F0E9D6]/65">HOEL research examines shared origins, dependencies and reliability across evidence. Its real-world added value is still being validated; it is separate from HARRY’s six weighted components.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {HARRY_COMPONENTS.map(({ Icon, label, copy, weight }) => (
              <article key={label} className="rounded-xl border border-white/10 bg-[#24242C] p-6">
                <div className="flex items-center justify-between gap-3"><Icon className="h-6 w-6 text-[#9DB8F0]" /><span className="text-sm text-[#D4FF00] font-mono-data">{weight}% allocation</span></div>
                <h3 className="mt-6 text-xl font-semibold text-[#F0E9D6]">{label}</h3>
                <p className="mt-3 text-sm leading-6 text-[#F0E9D6]/58">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="catalogue" className="border-y border-white/10 bg-[#15151A]">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-24 lg:grid-cols-2 lg:items-center">
          <div className="rounded-2xl border border-white/10 bg-[#202027] p-7 sm:p-10">
            <div className="flex items-center gap-3 text-[#9DB8F0]">
              <Database className="h-6 w-6" />
              <span className="eyebrow !text-[#9DB8F0]">Expanded research catalogue</span>
            </div>
            <div className="mt-8 break-words font-mono-data text-4xl text-[#F0E9D6] sm:text-5xl">
              {RESEARCH_CATALOGUE.acousticRecords.toLocaleString("en-AU")}
            </div>
            <div className="mt-2 text-base text-[#F0E9D6]/72">AcousticBrainz recording-feature records</div>
            <p className="mt-3 text-sm leading-6 text-[#F0E9D6]/65">Spectral, rhythm and tonal descriptors preserved for research analysis.</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-white/8 bg-black/15 p-4">
                <div className="text-2xl text-[#F0E9D6] font-mono-data">{RESEARCH_CATALOGUE.symbolicReferences.toLocaleString("en-AU")}</div>
                <div className="mt-2 text-sm text-[#F0E9D6]/72">Symbolic research references</div>
                <div className="mt-2 text-sm text-[#F0E9D6]/60">Includes {RESEARCH_CATALOGUE.additions} newly admitted references</div>
              </div>
              <div className="rounded-lg border border-white/8 bg-black/15 p-4">
                <div className="text-2xl text-[#F0E9D6] font-mono-data">{RESEARCH_CATALOGUE.vectorsPerView.toLocaleString("en-AU")}</div>
                <div className="mt-2 text-sm text-[#F0E9D6]/72">Retrieval vectors per symbolic view</div>
                <div className="mt-2 text-sm text-[#F0E9D6]/60">Two views of the same reference set</div>
              </div>
            </div>
            <p className="mt-6 border-t border-white/10 pt-5 text-sm leading-6 text-[#F0E9D6]/72">Active scan catalogue: {typeof activeProfiles === "number" ? `${activeProfiles.toLocaleString("en-AU")} comparison-eligible symbolic profiles` : "awaiting the live release manifest"}.</p>
          </div>
          <div>
            <div className="eyebrow">Catalogue expansion · 22 September 2026</div>
            <h2 className="mt-4 font-display text-5xl text-[#F0E9D6]">Millions of acoustic records.<br />A broader research foundation.</h2>
            <p className="mt-6 leading-7 text-[#F0E9D6]/62">
              The sealed expansion brings together 71,196 symbolic references and a separate store of 7,541,578 AcousticBrainz recording-feature records. The acoustic store describes recorded music at the feature level. Its record count is separate from the symbolic composition catalogue.
            </p>
            <p className="mt-5 leading-7 text-[#F0E9D6]/62">The expanded resources are sealed for research. Full-catalogue audio retrieval and release acceptance are being validated before production activation. Current scan coverage continues to come from the live release manifest.</p>
            <div className="mt-7 flex items-start gap-3 rounded-lg border border-[#D4FF00]/20 bg-[#D4FF00]/5 p-4 text-sm leading-6 text-[#F0E9D6]/72">
              <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-[#D4FF00]" />
              Research inventory and active scan coverage are reported separately. MusicBrainz supplies identity context; licensed provider recognition is a separate evidence route.
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-7xl px-6 py-24">
        <div className="max-w-3xl">
          <div className="eyebrow">AUD pricing</div>
          <h2 className="mt-4 font-display text-5xl text-[#F0E9D6] sm:text-6xl">Published terms.<br />Gated access.</h2>
          <p className="mt-6 text-[#F0E9D6]/62">The API is the pricing and checkout authority. Listed prices do not mean paid checkout is open, and account creation does not unlock purchase.</p>
        </div>

        <CommercialLicenseNotice contract={contract} className="mt-8 max-w-3xl" />

        {plans.length ? (
          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => (
              <article key={plan.id} className="flex rounded-xl border border-white/10 bg-[#24242C] p-6 flex-col">
                <div className="text-xs uppercase tracking-[0.17em] text-[#F0E9D6]/45 font-mono-data">{plan.name}</div>
                <div className="mt-6 text-4xl font-semibold text-[#F0E9D6]">{aud.format(plan.price)}</div>
                <div className="mt-1 text-xs text-[#F0E9D6]/45">AUD · {intervalLabel(plan)}</div>
                <ul className="mt-7 flex-1 space-y-3 text-sm leading-5 text-[#F0E9D6]/62">
                  {plan.features.map((feature) => <li key={feature} className="flex gap-2"><span className="text-[#D4FF00]">•</span>{feature}</li>)}
                </ul>
                <Link to="/join" className="mt-8">
                  <Button variant="outline" className="w-full border-white/15 bg-transparent text-[#F0E9D6] hover:bg-white/10">Join private beta</Button>
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-12 rounded-xl border border-white/10 bg-[#24242C] p-8 text-[#F0E9D6]/55">Loading the authoritative AUD pricing contract…</div>
        )}

        <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.025] px-4 py-3 text-xs text-[#F0E9D6]/50 font-mono-data">
          Paid public checkout: {paidOpen ? "API-authorized" : "closed"}.
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#202027] p-10 sm:p-16">
          <div className="absolute right-0 top-0 h-64 w-64 translate-x-1/3 -translate-y-1/3 rounded-full bg-[#9DB8F0]/10 blur-3xl" />
          <h2 className="relative max-w-3xl font-display text-5xl text-[#F0E9D6] sm:text-6xl">Enter through one trusted front door.</h2>
          <p className="relative mt-5 max-w-2xl text-[#F0E9D6]/62">Join or log in at soniccheck.io for protected account access. Creating an account does not grant paid screening or bypass the commercial-licence gate.</p>
          <div className="relative mt-8 flex flex-wrap gap-3">
            <Link to="/join"><Button className="h-12 bg-[#D4FF00] px-7 text-[#1C1C22] hover:bg-[#D4FF00]/85">Join</Button></Link>
            <Link to="/login"><Button variant="outline" className="h-12 border-white/15 bg-transparent px-7 text-[#F0E9D6] hover:bg-white/10">Log in</Button></Link>
          </div>
        </div>
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 text-xs text-[#F0E9D6]/38 font-mono-data">
          <span>© SONIC CHECK</span>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link className="hover:text-[#D4FF00]" to="/privacy/">Privacy</Link>
            <Link className="hover:text-[#D4FF00]" to="/terms/">Terms</Link>
            <span>{contract?.contract_revision || "RC-0 operational convergence"}</span>
          </span>
        </footer>
      </section>
      </div>
    </main>
  );
}
