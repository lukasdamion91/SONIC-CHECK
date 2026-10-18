import test from 'node:test';
import assert from 'node:assert/strict';
import { createResonanceRenderer } from '../src/lib/resonanceRenderer.mjs';
import { HARRY_COMPONENTS } from '../src/lib/componentActivity.mjs';

function hue(rgb) {
  const [r, g, b] = rgb, max = Math.max(...rgb), min = Math.min(...rgb), span = max - min;
  if (!span) return null;
  return (((max === r ? (g - b) / span : max === g ? (b - r) / span + 2 : (r - g) / span + 4) * 60) + 360) % 360;
}
const distance = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
function surface() {
  const strokes = [];
  const noop = () => {};
  const context = {
    clearRect: noop, setTransform: noop, beginPath: noop, moveTo: noop, lineTo: noop,
    fillRect: noop, arc: noop, fill: noop,
    createRadialGradient: () => ({ addColorStop: noop }),
    stroke() { strokes.push(this.strokeStyle); },
  };
  const renderer = createResonanceRenderer({ getContext: () => context });
  renderer.resize(313.344);
  return { renderer, strokes };
}
function colouredHues(strokes) {
  return strokes.map(colour => colour.match(/^rgba?\((\d+),(\d+),(\d+)/))
    .filter(Boolean).map(match => match.slice(1, 4).map(Number))
    // Clipped specular highlights cannot retain the source hue numerically.
    // Check the coloured body and halos before that deliberate highlight clipping.
    .filter(rgb => Math.max(...rgb) < 255 && (Math.max(...rgb) - Math.min(...rgb)) / Math.max(...rgb) >= .3)
    .map(hue).filter(value => value !== null);
}

test('every active component recolours the entire resonance into its own tonal family', () => {
  const { renderer, strokes } = surface();
  for (const { id, colour } of HARRY_COMPONENTS) {
    strokes.length = 0;
    renderer.draw(0, { mode: 'spectrum', activeIds: [id] }, { instant: true });
    const target = hue([1, 3, 5].map(start => parseInt(colour.slice(start, start + 2), 16)));
    const hues = colouredHues(strokes);
    assert.ok(hues.length > 100, 'The whole body must be drawn, not just a status dot');
    assert.ok(hues.every(value => distance(value, target) < 12), `${id} must not retain unrelated rainbow strands`);
  }
});

test('parallel activity still uses one blended family at a time', () => {
  const { renderer, strokes } = surface();
  renderer.draw(0, { mode: 'spectrum', activeIds: ['recording_identity', 'lyric_overlap'] }, { instant: true });
  const hues = colouredHues(strokes);
  assert.ok(hues.every(value => distance(value, hues[0]) < 15));
});

test('a change of component transitions the whole body through one shared hue', () => {
  const { renderer, strokes } = surface();
  renderer.draw(0, { mode: 'spectrum', activeIds: ['recording_identity'] }, { instant: true });
  for (const time of [.1, .25, .5, 1]) {
    strokes.length = 0;
    renderer.draw(time, { mode: 'spectrum', activeIds: ['lyric_order_recovery'] });
    const hues = colouredHues(strokes);
    assert.ok(hues.every(value => distance(value, hues[0]) < 15));
  }
});
