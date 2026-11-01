import test from 'node:test';
import assert from 'node:assert/strict';
import { createSettingsStore } from '../src/background/settings.ts';

function memoryStorage(initial) {
  let value=initial;
  return {get:async()=>structuredClone({settings:value}),set:async input=>{value=structuredClone(input.settings);}};
}
test('simultaneous updates preserve both chosen sites',async()=>{
  const storage=memoryStorage({enabled:true,sites:[]});
  const applied=[];
  const store=createSettingsStore(storage,async next=>{applied.push(structuredClone(next));});
  await Promise.all([
    store.updateSettings(s=>({...s,sites:[...s.sites,'one.test']})),
    store.updateSettings(s=>({...s,sites:[...s.sites,'two.test']})),
  ]);
  assert.deepEqual(await store.readSettings(),{enabled:true,sites:['one.test','two.test']});
  assert.deepEqual(applied.at(-1),{enabled:true,sites:['one.test','two.test']});
});
test('failed rule installation does not save a misleading preference',async()=>{
  const store=createSettingsStore(memoryStorage({enabled:true,sites:[]}),async()=>{throw Error('rule rejected');});
  await assert.rejects(store.updateSettings(s=>({...s,sites:['example.com']})),/rule rejected/);
  assert.deepEqual(await store.readSettings(),{enabled:true,sites:[]});
});
test('failed persistence rolls rules back and does not poison later updates',async()=>{
  const storage=memoryStorage({enabled:true,sites:['example.com']});
  const save=storage.set;let fail=true;
  storage.set=async value=>{if(fail)throw Error('disk full');await save(value);};
  const applied=[];
  const store=createSettingsStore(storage,async next=>{applied.push(structuredClone(next));});
  await assert.rejects(store.updateSettings(s=>({...s,enabled:false})),/disk full/);
  assert.deepEqual(applied.at(-1),{enabled:true,sites:['example.com']});
  fail=false;
  await store.updateSettings(s=>({...s,sites:[]}));
  assert.deepEqual(await store.readSettings(),{enabled:true,sites:[]});
});
