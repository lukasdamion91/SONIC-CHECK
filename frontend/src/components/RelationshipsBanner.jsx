import { useEffect, useRef, useState } from "react";
import "./RelationshipsBanner.css";

// These names span licensing, authorised research and music-data relationships.
// Their inclusion does not assert identical partnerships or active scan coverage.
const ORGANISATIONS = ["PEX", "VOBILE INC.", "MetaBrainz", "AcoustID", "MusicBrainz", "ACRCloud"];

export default function RelationshipsBanner() {
  const rootRef = useRef(null);
  const trackRef = useRef(null);
  const groupRef = useRef(null);
  const offsetRef = useRef(0);
  const widthRef = useRef(0);
  const pointerRef = useRef(null);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [playing, setPlaying] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  const [announcement, setAnnouncement] = useState("");

  const draw = () => {
    if (!trackRef.current || !widthRef.current) return;
    offsetRef.current = ((offsetRef.current % widthRef.current) + widthRef.current) % widthRef.current;
    trackRef.current.style.transform = `translateX(${-offsetRef.current}px)`;
  };

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionChange = () => {
      setReducedMotion(media.matches);
      if (media.matches) setPlaying(false);
    };
    const onVisibilityChange = () => setPageVisible(!document.hidden);
    const resize = new ResizeObserver(() => {
      widthRef.current = groupRef.current?.getBoundingClientRect().width || 0;
      draw();
    });
    const intersection = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    resize.observe(groupRef.current);
    intersection.observe(rootRef.current);
    media.addEventListener("change", onMotionChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      resize.disconnect();
      intersection.disconnect();
      media.removeEventListener("change", onMotionChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!playing || hovered || focused || !visible || !pageVisible) return undefined;
    let frame;
    let last = 0;
    let elapsed = 0;
    const tick = (now) => {
      const seconds = last ? Math.min((now - last) / 1000, 0.075) : 0;
      last = now;
      if (reducedMotion) {
        // An explicit Play request uses discrete steps with reduced motion.
        elapsed += seconds;
        if (elapsed >= 5) {
          offsetRef.current += 210;
          elapsed = 0;
          draw();
        }
      } else {
        offsetRef.current += seconds * 19;
        draw();
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [playing, hovered, focused, visible, pageVisible, reducedMotion]);

  const move = (direction) => {
    setPlaying(false);
    offsetRef.current += direction * 210;
    draw();
    setAnnouncement(direction > 0 ? "Showing next organisations." : "Showing previous organisations.");
  };

  const toggle = () => {
    const next = !playing;
    setPlaying(next);
    setHovered(false);
    setFocused(false);
    setAnnouncement(next ? "Organisation carousel playing." : "Organisation carousel paused.");
  };

  const names = (duplicate = false) => (
    <ul className="sc-relationships-group" ref={duplicate ? undefined : groupRef} aria-hidden={duplicate ? "true" : undefined}>
      {ORGANISATIONS.map(name => (
        <li className="sc-relationships-name" key={name}>
          {name === "VOBILE INC." ? <>VOBILE <small>INC.</small></> : name}
        </li>
      ))}
    </ul>
  );

  return (
    <section
      ref={rootRef}
      className="sc-relationships"
      aria-labelledby="sc-relationships-title"
      data-testid="relationships-banner"
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
    >
      <div className="sc-wrap sc-relationships-heading">
        <p id="sc-relationships-title" className="sc-relationships-title">Licensing · Research · Music Data</p>
        <div className="sc-relationships-controls" role="group" aria-label="Organisation carousel controls">
          <button type="button" className="sc-relationships-button sc-relationships-step" onClick={() => move(-1)} aria-label="Previous organisation">
            <span className="sc-relationships-step-word">Previous</span><span className="sc-relationships-step-symbol" aria-hidden="true">‹</span>
          </button>
          <button type="button" className="sc-relationships-button" onClick={toggle} aria-label={`${playing ? "Pause" : "Play"} organisation carousel`} aria-pressed={!playing}>
            {playing ? "Pause" : "Play"}
          </button>
          <button type="button" className="sc-relationships-button sc-relationships-step" onClick={() => move(1)} aria-label="Next organisation">
            <span className="sc-relationships-step-word">Next</span><span className="sc-relationships-step-symbol" aria-hidden="true">›</span>
          </button>
        </div>
      </div>
      <div
        className="sc-relationships-clip"
        onPointerEnter={event => { if (event.pointerType !== "touch") setHovered(true); }}
        onPointerLeave={() => setHovered(false)}
        onPointerDown={event => { pointerRef.current = event.clientX; }}
        onPointerCancel={() => { pointerRef.current = null; }}
        onPointerUp={event => {
          if (pointerRef.current !== null && Math.abs(event.clientX - pointerRef.current) > 30) {
            move(event.clientX < pointerRef.current ? 1 : -1);
          }
          pointerRef.current = null;
        }}
      >
        <div className="sc-relationships-track" ref={trackRef}>
          {names()}{names(true)}{names(true)}
        </div>
      </div>
      <p className="sc-relationships-announcement" aria-live="polite">{announcement}</p>
    </section>
  );
}
