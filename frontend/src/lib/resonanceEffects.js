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
  return () => cleanups.reverse().forEach(dispose => dispose());
}
