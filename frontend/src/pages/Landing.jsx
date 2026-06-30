import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LANDING } from "@/constants/testIds";
import { ShieldCheck, Scale, Music2, FileSearch, Globe2, Zap } from "lucide-react";

const partners = ["UMG", "ASCAP", "BMI", "PRS", "SACEM", "JASRAC", "APRA", "SOCAN"];

export default function Landing() {
  return (
    <div className="relative">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <img
            src="https://images.unsplash.com/photo-1621947081720-86970823b77a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2OTF8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMHNvdW5kJTIwd2F2ZSUyMGJhY2tncm91bmQlMjBkYXJrfGVufDB8fHx8MTc4Mjg1NzcyNnww&ixlib=rb-4.1.0&q=85"
            alt=""
            className="h-full w-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0E]/40 via-[#0A0A0E]/70 to-[#0A0A0E]" />
        </div>

        <div className="mx-auto max-w-7xl px-6 pt-28 pb-32">
          <div className="grid items-end gap-12 lg:grid-cols-12">
            <div className="lg:col-span-8 fade-up">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-widest text-zinc-300 font-mono-data">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Plagiarism intelligence for music
              </div>
              <h1 className="font-display text-[10vw] leading-[0.9] text-white sm:text-7xl lg:text-8xl">
                Settle it<br/>
                <span className="text-zinc-400">before</span> the<br/>
                <span className="relative inline-block">
                  <span className="relative z-10">lawsuit.</span>
                  <span className="absolute -bottom-1 left-0 h-3 w-full bg-[#EF4444]/80" />
                </span>
              </h1>
              <p className="mt-8 max-w-2xl text-lg text-zinc-400 font-body">
                SonicCheck is the Turnitin for music. Drop in a track or lyrics and we score it against millions of copyrighted works, then tell you exactly what is defensible in your jurisdiction — US Fair Use, EU Quotation, UK Fair Dealing, and more.
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <Link to="/register" data-testid={LANDING.heroCta}>
                  <Button className="h-12 rounded-md bg-white px-7 text-black btn-lift hover:bg-zinc-200">
                    Start free scan →
                  </Button>
                </Link>
                <Link to="/pricing" data-testid={LANDING.heroSecondaryCta}>
                  <Button variant="outline" className="h-12 rounded-md border-white/15 bg-transparent px-7 text-white hover:bg-white/10">
                    See pricing
                  </Button>
                </Link>
              </div>
              <div className="mt-12 flex flex-wrap items-center gap-6 text-xs text-zinc-500 font-mono-data uppercase tracking-widest">
                <span>3 free scans</span>
                <span className="h-1 w-1 rounded-full bg-zinc-700" />
                <span>No card required</span>
                <span className="h-1 w-1 rounded-full bg-zinc-700" />
                <span>For artists · producers · students</span>
              </div>
            </div>

            {/* Floating score card */}
            <div className="lg:col-span-4 fade-up delay-200">
              <div className="rounded-md border border-white/10 bg-[#121216]/80 p-6 backdrop-blur-xl glow-blue">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-zinc-500 font-mono-data">
                  <span>Sample report</span>
                  <span>US · Fair Use</span>
                </div>
                <div className="mt-4 font-mono-data text-[64px] leading-none text-white">
                  18.4<span className="text-2xl text-zinc-500">%</span>
                </div>
                <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-300 font-mono-data uppercase tracking-widest">
                  Review needed
                </div>
                <div className="mt-6 space-y-3">
                  {[
                    { label: "Lyric overlap", val: 22, color: "#EF4444" },
                    { label: "Melodic match", val: 14, color: "#F59E0B" },
                    { label: "Chord progression", val: 9, color: "#3B82F6" },
                  ].map((b) => (
                    <div key={b.label}>
                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span>{b.label}</span>
                        <span className="font-mono-data">{b.val}%</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-white/5">
                        <div className="h-full rounded-full" style={{ width: `${b.val * 3}%`, background: b.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Partners marquee */}
      <section className="border-y border-white/10 bg-[#0A0A0E]">
        <div className="mx-auto max-w-7xl overflow-hidden px-6 py-8">
          <div className="mb-4 text-[10px] uppercase tracking-widest text-zinc-500 font-mono-data">Trusted reference catalogs</div>
          <div className="marquee">
            {[...partners, ...partners].map((p, i) => (
              <div key={i} className="font-display whitespace-nowrap text-2xl text-zinc-600">{p}</div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — Tetris grid */}
      <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-24">
        <div className="mb-12 flex items-end justify-between">
          <div>
            <div className="mb-3 text-[10px] uppercase tracking-widest text-zinc-500 font-mono-data">How it works</div>
            <h2 className="font-display text-5xl text-white sm:text-6xl">Forensic-grade<br/>music analysis.</h2>
          </div>
          <p className="hidden max-w-md text-zinc-400 lg:block">Three engines, one verdict. Upload an audio file, paste lyrics, or both — we run them through lyric, melodic, and chord analyzers, then apply your region's copyright doctrine.</p>
        </div>

        <div className="tetris-grid">
          <div className="col-span-6 row-span-2 beam-card p-8 lg:col-span-4">
            <FileSearch className="h-7 w-7 text-blue-400" />
            <h3 className="mt-6 font-display text-3xl text-white">Lyric scanner</h3>
            <p className="mt-3 text-sm text-zinc-400 max-w-md">Catches paraphrased hooks, verse echoes, and direct lifts using sliding n-gram windows and semantic similarity against millions of registered lyrics.</p>
            <div className="mt-6 grid grid-cols-3 gap-2">
              {Array.from({ length: 18 }).map((_, i) => (
                <div key={i} className="h-2 rounded-sm" style={{ background: i % 5 === 0 ? "#EF4444" : "rgba(255,255,255,0.08)" }} />
              ))}
            </div>
          </div>

          <div className="col-span-6 row-span-1 border border-white/10 bg-[#121216] p-8 lg:col-span-2">
            <Music2 className="h-6 w-6 text-emerald-400" />
            <h3 className="mt-4 font-display text-xl text-white">Melodic match</h3>
            <p className="mt-2 text-xs text-zinc-400">MIDI-extracted contour & interval comparison.</p>
          </div>

          <div className="col-span-6 row-span-1 border border-white/10 bg-[#121216] p-8 lg:col-span-2">
            <Zap className="h-6 w-6 text-amber-400" />
            <h3 className="mt-4 font-display text-xl text-white">Chord engine</h3>
            <p className="mt-2 text-xs text-zinc-400">Detects shared progressions across keys.</p>
          </div>

          <div className="col-span-6 lg:col-span-3 border border-white/10 bg-[#121216] p-8">
            <Scale className="h-6 w-6 text-blue-400" />
            <h3 className="mt-4 font-display text-2xl text-white">Regional verdicts</h3>
            <p className="mt-2 text-sm text-zinc-400">Each jurisdiction has its own fair-use threshold. We render verdicts you can defend in court.</p>
          </div>

          <div className="col-span-6 lg:col-span-3 border border-white/10 bg-gradient-to-br from-[#1A1A20] to-[#121216] p-8">
            <ShieldCheck className="h-6 w-6 text-emerald-400" />
            <h3 className="mt-4 font-display text-2xl text-white">Defensible reports</h3>
            <p className="mt-2 text-sm text-zinc-400">Export a timestamped, signed PDF that is admissible in dispute resolution. Built for music attorneys.</p>
          </div>
        </div>
      </section>

      {/* REGIONS */}
      <section id="regions" className="relative overflow-hidden border-y border-white/10 bg-[#0E0E12]">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-24 lg:grid-cols-2">
          <div>
            <div className="mb-3 text-[10px] uppercase tracking-widest text-zinc-500 font-mono-data">Jurisdiction aware</div>
            <h2 className="font-display text-5xl text-white">Different country.<br/>Different rules.</h2>
            <p className="mt-6 max-w-lg text-zinc-400">A 14% lyric overlap might be defensible in the US under Fair Use but trigger an automatic infringement claim in Japan. SonicCheck applies the right threshold for the right region.</p>
            <div className="mt-8 grid grid-cols-2 gap-3 max-w-md">
              {[
                { code: "US", name: "United States", t: 15, doc: "Fair Use" },
                { code: "EU", name: "Europe", t: 10, doc: "Quotation" },
                { code: "UK", name: "United Kingdom", t: 10, doc: "Fair Dealing" },
                { code: "JP", name: "Japan", t: 8, doc: "Art. 32" },
              ].map((r) => (
                <div key={r.code} className="rounded-md border border-white/10 bg-[#121216] p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono-data text-xs text-zinc-500">{r.code}</span>
                    <span className="font-mono-data text-2xl text-white">{r.t}%</span>
                  </div>
                  <div className="mt-1 text-sm text-white">{r.name}</div>
                  <div className="text-xs text-zinc-500">{r.doc}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="overflow-hidden rounded-md border border-white/10">
              <img
                src="https://images.unsplash.com/photo-1636226570637-3fbda7ca09dc?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NjV8MHwxfHNlYXJjaHwzfHxtdXNpYyUyMHByb2R1Y2VyJTIwc3R1ZGlvfGVufDB8fHx8MTc4Mjg1NzcyNnww&ixlib=rb-4.1.0&q=85"
                alt="Producer studio"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-6 -left-6 max-w-xs rounded-md border border-white/10 bg-[#121216] p-5 glow-red">
              <Globe2 className="h-5 w-5 text-red-400" />
              <div className="mt-2 font-mono-data text-xs uppercase tracking-widest text-red-300">Violation flagged</div>
              <p className="mt-1 text-sm text-white">&ldquo;Levitating&rdquo; — 22% lyric overlap in EU jurisdiction (limit: 10%).</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="relative overflow-hidden rounded-md border border-white/10 bg-gradient-to-br from-[#121216] via-[#0E0E12] to-[#121216] p-12 sm:p-20">
          <h2 className="font-display text-5xl text-white sm:text-7xl">Don&apos;t release<br/>blindfolded.</h2>
          <p className="mt-6 max-w-xl text-zinc-400">Built for the music industry: A&R teams, labels, producers, and the next generation of artists in conservatories worldwide.</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/register"><Button className="h-12 rounded-md bg-white px-8 text-black btn-lift hover:bg-zinc-200">Start free →</Button></Link>
            <Link to="/pricing" data-testid={LANDING.pricingCta}><Button variant="outline" className="h-12 rounded-md border-white/15 bg-transparent px-8 text-white hover:bg-white/10">See plans</Button></Link>
          </div>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 text-xs text-zinc-500 font-mono-data">
          <span>© SonicCheck — Plagiarism intelligence for music</span>
          <span>v1.0.0 · MVP</span>
        </div>
      </section>
    </div>
  );
}
