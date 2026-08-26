import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AudioLines,
  BadgeCheck,
  BookOpenCheck,
  Database,
  FileSearch,
  Fingerprint,
  LockKeyhole,
  Music2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LANDING } from "@/constants/testIds";
import { api } from "@/lib/api";

const asset = (path) => `${process.env.PUBLIC_URL || ""}${path}`;
const aud = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

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
  const paidOpen = contract?.paid_public_scanning === "enabled";

  return (
    <main>
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="landing-orbit landing-orbit-one" />
        <div className="landing-orbit landing-orbit-two" />
        <div className="mx-auto grid max-w-7xl gap-14 px-6 pb-24 pt-20 lg:grid-cols-[1.25fr_0.75fr] lg:items-end lg:pb-32 lg:pt-28">
          <div className="relative z-10 fade-up">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#D4FF00]/25 bg-[#D4FF00]/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-[#D4FF00] font-mono-data">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D4FF00]" /> Controlled private beta
            </div>
            <img src={asset("/brand/logo-full.png")} alt="SONIC CHECK" className="mb-10 h-20 w-auto sm:h-28" />
            <h1 className="max-w-5xl font-display text-6xl text-[#F0E9D6] sm:text-7xl lg:text-[6.4rem]">
              Originality,<br /><span className="holo-text">checked through evidence.</span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-[#F0E9D6]/66">
              SONIC CHECK brings recording identity, lyric phrase overlap and governed symbolic-composition signals into one traceable evidence screen for qualified human review.
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
            <div className="rounded-2xl border border-white/10 bg-[#1A1A21]/90 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#F0E9D6]/45 font-mono-data">Evidence record</div>
                  <div className="mt-1 text-lg font-semibold text-[#F0E9D6]">Method coverage</div>
                </div>
                <BadgeCheck className="h-7 w-7 text-[#D4FF00]" />
              </div>
              <div className="mt-6 space-y-3">
                {[
                  [Fingerprint, "Recording identity", "Candidate route"],
                  [BookOpenCheck, "Lyric phrase overlap", "Exact evidence"],
                  [Music2, "Composition features", "Governed reference set"],
                ].map(([Icon, label, state]) => (
                  <div key={label} className="flex items-center gap-4 rounded-xl border border-white/8 bg-white/[0.025] p-4">
                    <Icon className="h-5 w-5 text-[#9DB8F0]" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-[#F0E9D6]">{label}</div>
                      <div className="mt-0.5 text-xs text-[#F0E9D6]/45">{state}</div>
                    </div>
                    <span className="rounded-full border border-[#D4FF00]/25 bg-[#D4FF00]/5 px-2.5 py-1 text-[9px] uppercase tracking-widest text-[#D4FF00] font-mono-data">labelled</span>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-xs leading-5 text-[#F0E9D6]/45">
                Output is candidate evidence, not a determination of plagiarism, authorship, ownership, infringement, legal clearance or admissibility.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="method" className="mx-auto max-w-7xl px-6 py-24">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <div className="eyebrow">The method</div>
            <h2 className="mt-4 font-display text-5xl text-[#F0E9D6] sm:text-6xl">One record.<br />Separate signals.</h2>
            <p className="mt-6 max-w-lg leading-7 text-[#F0E9D6]/62">
              Each evidence channel retains its own source, version, limitations and confidence. The result is designed to support review, not replace it.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              [Fingerprint, "Recording identity", "Authorised recognition providers can return a candidate recording. Identity evidence is never converted into a composition conclusion."],
              [BookOpenCheck, "Lyrics", "Distinctive exact phrase overlap is reported with the submitted and reference snippets required for contextual review."],
              [AudioLines, "Composition", "Decoded audio is measured against governed symbolic feature profiles with manifest and reference provenance."],
              [FileSearch, "Evidence record", "Inputs, method versions, source status and limitations are preserved in a reviewable record and optional report."],
            ].map(([Icon, title, copy]) => (
              <article key={title} className="rounded-xl border border-white/10 bg-[#24242C] p-6">
                <Icon className="h-6 w-6 text-[#9DB8F0]" />
                <h3 className="mt-6 text-xl font-semibold text-[#F0E9D6]">{title}</h3>
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
              <span className="eyebrow !text-[#9DB8F0]">Active catalogue release</span>
            </div>
            <div className="mt-8 font-mono-data text-5xl text-[#F0E9D6] sm:text-6xl">
              {typeof activeProfiles === "number" ? activeProfiles.toLocaleString("en-AU") : "—"}
            </div>
            <div className="mt-2 text-sm text-[#F0E9D6]/58">comparison-eligible symbolic feature profiles</div>
            <div className="mt-8 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-white/8 bg-black/15 p-4">
                <div className="text-[10px] uppercase tracking-widest text-[#F0E9D6]/40 font-mono-data">Metadata</div>
                <div className="mt-2 text-sm text-[#F0E9D6]">MusicBrainz context</div>
              </div>
              <div className="rounded-lg border border-white/8 bg-black/15 p-4">
                <div className="text-[10px] uppercase tracking-widest text-[#F0E9D6]/40 font-mono-data">Raw media</div>
                <div className="mt-2 text-sm text-[#F0E9D6]">Not hosted in this release</div>
              </div>
            </div>
          </div>
          <div>
            <div className="eyebrow">Catalogue boundary</div>
            <h2 className="mt-4 font-display text-5xl text-[#F0E9D6]">Real coverage.<br />Precisely described.</h2>
            <p className="mt-6 leading-7 text-[#F0E9D6]/62">
              {contract?.catalogue_boundary || "Coverage is published from the versioned production manifest. MusicBrainz provides metadata and identity context; recording recognition requires an authorised provider."}
            </p>
            <div className="mt-7 flex items-start gap-3 rounded-lg border border-[#D4FF00]/20 bg-[#D4FF00]/5 p-4 text-sm leading-6 text-[#F0E9D6]/72">
              <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-[#D4FF00]" />
              Licensed or governed access does not mean raw recordings are exposed to users or stored in the public web application.
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-7xl px-6 py-24">
        <div className="max-w-3xl">
          <div className="eyebrow">AUD pricing</div>
          <h2 className="mt-4 font-display text-5xl text-[#F0E9D6] sm:text-6xl">A clear path from one screen to a team.</h2>
          <p className="mt-6 text-[#F0E9D6]/62">The API is the pricing authority. Create an account to purchase or manage an entitlement.</p>
        </div>

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
                  <Button variant="outline" className="w-full border-white/15 bg-transparent text-[#F0E9D6] hover:bg-white/10">Join to continue</Button>
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-12 rounded-xl border border-white/10 bg-[#24242C] p-8 text-[#F0E9D6]/55">Loading the authoritative AUD pricing contract…</div>
        )}

        <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.025] px-4 py-3 text-xs text-[#F0E9D6]/50 font-mono-data">
          Paid public checkout: {paidOpen ? "enabled" : "closed until the operational readiness gate is green"}.
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#202027] p-10 sm:p-16">
          <div className="absolute right-0 top-0 h-64 w-64 translate-x-1/3 -translate-y-1/3 rounded-full bg-[#9DB8F0]/10 blur-3xl" />
          <h2 className="relative max-w-3xl font-display text-5xl text-[#F0E9D6] sm:text-6xl">Enter through one trusted front door.</h2>
          <p className="relative mt-5 max-w-2xl text-[#F0E9D6]/62">Join or log in at soniccheck.io. Account, subscription and individual functionality then remain inside the protected application.</p>
          <div className="relative mt-8 flex flex-wrap gap-3">
            <Link to="/join"><Button className="h-12 bg-[#D4FF00] px-7 text-[#1C1C22] hover:bg-[#D4FF00]/85">Join</Button></Link>
            <Link to="/login"><Button variant="outline" className="h-12 border-white/15 bg-transparent px-7 text-[#F0E9D6] hover:bg-white/10">Log in</Button></Link>
          </div>
        </div>
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 text-xs text-[#F0E9D6]/38 font-mono-data">
          <span>© SONIC CHECK</span>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link className="hover:text-[#D4FF00]" to="/privacy">Privacy</Link>
            <Link className="hover:text-[#D4FF00]" to="/terms">Terms</Link>
            <span>{contract?.contract_revision || "RC-0 operational convergence"}</span>
          </span>
        </footer>
      </section>
    </main>
  );
}
