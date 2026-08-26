import { Link } from "react-router-dom";

export function LegalSection({ title, children }) {
  return (
    <section className="border-t border-white/10 pt-8">
      <h2 className="text-2xl font-semibold text-[#F0E9D6]">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-7 text-[#F0E9D6]/68 sm:text-base">
        {children}
      </div>
    </section>
  );
}

export default function LegalPage({ eyebrow, title, summary, updated, children }) {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
      <header className="max-w-3xl">
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="mt-4 font-display text-5xl text-[#F0E9D6] sm:text-7xl">{title}</h1>
        <p className="mt-7 text-lg leading-8 text-[#F0E9D6]/68">{summary}</p>
        <p className="mt-5 font-mono-data text-xs uppercase tracking-[0.14em] text-[#F0E9D6]/40">
          Effective {updated}
        </p>
      </header>

      <article className="mt-14 space-y-10 rounded-2xl border border-white/10 bg-[#202027] p-7 sm:p-10">
        {children}
      </article>

      <footer className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#F0E9D6]/55">
        <Link className="hover:text-[#D4FF00]" to="/">Home</Link>
        <Link className="hover:text-[#D4FF00]" to="/privacy">Privacy</Link>
        <Link className="hover:text-[#D4FF00]" to="/terms">Terms</Link>
        <a className="hover:text-[#D4FF00]" href="mailto:info@soniccheck.io">info@soniccheck.io</a>
      </footer>
    </main>
  );
}
