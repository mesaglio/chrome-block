import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/background/engine.ts';

function fakeChrome() {
  let rules=[],scripts=[];let failScripts=false;
  const api={
    permissions:{contains:async({origins})=>origins.every(x=>['http://example.com/*','https://example.com/*'].includes(x))},
    declarativeNetRequest:{
      getDynamicRules:async()=>structuredClone(rules),
      updateDynamicRules:async({removeRuleIds,addRules=[]})=>{rules=[...rules.filter(r=>!removeRuleIds.includes(r.id)),...structuredClone(addRules)];},
    },
    scripting:{
      getRegisteredContentScripts:async()=>structuredClone(scripts),
      unregisterContentScripts:async({ids})=>{scripts=scripts.filter(s=>!ids.includes(s.id));},
      registerContentScripts:async input=>{if(failScripts){failScripts=false;throw Error('script rejected');}scripts.push(...structuredClone(input));},
    },
  };
  return {api,rules:()=>rules,scripts:()=>scripts,fail:()=>{failScripts=true;}};
}
test('applies persistent rules and early scripts only where access was granted',async()=>{
  const fake=fakeChrome();const engine=createEngine(fake.api);
  await engine.apply({enabled:true,sites:['example.com','missing.test']});
  assert.equal(fake.rules().length,1);
  assert.equal(fake.scripts().length,2);
  for(const script of fake.scripts()){
    assert.deepEqual(script.matches,['http://example.com/*','https://example.com/*']);
    assert.equal(script.runAt,'document_start');
    assert.equal(script.allFrames,true);
  }
  assert.deepEqual(new Set(fake.scripts().map(x=>x.world)),new Set(['MAIN','ISOLATED']));
  assert.deepEqual(await engine.grantedHosts(['example.com','missing.test']),['example.com']);
});
test('disabling removes both rules and future instrumentation',async()=>{
  const fake=fakeChrome();const engine=createEngine(fake.api);
  await engine.apply({enabled:true,sites:['example.com']});
  await engine.apply({enabled:false,sites:['example.com']});
  assert.deepEqual(fake.rules(),[]);assert.deepEqual(fake.scripts(),[]);
});
test('script registration failure restores the previous engine configuration',async()=>{
  const fake=fakeChrome();const engine=createEngine(fake.api);
  fake.fail();
  await assert.rejects(engine.apply({enabled:true,sites:['example.com']}),/script rejected/);
  assert.deepEqual(fake.rules(),[]);assert.deepEqual(fake.scripts(),[]);
});
