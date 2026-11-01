import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

async function page() {
  const opened=[],messages=[];
  const window=new EventTarget();
  window.name='player';window.parent=window;
  window.postMessage=message=>messages.push(message);
  window.open=(url,target)=>{opened.push({url,target});return {native:true};};
  const document=new EventTarget();document.baseURI='https://example.com/video';
  document.querySelector=()=>null;document.querySelectorAll=()=>[];
  class Anchor {constructor(href,target){this.href=href;this.target=target;}getAttribute(name){return this[name]??null;}}
  class Form {constructor(){this.target='_blank';this.action='https://example.com/form';this.method='post';}submit(){opened.push({form:true});}getAttribute(name){return this[name]||null;}}
  const context=vm.createContext({window,document,HTMLAnchorElement:Anchor,HTMLAreaElement:Anchor,HTMLFormElement:Form,Event,CustomEvent,URL,Symbol,Reflect});
  const code=stripTypeScriptTypes(await readFile(new URL('../src/content/main.ts',import.meta.url),'utf8'));
  vm.runInContext(code,context);
  return {window,document,opened,messages,Anchor,Form,setActive:active=>window.dispatchEvent(new CustomEvent('chrome-block:state',{detail:active})),runAgain:()=>vm.runInContext(code,context)};
}
test('fallback blocks script openings only after the protected page is enabled',async()=>{
  const p=await page();
  assert.deepEqual(p.window.open('/before','_blank'),{native:true});
  p.setActive(true);
  assert.equal(p.window.open('/ad','_blank'),null);
  assert.equal(p.opened.length,1);
  assert.equal(p.messages.filter(m=>m.type==='attempt').length,1);
  assert.equal(p.messages.find(m=>m.type==='attempt').attempt.url,'https://example.com/ad');
});
test('same-page targets remain native and disabling restores later openings',async()=>{
  const p=await page();p.setActive(true);
  for(const target of ['_self','_top','_parent','player'])assert.deepEqual(p.window.open('/next',target),{native:true});
  p.setActive(false);
  assert.deepEqual(p.window.open('/after','_blank'),{native:true});
  assert.equal(p.opened.length,5);
});
test('blank-link clicks including modified normal links are cancelled without swallowing other handlers',async()=>{
  const p=await page();p.setActive(true);
  const link=new p.Anchor('https://ad.test/','_blank');
  const event=new Event('click',{cancelable:true});event.composedPath=()=>[link];
  let bubbled=false;p.document.addEventListener('click',()=>{bubbled=true;});
  p.document.dispatchEvent(event);
  assert.equal(event.defaultPrevented,true);assert.equal(bubbled,true);
  const modified=new Event('click',{cancelable:true});modified.composedPath=()=>[new p.Anchor('https://ad.test/','')];modified.ctrlKey=true;
  p.document.dispatchEvent(modified);assert.equal(modified.defaultPrevented,true);
  const normal=new Event('click',{cancelable:true});normal.composedPath=()=>[new p.Anchor('https://example.com/next','')];
  p.document.dispatchEvent(normal);assert.equal(normal.defaultPrevented,false);
});
test('programmatic form submission is blocked without recording input values',async()=>{
  const p=await page();p.setActive(true);
  const form=new p.Form();form.secret='do-not-log';form.submit();
  assert.equal(p.opened.length,0);
  const message=p.messages.find(m=>m.type==='attempt');
  assert.equal(message.attempt.kind,'form');assert.equal(message.attempt.url,'https://example.com/form');
  assert.equal(JSON.stringify(message).includes('do-not-log'),false);
});
test('re-injection does not stack wrappers or duplicate attempt logging',async()=>{
  const p=await page();p.runAgain();p.setActive(true);p.window.open('/ad');
  assert.equal(p.messages.filter(m=>m.type==='attempt').length,1);
});
test('empty window target opens a new context and must be blocked',async()=>{
  const p=await page();p.setActive(true);
  assert.equal(p.window.open('/ad',''),null);
  assert.equal(p.opened.length,0);
});
test('an explicit empty link target overrides a blank base target',async()=>{
  const p=await page();p.setActive(true);
  p.document.querySelector=()=>({getAttribute:()=> '_blank'});
  const event=new Event('click',{cancelable:true});event.composedPath=()=>[new p.Anchor('https://example.com/next','')];
  p.document.dispatchEvent(event);
  assert.equal(event.defaultPrevented,false);
});
test('an explicit empty formtarget submits in place instead of inheriting blank',async()=>{
  const p=await page();p.setActive(true);
  const event=new Event('submit',{cancelable:true});
  Object.defineProperty(event,'target',{value:new p.Form()});
  event.submitter={getAttribute:name=>name==='formtarget'?'':null};
  p.document.dispatchEvent(event);
  assert.equal(event.defaultPrevented,false);
  assert.equal(p.messages.filter(m=>m.type==='attempt').length,0);
});
