import { useEffect, useRef, useState } from 'react';
import { useResonance } from '@/context/ResonanceContext';
import { resonanceIdentity } from '@/lib/resonanceIdentity.mjs';
import { createResonanceRenderer } from '@/lib/resonanceRenderer.mjs';
import { HARRY_COMPONENTS } from '@/lib/componentActivity.mjs';
import metallicStill from '@/assets/harry-metallic.png';
import spectrumStill from '@/assets/harry-spectrum.png';
import '@/components/ResonanceSymbol.css';

// The static fallback is rendered in cyan. A single hue rotation keeps every
// knot in the same family even when Canvas is unavailable.
const colourHue = colour => {
  const [r, g, b] = [1, 3, 5].map(start => parseInt(colour.slice(start, start + 2), 16) / 255);
  const high = Math.max(r, g, b), delta = high - Math.min(r, g, b);
  return delta ? (((high === r ? (g - b) / delta : high === g ? (b - r) / delta + 2 : (r - g) / delta + 4) * 60 + 360) % 360) : 0;
};
const fallbackHues = Object.fromEntries(HARRY_COMPONENTS.map(({ id, colour }) => [id, colourHue(colour)]));

export default function ResonanceSymbol({ progress, paused = false, className = '' }) {
  const shared = useResonance();
  const state = resonanceIdentity(progress ?? shared?.progress);
  const canvas = useRef(null);
  const update = useRef(null);
  const current = useRef(null);
  const [unavailable, setUnavailable] = useState(false);
  current.current = { state, paused: paused || Boolean(shared?.paused) };

  useEffect(() => {
    const renderer = createResonanceRenderer(canvas.current);
    if (!renderer) { setUnavailable(true); return undefined; }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let elapsed = 0, last = null, lastDraw = 0, frame = 0, visible = true, disposed = false;
    const stopped = () => disposed || media.matches || current.current.paused || document.hidden || !visible;
    const draw = (instant = false) => renderer.draw(elapsed, current.current.state, { instant });
    const tick = timestamp => {
      frame = 0;
      if (stopped()) { last = null; return; }
      if (last !== null) elapsed += Math.max(0, (timestamp - last) / 1000);
      last = timestamp;
      if (timestamp - lastDraw >= 1000 / 24) { draw(); lastDraw = timestamp; }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame); frame = 0; last = null;
      draw(stopped());
      if (!stopped()) frame = requestAnimationFrame(tick);
    };
    const resize = () => {
      const width = canvas.current.getBoundingClientRect().width;
      if (width > 0) renderer.resize(width, window.devicePixelRatio || 1);
      draw(true);
    };
    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(canvas.current);
    const viewObserver = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting; sync();
    }, { rootMargin: '60px' }) : null;
    viewObserver?.observe(canvas.current);
    media.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    update.current = sync;
    resize(); sync();
    return () => {
      disposed = true; cancelAnimationFrame(frame); update.current = null;
      sizeObserver.disconnect(); viewObserver?.disconnect();
      media.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  const activeKey = state.activeIds.join('|');
  useEffect(() => { update.current?.(); }, [state.mode, activeKey, paused, shared?.paused]);
  const fallbackHue = (fallbackHues[state.activeIds[0]] ?? fallbackHues.recording_identity) - fallbackHues.recording_identity;

  return <div className={`sc-resonance-symbol sc-harry-identity ${className}`} role="img" aria-label={state.label} data-mode={state.mode} data-glow="96" data-uncertain={state.uncertain}>
    <canvas ref={canvas} hidden={unavailable} aria-hidden="true" />
    {unavailable && <img src={state.mode === 'spectrum' ? spectrumStill : metallicStill} style={state.mode === 'spectrum' ? { filter: `hue-rotate(${fallbackHue}deg)` } : undefined} alt="" />}
  </div>;
}
