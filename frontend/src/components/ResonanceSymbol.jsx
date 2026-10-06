import sculpture from "@/assets/resonance-sculpture.webp";

export default function ResonanceSymbol({ colours = [], active = false, paused = false, className = "" }) {
  const tint = colours.length > 1
    ? `linear-gradient(120deg, ${colours.join(", ")})`
    : colours[0] || "#e2e5e1";
  return (
    <div className={`sc-resonance-symbol ${className}`} aria-hidden="true" data-active={active} data-paused={paused} style={{ "--resonance-tint": tint }}>
      <div className="sc-resonance-form">
        <img src={sculpture} alt="" width="1024" height="1024" />
        <span className="sc-resonance-colour" />
      </div>
      <span className="sc-resonance-glow" />
    </div>
  );
}
