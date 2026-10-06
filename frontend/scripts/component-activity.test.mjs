import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPONENT_ACTIVITY_SCHEMA, HARRY_COMPONENTS, parseComponentActivity, componentActivityView } from '../src/lib/componentActivity.mjs';
import { INITIAL_SCAN_PROGRESS, scanProgressReducer as reduce, getScanProgressView } from '../src/lib/scanProgress.mjs';

const payload = (states = {}, revision = 1) => ({ schema_version: COMPONENT_ACTIVITY_SCHEMA, revision,
  components: HARRY_COMPONENTS.map(({ id }) => ({ id, state: states[id] || 'waiting' })) });
const progress = data => reduce(INITIAL_SCAN_PROGRESS, { type: 'SERVER_PROGRESS', state: 'processing', progressPercent: 12, stage: 'validation_complete', componentActivity: parseComponentActivity(data) });

test('completed milestones and missing telemetry never select component colours', () => {
  for (const stage of ['accepted', 'evidence_channels_complete', 'candidate_refinement_complete']) {
    const view = componentActivityView(reduce(INITIAL_SCAN_PROGRESS, { type: 'SERVER_PROGRESS', stage, progressPercent: 38 }));
    assert.equal(view.active.length, 0);
    assert.equal(view.reported, false);
  }
});
test('only explicit running components select colours, including actual parallel activity', () => {
  const view = componentActivityView(progress(payload({ recording_identity: 'running', lyric_overlap: 'running', composition_similarity: 'complete', relational_specificity: 'unavailable', lyric_order_recovery: 'skipped', interval_path_specificity: 'error' })));
  assert.deepEqual(view.active.map(row => row.colour), ['#8defe4', '#dfbd79']);
  assert.match(view.detail, /parallel/);
  assert.deepEqual(view.rows.slice(2).map(row => row.statusLabel), ['Complete', 'Unavailable', 'Skipped', 'Error']);
});
test('invalid, incomplete, unknown or duplicated activity is rejected', () => {
  for (const mutate of [data => data.schema_version = 'future', data => data.revision = -1,
    data => data.components.pop(), data => data.components[0].id = 'unknown',
    data => data.components[1].id = data.components[0].id, data => data.components[0].state = 'maybe',
    data => data.components[0].reason = 'private provider text']) {
    const data = payload(); mutate(data); assert.equal(parseComponentActivity(data), null);
  }
});
test('outage or out-of-order snapshot removes active colours; a newer snapshot can restore them', () => {
  const active = progress(payload({ composition_similarity: 'running' }, 5));
  const failedPoll = reduce(active, { type: 'COMPONENT_TELEMETRY_UNAVAILABLE' });
  assert.equal(componentActivityView(failedPoll).active.length, 0);
  const stale = reduce(active, { type: 'SERVER_PROGRESS', componentActivity: parseComponentActivity(payload({ recording_identity: 'running' }, 2)) });
  assert.equal(stale.componentActivity.revision, 5);
  assert.equal(componentActivityView(stale).active.length, 0);
  const fresh = reduce(failedPoll, { type: 'SERVER_PROGRESS', componentActivity: parseComponentActivity(payload({ relational_specificity: 'running' }, 6)) });
  assert.equal(componentActivityView(fresh).active[0].id, 'relational_specificity');
});
test('terminal responses and retry reset cannot leave old activity running', () => {
  const active = progress(payload({ recording_identity: 'running' }));
  for (const action of [{ type: 'FAIL' }, { type: 'COMPLETE' }, { type: 'BEGIN' }, { type: 'RESET' },
    { type: 'SERVER_PROGRESS', state: 'completed', componentActivity: active.componentActivity },
    { type: 'SERVER_PROGRESS', state: 'failed', componentActivity: active.componentActivity }]) {
    assert.equal(componentActivityView(reduce(active, action)).active.length, 0);
  }
  const complete = reduce(active, { type: 'COMPLETE' });
  assert.equal(reduce(complete, { type: 'SERVER_PROGRESS', componentActivity: active.componentActivity }), complete);
  assert.match(componentActivityView(complete).detail, /does not establish originality or clearance/);
});
test('ambiguous errors do not promise that no record was stored', () => {
  const failed = reduce(progress(payload()), { type: 'FAIL', state: 'recovery_timeout' });
  assert.match(getScanProgressView(failed).detail, /check your dashboard before retrying/i);
  assert.doesNotMatch(getScanProgressView(failed).detail, /no completed result was stored/i);
});
