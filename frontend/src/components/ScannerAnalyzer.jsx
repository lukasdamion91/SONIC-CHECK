import { AudioLines, Check, ShieldCheck } from "lucide-react";
import ChromaticText from "@/components/ChromaticText";
import { ANALYZER_IDENTITY } from "@/constants/analyzerIdentity.mjs";
import { SCAN } from "@/constants/testIds";
import { getScanProgressView, SCAN_STAGE_ORDER } from "@/lib/scanProgress.mjs";

const SPECTRUM_HEIGHTS = [
  22, 38, 56, 42, 68, 82, 60, 44, 74, 92, 70, 52, 86, 64,
  46, 72, 94, 78, 54, 88, 66, 48, 76, 58, 84, 62, 40, 70,
];
const rainbowBarAsset = `${process.env.PUBLIC_URL || ""}/brand/sonic-rainbow-bar.png`;

export default function ScannerAnalyzer({ progress }) {
  const view = getScanProgressView(progress);
  const activeStageIndex = SCAN_STAGE_ORDER.findIndex(({ id }) => id === view.activeStage);

  return (
    <section
      className="scanner-console lg:sticky lg:top-24"
      aria-labelledby="scanner-console-heading"
      aria-busy={view.isActive}
      data-phase={progress.phase}
      data-testid={SCAN.progressPanel}
    >
      <div className="scanner-console-inner">
        <header className="scanner-console-header border-b border-white/10 pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="scanner-console-icon" aria-hidden="true">
              <AudioLines className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="font-mono-data text-[10px] uppercase tracking-[0.2em] text-[#F0E9D6]/55">SC analyser</div>
              <div id="scanner-console-heading" className="mt-1 text-sm font-semibold text-[#F0E9D6]">Live process display</div>
            </div>
          </div>
          <div className="scanner-console-meta">
            <span className="scanner-analyzer-mark font-mono-data" data-testid={SCAN.analyzerIdentity}>
              <span className="sr-only">Analyzer identity: </span>
              {ANALYZER_IDENTITY}
            </span>
            <div className="scanner-status-chip">
              <span className="scanner-status-dot" aria-hidden="true" />
              {view.statusLabel}
            </div>
          </div>
        </header>

        <div className="mt-6 grid grid-cols-[1fr_auto] items-end gap-5">
          <div>
            <div className="font-mono-data text-[10px] uppercase tracking-[0.18em] text-[#F0E9D6]/55">Current state</div>
            <h2 className="mt-2 max-w-xs text-xl font-semibold leading-tight text-[#F0E9D6]">{view.headline}</h2>
          </div>
          <div className="text-right">
            <ChromaticText className="scanner-counter font-mono-data" data-testid={SCAN.progressPercent}>
              {view.counter}
            </ChromaticText>
            <div className="mt-1 font-mono-data text-[10px] uppercase tracking-[0.16em] text-[#F0E9D6]/55">{view.counterLabel}</div>
          </div>
        </div>

        <div
          className="scanner-spectrum mt-6"
          data-active={view.isActive ? "true" : "false"}
          aria-hidden="true"
        >
          <div className="scanner-spectrum-grid" />
          <div className="scanner-spectrum-bars">
            {SPECTRUM_HEIGHTS.map((height, index) => (
              <span
                key={`${height}-${index}`}
                className="scanner-spectrum-bar"
                style={{
                  "--spectrum-height": `${height}%`,
                  "--spectrum-texture": `url("${rainbowBarAsset}")`,
                  "--spectrum-duration": `${4.8 + (index % 5) * 0.42}s`,
                  "--spectrum-delay": `${index * -0.16}s`,
                }}
              />
            ))}
          </div>
          <div className="scanner-sweep-line" />
        </div>

        <div className="mt-5" data-testid={SCAN.uploadProgress}>
          <div className="flex items-center justify-between gap-4 font-mono-data text-[10px] uppercase tracking-[0.13em]">
            <span className="text-[#F0E9D6]/55">{view.meterLabel}</span>
            <span className="text-[#8DEFE4]">Transfer telemetry</span>
          </div>
          <div
            className="scanner-upload-track mt-2"
            role="progressbar"
            aria-label="Secure evidence upload"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={progress.uploadPercent}
            aria-valuetext={view.meterValueText}
          >
            <span className="scanner-upload-fill" style={{ width: `${progress.uploadPercent}%` }} />
          </div>
        </div>

        {view.serverPercent != null && (
          <div className="mt-4" data-testid={SCAN.serverProgress}>
            <div className="flex items-center justify-between gap-4 font-mono-data text-[10px] uppercase tracking-[0.13em]">
              <span className="text-[#F0E9D6]/55">Completed pipeline milestones</span>
              <span className="text-[#D9A8E8]">{view.serverPercent}%</span>
            </div>
            <div
              className="scanner-upload-track mt-2"
              role="progressbar"
              aria-label="Server-reported completed pipeline milestones"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={view.serverPercent}
            >
              <span className="scanner-upload-fill scanner-server-fill" style={{ width: `${view.serverPercent}%` }} />
            </div>
          </div>
        )}

        <div
          className="mt-5 min-h-[4.25rem] rounded-md border border-white/[0.08] bg-white/[0.025] p-4 text-xs leading-5 text-[#F0E9D6]/62"
          data-testid={SCAN.progressDetail}
        >
          {view.detail}
        </div>
        <p
          key={view.announcementKey}
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-testid={SCAN.progressStatus}
        >
          {view.announcement}
        </p>

        <ol className="scanner-stages mt-5" aria-label="Evidence screen stages">
          {SCAN_STAGE_ORDER.map((stage, index) => {
            const isActive = index === activeStageIndex;
            const isComplete = activeStageIndex >= 0 && index < activeStageIndex;
            return (
              <li key={stage.id} className="scanner-stage" data-active={isActive ? "true" : "false"} data-complete={isComplete ? "true" : "false"}>
                <span className="scanner-stage-number" aria-hidden="true">{isComplete ? <Check className="h-3 w-3" /> : stage.number}</span>
                <span>{stage.label}</span>
              </li>
            );
          })}
        </ol>

        <div className="mt-5 flex items-start gap-2 border-t border-white/10 pt-4 text-[10px] leading-4 text-[#F0E9D6]/52">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8DEFE4]" aria-hidden="true" />
          {view.serverPercent != null
            ? "Analysis percentage reports completed pipeline milestones—not elapsed time, an ETA, confidence or accuracy."
            : "The percentage reports browser-to-server upload only. Server analysis remains stage-based until the API reports a completed milestone."}
        </div>
      </div>
    </section>
  );
}
