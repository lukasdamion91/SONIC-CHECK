// Simple stylized waveform visualizer. Flagged segments use destructive color.
export default function Waveform({ bars = [], flagged = [], height = 96 }) {
  const flaggedSet = new Set(flagged);
  return (
    <div className="relative w-full overflow-hidden rounded-md border border-white/10 bg-[#121216] p-4">
      <div className="flex items-end gap-[3px]" style={{ height }}>
        {bars.map((v, i) => {
          const isFlagged = flaggedSet.has(i);
          return (
            <div
              key={`bar-${i}-${v}`}
              className="wave-bar flex-1 rounded-[2px]"
              style={{
                height: `${Math.max(8, v * 100)}%`,
                background: isFlagged ? "#EF4444" : "#3B82F6",
                boxShadow: isFlagged ? "0 0 12px rgba(239,68,68,0.7)" : "0 0 8px rgba(59,130,246,0.25)",
                opacity: isFlagged ? 1 : 0.85,
              }}
            />
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-widest text-zinc-500 font-mono-data">
        <span>0:00</span>
        <span>flagged · {flagged.length}</span>
        <span>full track</span>
      </div>
    </div>
  );
}
