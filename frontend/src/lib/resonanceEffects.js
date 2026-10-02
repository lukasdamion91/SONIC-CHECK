// Decorative motion and colour demonstrations from Luke's supplied Resonance design.
// These do not submit audio, call providers or represent scanner progress.
export function mountResonanceEffects(root) {
  if (!root) return undefined;
  const cleanups = [];
  const listen = (target, event, handler) => {
    target.addEventListener(event, handler);
    cleanups.push(() => target.removeEventListener(event, handler));
  };
{

  const button = root.querySelector('#sc4-toggle-methods');
  const methods = [...root.querySelectorAll('.sc-method')];
  const update = () => {
    const allOpen = methods.every(method => method.open);
    button.textContent = allOpen ? 'Collapse the six methods −' : 'Expand all six methods +';
    button.setAttribute('aria-expanded', String(allOpen));
  };
  listen(button, 'click', () => {
    const open = !methods.every(method => method.open);
    methods.forEach(method => { method.open = open; });
    update();
  });
  methods.forEach(method => listen(method, 'toggle', update));
  update();

}
{

  const select = root.querySelector('#sc4-stage-select');
  const status = root.querySelector('#sc4-colour-state');
  const pause = root.querySelector('#sc4-pause-shape');
  const play = root.querySelector('#sc4-play-stages');
  const stages = {
    recording_identity: { label: 'Recording identity', colour: '#8defe4' },
    lyric_overlap: { label: 'Exact lyric overlap', colour: '#dfbd79' },
    composition_similarity: { label: 'Composition similarity', colour: '#9db8f0' },
    relational_specificity: { label: 'Relational Specificity', colour: '#a5edbc' },
    lyric_order_recovery: { label: 'Lyric Order Recovery', colour: '#d9a8e8' },
    interval_path_specificity: { label: 'Interval Path Specificity', colour: '#ff9fc7' }
  };
  const sequence = Object.keys(stages);
  const preference = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let timer = null;
  let paused = !!(preference && preference.matches);
  let reduced = paused;

  function stopSequence() {
    if (timer !== null) { window.clearInterval(timer); timer = null; }
    play.textContent = 'Play stage preview';
    play.setAttribute('aria-pressed', 'false');
  }

  function setStage(key) {
    if (key !== 'ambient' && !Object.prototype.hasOwnProperty.call(stages, key)) return false;
    select.value = key;
    root.dataset.colourMode = key === 'ambient' ? 'ambient' : 'stage';
    const stage = stages[key];
    root.style.setProperty('--sc-stage-color', stage ? stage.colour : '#8defe4');
    status.textContent = (stage ? stage.label : '11-colour breathing spectrum') + ' · colour preview';
    return true;
  }

  function updateMotion() {
    root.dataset.shapePaused = String(paused || reduced);
    pause.setAttribute('aria-pressed', String(paused || reduced));
    pause.disabled = reduced;
    pause.textContent = reduced ? 'Reduced motion enabled' : paused ? 'Resume effects' : 'Pause effects';
  }

  listen(select, 'change', () => { stopSequence(); setStage(select.value); });
  listen(pause, 'click', () => {
    if (reduced) return;
    paused = !paused;
    if (paused) stopSequence();
    updateMotion();
  });
  listen(play, 'click', () => {
    if (timer !== null) { stopSequence(); return; }
    if (!reduced) { paused = false; updateMotion(); }
    let index = 0;
    setStage(sequence[index]);
    play.textContent = 'Stop stage preview';
    play.setAttribute('aria-pressed', 'true');
    timer = window.setInterval(() => {
      index += 1;
      if (index >= sequence.length) { stopSequence(); return; }
      setStage(sequence[index]);
    }, 5000);
  });
  if (preference && typeof preference.addEventListener === 'function') {
    listen(preference, 'change', event => {
      reduced = event.matches;
      if (reduced) { paused = true; stopSequence(); }
      updateMotion();
    });
  }
  listen(document, 'visibilitychange', () => { if (document.hidden) stopSequence(); });
  listen(window, 'pagehide', stopSequence);
  // Local integration point prepared for future scanner wiring. No provider or scanner is called.
  // root.dispatchEvent(new CustomEvent('soniccheck:analysis-stage', {detail:{stage:'recording_identity'}}));
  listen(root, 'soniccheck:analysis-stage', event => {
    const key = event.detail && event.detail.stage;
    if (typeof key === 'string' && (key === 'ambient' || Object.prototype.hasOwnProperty.call(stages, key))) {
      stopSequence();
      setStage(key);
    }
  });
  setStage('ambient');
  updateMotion();

  cleanups.push(stopSequence);

}
{

  const visual = root.querySelector('.sc-orbit-visual');
  const core = root.querySelector('.sc-orbit-core');
  if (visual && core) {
    const media = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    let inView = true;
    let pageActive = true;

    function sync() {
      // CSS runs the complete breath on the compositor. Pause its existing timeline
      // so returning to the page or resuming never jumps to a different phase.
      const running = pageActive && inView && !document.hidden
        && root.dataset.shapePaused !== 'true' && !(media && media.matches);
      core.style.animationPlayState = running ? 'running' : 'paused';
    }

    const stateObserver = new MutationObserver(sync);
    cleanups.push(() => stateObserver.disconnect());
    stateObserver.observe(root, { attributes: true, attributeFilter: ['data-shape-paused'] });
    if (typeof IntersectionObserver === 'function') {
      const intersection = new IntersectionObserver(entries => {
        inView = entries[0].isIntersecting;
        sync();
      }, { rootMargin: '60px' });
      intersection.observe(visual);
      cleanups.push(() => intersection.disconnect());
    }
    if (media && typeof media.addEventListener === 'function') listen(media, 'change', sync);
    listen(document, 'visibilitychange', sync);
    listen(window, 'pagehide', () => { pageActive = false; sync(); });
    listen(window, 'pageshow', () => { pageActive = true; sync(); });
    sync();
    cleanups.push(() => { core.style.animationPlayState = 'paused'; });
  }
}
  return () => cleanups.reverse().forEach(dispose => dispose());
}
