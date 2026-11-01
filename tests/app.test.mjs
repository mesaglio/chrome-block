import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/background/app.ts';
import { fakeChrome,popup,content } from './helpers/chrome.mjs';

test('site activation installs protection and reloads only affected tabs',async()=>{
  const fake=fakeChrome();const app=createApp(fake.api);
  await app.onMessage({type:'SET_SITE',tabId:1,host:'example.com',enabled:true},popup);
  assert.deepEqual(fake.local.settings,{enabled:true,sites:['example.com']});
  assert.equal(fake.rules().length,1);
  assert.deepEqual(fake.reloaded.map(x=>x.id),[1,3]);
  assert.ok(fake.reloaded.every(x=>x.options.bypassCache));
});
test('site activation needs access and refuses a stale popup host',async()=>{
  const fake=fakeChrome();const app=createApp(fake.api);
  await assert.rejects(app.onMessage({type:'SET_SITE',tabId:1,host:'old.test',enabled:true},popup),/cambió/);
  fake.granted.clear();
  await assert.rejects(app.onMessage({type:'SET_SITE',tabId:1,host:'example.com',enabled:true},popup),/permiso/);
  assert.equal(fake.rules().length,0);
});
test('content cannot issue settings commands or open a recorded destination',async()=>{
  const fake=fakeChrome();const app=createApp(fake.api);
  for(const type of ['SET_SITE','SET_ENABLED','OPEN_ATTEMPT'])await assert.rejects(app.onMessage({type,tabId:1,enabled:true,url:'https://ad.test/'},content()),/autorizado/);
  assert.deepEqual(fake.opened,[]);assert.equal(fake.local.settings,undefined);
});
test('global suspension preserves sites and reloads their open pages',async()=>{
  const fake=fakeChrome();const app=createApp(fake.api);
  await app.onMessage({type:'SET_SITE',tabId:1,host:'example.com',enabled:true},popup);
  fake.reloaded.length=0;
  await app.onMessage({type:'SET_ENABLED',enabled:false},popup);
  assert.deepEqual(fake.local.settings,{enabled:false,sites:['example.com']});
  assert.deepEqual(fake.rules(),[]);assert.deepEqual(fake.reloaded.map(x=>x.id),[1,3]);
});
test('recorded HTTP(S) attempts require an explicit popup command to open',async()=>{
  const fake=fakeChrome();fake.local.settings={enabled:true,sites:['example.com']};
  const app=createApp(fake.api);
  await app.onMessage({type:'ATTEMPT',attempt:{kind:'window',url:'https://ad.test/path'}},content());
  let state=await app.onMessage({type:'GET_STATE',tabId:1},popup);
  assert.equal(state.log.count,1);assert.equal(fake.opened.length,0);
  await app.onMessage({type:'OPEN_ATTEMPT',tabId:1,id:state.log.recent[0].id},popup);
  assert.deepEqual(fake.opened,['https://ad.test/path']);
  await assert.rejects(app.onMessage({type:'OPEN_ATTEMPT',tabId:1,id:'invented',url:'https://evil.test'},popup),/disponible/);
});
test('worker recreation preserves session logs but navigation clears them',async()=>{
  const fake=fakeChrome();fake.local.settings={enabled:true,sites:['example.com']};
  const app=createApp(fake.api);
  await app.onMessage({type:'ATTEMPT',attempt:{kind:'link',url:'https://ad.test/'}},content());
  const restarted=createApp(fake.api);
  assert.equal((await restarted.onMessage({type:'GET_STATE',tabId:1},popup)).log.count,1);
  await restarted.onUpdated(1,{status:'loading'},fake.tabs.get(1));
  assert.equal((await restarted.onMessage({type:'GET_STATE',tabId:1},popup)).log.count,0);
  await restarted.onRemoved(1);
  assert.equal(Object.keys(fake.session).some(key=>key.endsWith(':1')),false);
});
test('unselected pages and missing permissions cannot submit recorded blocks',async()=>{
  const fake=fakeChrome();const app=createApp(fake.api);
  await app.onMessage({type:'ATTEMPT',attempt:{kind:'window',url:'https://ad.test/'}},content());
  assert.equal((await app.onMessage({type:'GET_STATE',tabId:1},popup)).log.count,0);
  fake.local.settings={enabled:true,sites:['example.com']};fake.granted.clear();
  const state=await app.onMessage({type:'GET_STATE',tabId:1},popup);
  assert.equal(state.permission,false);assert.equal(state.selected,true);
});
test('failed reload remains visibly pending until a new load completes',async()=>{
  const fake=fakeChrome();fake.api.tabs.reload=async()=>{throw Error('offline');};
  const app=createApp(fake.api);
  const result=await app.onMessage({type:'SET_SITE',tabId:1,host:'example.com',enabled:true},popup);
  assert.deepEqual(result.reloadErrors,[1,3]);
  assert.equal((await app.onMessage({type:'GET_STATE',tabId:1},popup)).pending,true);
  await app.onUpdated(1,{status:'complete'},fake.tabs.get(1));
  assert.equal((await app.onMessage({type:'GET_STATE',tabId:1},popup)).pending,true);
  await app.onUpdated(1,{status:'loading'},fake.tabs.get(1));
  await app.onUpdated(1,{status:'complete'},fake.tabs.get(1));
  assert.equal((await app.onMessage({type:'GET_STATE',tabId:1},popup)).pending,false);
});
test('forms remain nonrecoverable even when a popup command supplies their ID',async()=>{
  const fake=fakeChrome();fake.local.settings={enabled:true,sites:['example.com']};
  const app=createApp(fake.api);
  await app.onMessage({type:'ATTEMPT',attempt:{kind:'form',url:'https://example.com/pay'}},content());
  const state=await app.onMessage({type:'GET_STATE',tabId:1},popup);
  await assert.rejects(app.onMessage({type:'OPEN_ATTEMPT',tabId:1,id:state.log.recent[0].id},popup),/recuperar/);
  assert.deepEqual(fake.opened,[]);
});
test('restoring a permission reloads documents that were loaded without protection',async()=>{
  const fake=fakeChrome();fake.local.settings={enabled:true,sites:['example.com']};fake.granted.clear();
  const app=createApp(fake.api);
  await app.reconcile();
  fake.granted.add('http://example.com/*');
  fake.granted.add('https://example.com/*');
  await app.reconcile();
  const state=await app.onMessage({type:'GET_STATE',tabId:1},popup);
  assert.equal(state.configured,true);
  assert.equal(state.pending,true);
  assert.deepEqual(fake.reloaded.map(x=>x.id),[1,3]);
  fake.reloaded.length=0;
  await app.reconcile();
  assert.equal(fake.reloaded.length,0,'unchanged startup must not reload again');
});
