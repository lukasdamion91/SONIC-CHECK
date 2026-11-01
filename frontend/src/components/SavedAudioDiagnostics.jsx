import { useMemo } from "react";
import { diagnosticNumber, savedDiagnosticsView } from "@/lib/savedDiagnosticsPresentation.mjs";

const number = (value, places = 3, unit = "") => value === null ? "Not measured" : `${diagnosticNumber(value, places)}${unit}`;
const count = (value) => value === null ? "Not recorded" : value;
const box = "rounded-xl border border-white/10 bg-[#101b25] p-4";

function SavedSpectrum({ spectrum }) {
  if (!spectrum) return <p className="mt-3 text-sm">Spectrum unavailable in the saved evidence.</p>;
  const { points } = spectrum;
  const min = Math.max(-180, Math.floor(Math.min(...points.map((p) => p.db)) / 20) * 20);
  const max = Math.max(min + 40, Math.ceil(Math.max(...points.map((p) => p.db)) / 20) * 20);
  const last = points.at(-1).hz;
  const x = (hz) => 58 + Math.log10(hz / 20) / Math.log10(last / 20) * 548;
  const y = (db) => 198 - (Math.min(max, Math.max(min, db)) - min) / (max - min) * 170;
  const ticks = Array.from({ length: Math.round((max - min) / 20) + 1 }, (_, i) => min + i * 20);
  return <figure className="mt-4">
    <svg viewBox="0 0 640 250" role="img" aria-labelledby="saved-spectrum-title saved-spectrum-description" className="w-full rounded-xl border border-white/10 bg-[#101b25]">
      <title id="saved-spectrum-title">Saved mean channel power spectrum</title>
      <desc id="saved-spectrum-description">Recorded spectral density, dB re 1 FS squared per Hz. Frequency uses a logarithmic scale from 20 Hz to {diagnosticNumber(last, 0)} Hz. This is not a device frequency response.</desc>
      {ticks.map((db) => <g key={db}><line x1="58" x2="606" y1={y(db)} y2={y(db)} stroke="#ffffff22" /><text x="50" y={y(db) + 4} textAnchor="end" fill="#d9e7eb" fontSize="11">{db}</text></g>)}
      {[20, 100, 1000, 10000, 20000].filter((hz) => hz <= last).map((hz) => <g key={hz}><line x1={x(hz)} x2={x(hz)} y1="28" y2="198" stroke="#ffffff12" /><text x={x(hz)} y="218" textAnchor="middle" fill="#d9e7eb" fontSize="11">{hz >= 1000 ? `${hz / 1000}k` : hz}</text></g>)}
      <polyline points={points.map((p) => `${x(p.hz)},${y(p.db)}`).join(" ")} fill="none" stroke="#78e1d1" strokeWidth="2" />
      <text x="58" y="17" fill="#d9e7eb" fontSize="11">dB re 1 FS²/Hz</text><text x="332" y="240" textAnchor="middle" fill="#d9e7eb" fontSize="11">Frequency (Hz, logarithmic scale)</text>
    </svg>
    <figcaption className="mt-2 text-xs leading-5">Signal spectrum of the supplied recording, from 20 Hz to the available upper frequency, capped at 20 kHz. Channel powers are averaged without waveform cancellation. A device frequency response requires a separate known input/output experiment. FFT size: {count(spectrum.fft)}; hop: {count(spectrum.hop)} samples; unframed tail: {count(spectrum.tail)} samples.</figcaption>
  </figure>;
}

export default function SavedAudioDiagnostics({ extension }) {
  const view = useMemo(() => savedDiagnosticsView(extension), [extension]);
  return <section aria-labelledby="saved-audio-diagnostics-heading" data-testid="saved-audio-diagnostics" className="mt-6 rounded-2xl border border-teal-200/20 bg-[#122b40] p-6 text-[#f3f2eb]/80 sm:p-8">
    <div className="eyebrow">Saved audio evidence</div>
    <h2 id="saved-audio-diagnostics-heading" className="mt-2 text-xl font-semibold text-[#f3f2eb]">Additional audio measurements &amp; final evidence review</h2>
    {view.state !== "supported" ? <p className="mt-4 text-sm leading-6">{view.message}</p> : <>
      <p className="mt-3 text-sm leading-6">Descriptive measurements of the recorded analysis window. These measurements add no points to the similarity score.</p>
      {view.boundaryWarning && <p role="alert" className="mt-3 text-sm text-amber-100">{view.boundaryWarning}</p>}
      <p className="mt-3 break-words text-xs leading-5">Audio measurements: {view.status}{view.reason ? ` · ${view.reason}` : ""}.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <p className={box}>Measured {number(view.measuredSeconds, 3, " s")}; decoded {number(view.decodedSeconds, 3, " s")}; source duration {number(view.sourceSeconds, 3, " s")}.</p>
        <p className={box}>Source: {count(view.sourceRate)} Hz; {count(view.sourceChannels)} channel(s). Saved coverage: {view.coverage}. Window starts at {number(view.startSeconds, 3, " s")}.</p>
      </div>
      <p className="mt-3 text-xs leading-5">Only the decoded first-stream window is measured, limited to 60 seconds and native PCM/sample bounds. Source duration may use a different codec convention. {view.nativePreserved ? "Native rate and channels retained; no peak normalization." : "Native decoding policy was not fully recorded."} A complete decoded window does not establish whole-song coverage.</p>
      <h3 className="mt-6 font-semibold text-[#f3f2eb]">Frequency spectrum</h3>
      <SavedSpectrum spectrum={view.spectrum} />
      <h3 className="mt-6 font-semibold text-[#f3f2eb]">Levels and dynamics</h3>
      {view.channels.length ? <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[570px] text-left text-xs"><caption className="sr-only">Saved sample level diagnostics by native channel; FS is full-scale sample amplitude.</caption><thead><tr>{["Channel", "Peak (FS)", "RMS (FS)", "DC (FS)", "Crest (dB)", "Near-rail samples"].map((label) => <th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead><tbody>{view.channels.map((r, i) => <tr key={i} className="border-t border-white/10"><th scope="row" className="p-3">{r.index === null ? "Not recorded" : r.index}</th><td className="p-3">{number(r.peak)}</td><td className="p-3">{number(r.rms)}</td><td className="p-3">{number(r.dc)}</td><td className="p-3">{number(r.crest, 2)}</td><td className="p-3">{number(r.nearRail, 3, "%")}</td></tr>)}</tbody></table></div> : <p className="mt-3 text-sm">Channel measurements unavailable in the saved evidence.</p>}
      <p className="mt-3 text-xs leading-5">FS means full-scale sample amplitude. Near-rail samples are indicators to inspect, not proof of clipping. THD, THD+N, inter-sample true peak, LUFS and calibrated acoustic SPL are not inferred from this music upload.</p>
      <h3 className="mt-6 font-semibold text-[#f3f2eb]">Timbre and tempo</h3>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">{view.timbre.map((r) => <div key={r.key} className={box}><dt className="text-xs">{r.label}</dt><dd className="mt-2 font-mono-data">{number(r.value, 3, r.unit ? ` ${r.unit}` : "")}</dd></div>)}</dl>
      <p className="mt-3 text-xs leading-5">Timbre status: {view.timbreStatus}. Means over informative frames describe spectral shape; they do not identify an instrument, performer, source work or ownership.</p>
      <p className="mt-3 text-sm leading-6">{view.bpms.length ? `Tempo candidates: ${view.bpms.map((bpm) => diagnosticNumber(bpm, 1)).join(", ")} BPM.` : `Tempo: ${view.tempoStatus}.`} Half/double tempo may be ambiguous; confidence is uncalibrated.</p>
      <h3 className="mt-6 font-semibold text-[#f3f2eb]">Vocal and lyric evidence</h3>
      <p className="mt-3 break-words text-sm leading-6">Vocal isolation: {view.separationStatus}. Singing transcription: {view.vocalStatus}. Supplied lyric text is not an audio transcription.</p>
      <h3 className="mt-6 font-semibold text-[#f3f2eb]">Final evidence review</h3>
      <p className="mt-3 break-words text-sm">{view.reviewStatus}</p>
      <p className="mt-3 text-xs leading-5">Arithmetic and declared source/entity consistency are checked where the schema is supported. Shared-input components are not independent votes. Missing evidence and a low score cannot establish unrelatedness, originality, ownership or clearance.</p>
      {view.issues.length > 0 && <ul className="mt-3 space-y-2 text-xs">{view.issues.map((r, i) => <li key={i} className="break-all">{r.code}: {r.path}</li>)}</ul>}
      <p className="mt-4 break-all text-xs">Extension method: {view.schema}. Displayed from this saved scan; no measurements are recomputed.</p>
    </>}
  </section>;
}
