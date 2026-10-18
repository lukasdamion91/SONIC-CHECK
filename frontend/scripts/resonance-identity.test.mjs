import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPONENT_ACTIVITY_SCHEMA, HARRY_COMPONENTS, parseComponentActivity } from '../src/lib/componentActivity.mjs';
import { INITIAL_SCAN_PROGRESS, scanProgressReducer as reduce } from '../src/lib/scanProgress.mjs';
import { resonanceIdentity, unobservedResonance, RESONANCE_GLOW_BOOST, RESONANCE_BREATH_SECONDS } from '../src/lib/resonanceIdentity.mjs';

function reported(ids=[],revision=1) {
  return reduce(INITIAL_SCAN_PROGRESS,{type:'SERVER_PROGRESS',state:'processing',progressPercent:12,stage:'validation_complete',componentActivity:parseComponentActivity({schema_version:COMPONENT_ACTIVITY_SCHEMA,revision,components:HARRY_COMPONENTS.map(({id})=>({id,state:ids.includes(id)?'running':'waiting'}))})});
}
test('selected motion and glow settings are fixed',()=>{
  assert.equal(RESONANCE_GLOW_BOOST,96);assert.equal(RESONANCE_BREATH_SECONDS,8);
});
test('inactive and confirmed terminal scans use metallic',()=>{
  for(const progress of [INITIAL_SCAN_PROGRESS,reduce(reported(),{type:'COMPLETE'}),reduce(reported(),{type:'FAIL',state:'failed'})]) {
    assert.equal(resonanceIdentity(progress).mode,'metallic');assert.deepEqual(resonanceIdentity(progress).activeIds,[]);
  }
});
test('starting, uploading and processing use spectrum without inventing component activity',()=>{
  for(const phase of ['preparing','uploading','analysing']) {
    const view=resonanceIdentity({...INITIAL_SCAN_PROGRESS,phase});
    assert.equal(view.mode,'spectrum');assert.deepEqual(view.activeIds,[]);
  }
});
test('all six explicit components can be emphasised, including parallel work',()=>{
  for(const {id} of HARRY_COMPONENTS)assert.deepEqual(resonanceIdentity(reported([id])).activeIds,[id]);
  assert.deepEqual(resonanceIdentity(reported(['recording_identity','lyric_overlap'])).activeIds,['recording_identity','lyric_overlap']);
});
test('outage, stale snapshots and terminal reports immediately clear highlights',()=>{
  const current=reported(['recording_identity'],5);
  for(const progress of [reduce(current,{type:'COMPONENT_TELEMETRY_UNAVAILABLE'}),reduce(current,{type:'SERVER_PROGRESS',componentActivity:reported(['lyric_overlap'],1).componentActivity}),reduce(current,{type:'SERVER_PROGRESS',state:'completed',componentActivity:current.componentActivity}),reduce(current,{type:'SERVER_PROGRESS',state:'failed',componentActivity:current.componentActivity})])assert.deepEqual(resonanceIdentity(progress).activeIds,[]);
});
test('unknown outcome remains explicitly unknown, with no asserted component activity',()=>{
  for(const serverState of ['recovery_timeout','recovery_unavailable','unobserved']) {
    const view=resonanceIdentity({...reported(['recording_identity']),phase:'error',serverState});
    assert.equal(view.mode,'spectrum');assert.equal(view.uncertain,true);assert.deepEqual(view.activeIds,[]);assert.match(view.label,/unavailable/);
  }
});
test('leaving an unfinished scan does not assert that the server stopped',()=>{
  const view=resonanceIdentity(unobservedResonance(reported(['recording_identity'])));
  assert.equal(view.uncertain,true);assert.deepEqual(view.activeIds,[]);
  const completed=reduce(reported(),{type:'COMPLETE'});
  assert.equal(unobservedResonance(completed),completed);
});
test('payment fields cannot trigger or suppress component activity',()=>{
  const progress=reported(['composition_similarity']);
  assert.deepEqual(resonanceIdentity({...progress,paid:true}),resonanceIdentity({...progress,paid:false}));
});
